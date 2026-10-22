import { Op } from 'sequelize';
import { ZapoConnectionManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { Message, Conversation, AutoDestructTask } from '../../database/models/index.js';
import { AutoDestructTaskStatus } from '../../database/models/AutoDestructTask.js';
import { emitToConnection } from '../realtime/socket.js';

export interface ScheduleAutoDestructInput {
  connectionId: string;
  conversationId?: string;
  targetJid?: string;
  stanzaId: string;
  delaySeconds: number;
}

export class AutoDestructService {
  private static activeTimers = new Map<string, NodeJS.Timeout>();

  public static readonly MAX_TIMEOUT_MS = 2147483647; // ~24.85 days
  public static readonly MAX_RETRIES = 5;
  public static readonly RETRY_DELAYS_SEC = [10, 30, 60, 120, 300];

  public static getTaskKey(connectionId: string, stanzaId: string): string {
    return JSON.stringify([connectionId, stanzaId]);
  }

  public static getActiveTimersCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Agenda a revogação automática com persistência segura no PostgreSQL.
   */
  public static scheduleAutoDestruct(input: ScheduleAutoDestructInput) {
    const { connectionId, stanzaId, delaySeconds } = input;
    if (!connectionId || !stanzaId || !delaySeconds || delaySeconds <= 0) {
      return null;
    }

    const taskKey = this.getTaskKey(connectionId, stanzaId);

    // Limpa timer em memória anterior se já existir
    if (this.activeTimers.has(taskKey)) {
      clearTimeout(this.activeTimers.get(taskKey)!);
      this.activeTimers.delete(taskKey);
    }

    const totalMs = delaySeconds * 1000;

    if (totalMs > this.MAX_TIMEOUT_MS) {
      console.log(`[AutoDestruct] ⏳ Tarefa longa para ${stanzaId} (${delaySeconds}s). Agendando fatia de ${Math.floor(this.MAX_TIMEOUT_MS / 1000)}s...`);
      const timer = setTimeout(() => {
        this.activeTimers.delete(taskKey);
        const remainingSeconds = Math.max(1, delaySeconds - Math.floor(this.MAX_TIMEOUT_MS / 1000));
        this.scheduleAutoDestruct({ ...input, delaySeconds: remainingSeconds });
      }, this.MAX_TIMEOUT_MS);

      this.activeTimers.set(taskKey, timer);
    } else {
      console.log(`[AutoDestruct] ⏳ Mensagem ${stanzaId} [${connectionId}] persistida e agendada para expirar em ${delaySeconds}s`);
      const timer = setTimeout(async () => {
        this.activeTimers.delete(taskKey);
        await this.executeRevoke(connectionId, stanzaId);
      }, totalMs);

      this.activeTimers.set(taskKey, timer);
    }

    // Persistência assíncrona no PostgreSQL (desacoplada para nunca bloquear o timer em memória)
    if (process.env.NODE_ENV !== 'test') {
      const executeAt = new Date(Date.now() + delaySeconds * 1000);
      const targetJid = input.targetJid || 'unknown@s.whatsapp.net';
      AutoDestructTask.upsert({
        connectionId,
        conversationId: input.conversationId,
        stanzaId,
        targetJid,
        status: 'scheduled',
        delaySeconds,
        executeAt,
        attempts: 0,
        maxAttempts: this.MAX_RETRIES,
        lastError: null,
        requestSentAt: null,
        confirmedAt: null,
      }).catch((err: any) => {
        console.warn(`[AutoDestruct] Aviso: Falha na persistência no banco: ${err?.message || err}`);
      });
    }

    return null;
  }

  /**
   * Executa a revogação de uma mensagem no WhatsApp com transição de estados no PostgreSQL.
   */
  public static async executeRevoke(connectionId: string, stanzaId: string): Promise<boolean> {
    const taskKey = this.getTaskKey(connectionId, stanzaId);
    let dbTask: AutoDestructTask | null = null;
    try {
      dbTask = await AutoDestructTask.findOne({ where: { connectionId, stanzaId } });
    } catch {}

    if (dbTask) {
      if (dbTask.status === 'cancelled' || dbTask.status === 'confirmed') {
        return true;
      }
      try {
        await dbTask.update({
          status: 'processing',
          attempts: dbTask.attempts + 1,
        });
      } catch {}
    }

    const zapoManager = ZapoConnectionManager.getInstance();
    const client = zapoManager.getClient(connectionId);

    if (!client) {
      const reason = 'Cliente WhatsApp não conectado';
      console.warn(`[AutoDestruct] ${reason} para conexão ${connectionId}. Reagendando...`);
      if (dbTask) await this.handleRetry(dbTask, reason);
      return false;
    }

    let targetJid = dbTask?.targetJid;
    if (!targetJid || targetJid === 'unknown@s.whatsapp.net') {
      try {
        if (dbTask?.conversationId) {
          const conv = await Conversation.findOne({ where: { id: dbTask.conversationId, connectionId } });
          if (conv?.jid) targetJid = conv.jid;
        }
        if (!targetJid) {
          const msg = await Message.findOne({ where: { connectionId, stanzaId } });
          if (msg?.conversationId) {
            const conv = await Conversation.findOne({ where: { id: msg.conversationId, connectionId } });
            if (conv?.jid) targetJid = conv.jid;
          }
        }
      } catch {}
    }

    if (!targetJid || targetJid === 'unknown@s.whatsapp.net') {
      if (dbTask) {
        try {
          await dbTask.update({
            status: 'failed',
            lastError: 'TargetJid não pôde ser determinado',
          });
        } catch {}
      }
      return false;
    }

    try {
      console.log(`[AutoDestruct] 🚀 Enviando revogação para WhatsApp: mensagem ${stanzaId} em ${targetJid}...`);

      if (dbTask) {
        try {
          await dbTask.update({
            status: 'request_sent',
            requestSentAt: new Date(),
            targetJid,
          });
        } catch {}
      }

      await ZapoMessageAdapter.revokeMessage(client, targetJid, {
        stanzaId,
        fromMe: true,
      });

      // Confirmação do servidor WhatsApp obtida
      const now = new Date();
      if (dbTask) {
        try {
          await dbTask.update({
            status: 'confirmed',
            confirmedAt: now,
            lastError: null,
          });
        } catch {}
      }

      this.activeTimers.delete(taskKey);

      // Atualiza registro da mensagem no banco local
      try {
        const msg = await Message.findOne({ where: { connectionId, stanzaId } });
        if (msg) {
          await msg.update({
            isRevoked: true,
            status: 'revoked',
            content: '🚫 Esta mensagem foi apagada',
          });
        }
      } catch {}

      // Emite atualização em tempo real via Socket.io
      emitToConnection(connectionId, 'message_status', {
        connectionId,
        stanzaId,
        status: 'revoked',
        isRevoked: true,
        content: '🚫 Esta mensagem foi apagada',
        autoDestructStatus: 'confirmed',
      });

      console.log(`[AutoDestruct] ✅ Mensagem ${stanzaId} revogada e confirmada pelo servidor WhatsApp!`);
      return true;
    } catch (err: any) {
      console.error(`[AutoDestruct] Erro ao revogar mensagem ${stanzaId}:`, err?.message || err);
      if (dbTask) await this.handleRetry(dbTask, err?.message || 'Falha no envio da revogação');
      return false;
    }
  }

  /**
   * Trata falhas de revogação com retentativas progressivas (backoff exponencial).
   */
  private static async handleRetry(dbTask: AutoDestructTask, reason: string) {
    const { connectionId, stanzaId, attempts, maxAttempts } = dbTask;
    const taskKey = this.getTaskKey(connectionId, stanzaId);

    if (attempts >= maxAttempts) {
      console.error(`[AutoDestruct] ❌ Limite de ${maxAttempts} tentativas excedido para ${stanzaId} (${connectionId}). Motivo: ${reason}`);
      try {
        await dbTask.update({
          status: 'failed',
          lastError: reason,
        });
      } catch {}
      this.activeTimers.delete(taskKey);
      return;
    }

    const backoffSec = this.RETRY_DELAYS_SEC[attempts] || 300;
    const nextExecuteAt = new Date(Date.now() + backoffSec * 1000);

    try {
      await dbTask.update({
        status: 'retrying',
        executeAt: nextExecuteAt,
        lastError: reason,
      });
    } catch {}

    console.log(`[AutoDestruct] 🔄 Reagendando tentativa ${attempts + 1}/${maxAttempts} para ${stanzaId} em ${backoffSec}s (motivo: ${reason})...`);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(taskKey);
      await this.executeRevoke(connectionId, stanzaId);
    }, backoffSec * 1000);

    this.activeTimers.set(taskKey, timer);
  }

  /**
   * Cancela uma tarefa de autodestruição para uma conexão e mensagem.
   */
  public static cancel(connectionId: string, stanzaId: string): boolean {
    const taskKey = this.getTaskKey(connectionId, stanzaId);
    let removed = false;
    if (this.activeTimers.has(taskKey)) {
      clearTimeout(this.activeTimers.get(taskKey)!);
      this.activeTimers.delete(taskKey);
      removed = true;
    }

    if (process.env.NODE_ENV !== 'test') {
      AutoDestructTask.update(
        { status: 'cancelled' },
        { where: { connectionId, stanzaId, status: ['scheduled', 'retrying', 'processing'] } }
      ).catch(() => {});
    }

    return removed;
  }

  /**
   * Cancela todas as tarefas ativas de uma conexão quando a conexão é desvinculada ou encerrada.
   */
  public static async cancelAllForConnection(connectionId: string): Promise<number> {
    let cancelledCount = 0;
    for (const [key, timer] of this.activeTimers.entries()) {
      try {
        const [conn] = JSON.parse(key);
        if (conn === connectionId) {
          clearTimeout(timer);
          this.activeTimers.delete(key);
          cancelledCount++;
        }
      } catch {}
    }

    const [updated] = await AutoDestructTask.update(
      { status: 'cancelled', lastError: 'Conexão encerrada' },
      { where: { connectionId, status: ['scheduled', 'retrying'] } }
    );

    console.log(`[AutoDestruct] ${updated} tarefas canceladas para a conexão ${connectionId}`);
    return updated;
  }

  /**
   * Consulta o estado atual de uma tarefa de autodestruição.
   */
  public static async getTaskStatus(connectionId: string, stanzaId: string): Promise<AutoDestructTask | null> {
    return AutoDestructTask.findOne({ where: { connectionId, stanzaId } });
  }

  /**
   * Varredura paginada na inicialização do servidor para restaurar tarefas pendentes persistidas no PostgreSQL.
   */
  public static async init() {
    try {
      console.log('[AutoDestruct] Restaurando tarefas de autodestruição persistidas no banco...');
      const BATCH_SIZE = 100;
      let offset = 0;
      let totalRecovered = 0;
      let hasMore = true;
      const now = Date.now();

      while (hasMore) {
        const pendingTasks = await AutoDestructTask.findAll({
          where: {
            status: ['scheduled', 'retrying'],
          },
          order: [['executeAt', 'ASC']],
          limit: BATCH_SIZE,
          offset,
        });

        if (pendingTasks.length === 0) {
          hasMore = false;
          break;
        }

        for (const task of pendingTasks) {
          const taskKey = this.getTaskKey(task.connectionId, task.stanzaId);
          const executeMs = new Date(task.executeAt).getTime();
          const remainingMs = executeMs - now;

          if (remainingMs <= 0) {
            // Já expirou enquanto o servidor estava offline: executa com leve delay escalonado
            const staggerDelay = (totalRecovered % 20) * 200 + 1000;
            console.log(`[AutoDestruct] Tarefa vencida ${task.stanzaId}. Disparando revogação em ${staggerDelay}ms...`);
            setTimeout(() => {
              this.executeRevoke(task.connectionId, task.stanzaId);
            }, staggerDelay);
          } else {
            // Ainda dentro do prazo: agenda timer em memória
            console.log(`[AutoDestruct] Tarefa pendente ${task.stanzaId} expira em ${Math.round(remainingMs / 1000)}s. Agendando timer...`);
            const timer = setTimeout(async () => {
              this.activeTimers.delete(taskKey);
              await this.executeRevoke(task.connectionId, task.stanzaId);
            }, remainingMs);

            this.activeTimers.set(taskKey, timer);
          }
          totalRecovered++;
        }

        offset += pendingTasks.length;
        if (pendingTasks.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      console.log(`[AutoDestruct] Inicialização concluída: ${totalRecovered} tarefas restauradas.`);
    } catch (err: any) {
      console.error('[AutoDestruct] Erro ao restaurar tarefas de autodestruição:', err?.message || err);
    }
  }
}
