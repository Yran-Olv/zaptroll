import { ZapoConnectionManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { Message, Conversation } from '../../database/models/index.js';
import { emitToConnection } from '../realtime/socket.js';

export interface AutoDestructTask {
  connectionId: string;
  conversationId: string;
  targetJid?: string;
  stanzaId: string;
  delaySeconds: number;
}

export class AutoDestructService {
  private static activeTimers = new Map<string, NodeJS.Timeout>();
  private static retryCounts = new Map<string, number>();

  // Limite máximo suportado pelo setTimeout em 32-bit signed int (~24.85 dias)
  public static readonly MAX_TIMEOUT_MS = 2147483647;
  public static readonly MAX_RETRIES = 5;
  public static readonly RETRY_DELAYS_SEC = [10, 30, 60, 120, 300];

  /**
   * Gera a chave composta única da tarefa baseada em [connectionId, stanzaId]
   */
  public static getTaskKey(connectionId: string, stanzaId: string): string {
    return JSON.stringify([connectionId, stanzaId]);
  }

  /**
   * Retorna a quantidade de timers ativos no momento (útil para testes e diagnósticos)
   */
  public static getActiveTimersCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Agenda a revogação automática (apagar para todos no WhatsApp) da mensagem após delaySeconds.
   * Suporta prazos de qualquer duração dividindo em fatias seguras para o Node.js setTimeout.
   */
  public static scheduleAutoDestruct(task: AutoDestructTask) {
    const { connectionId, stanzaId, delaySeconds } = task;

    if (!connectionId || !stanzaId || !delaySeconds || delaySeconds <= 0) return;

    const taskKey = this.getTaskKey(connectionId, stanzaId);

    // Cancela timer anterior caso já exista para esta chave composta
    if (this.activeTimers.has(taskKey)) {
      clearTimeout(this.activeTimers.get(taskKey)!);
      this.activeTimers.delete(taskKey);
    }

    const totalMs = delaySeconds * 1000;

    // Se o prazo for superior ao limite do Node.js (~24.8 dias), agenda fatia máxima e reagenda o restante
    if (totalMs > this.MAX_TIMEOUT_MS) {
      console.log(`[AutoDestruct] ⏳ Mensagem ${stanzaId} tem expiração longa (${delaySeconds}s). Agendando fatia de ${Math.floor(this.MAX_TIMEOUT_MS / 1000)}s...`);
      const timer = setTimeout(() => {
        this.activeTimers.delete(taskKey);
        const remainingSeconds = Math.max(1, delaySeconds - Math.floor(this.MAX_TIMEOUT_MS / 1000));
        this.scheduleAutoDestruct({ ...task, delaySeconds: remainingSeconds });
      }, this.MAX_TIMEOUT_MS);

      this.activeTimers.set(taskKey, timer);
      return;
    }

    console.log(`[AutoDestruct] ⏳ Mensagem ${stanzaId} [${connectionId}] programada para sumir no WhatsApp em ${delaySeconds}s`);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(taskKey);
      await this.executeRevoke(task);
    }, totalMs);

    this.activeTimers.set(taskKey, timer);
  }

  /**
   * Executa a revogação da mensagem para todos no WhatsApp com retentativas progressivas em caso de falha.
   */
  public static async executeRevoke(task: AutoDestructTask) {
    const { connectionId, conversationId, stanzaId, delaySeconds } = task;
    const taskKey = this.getTaskKey(connectionId, stanzaId);
    let targetJid = task.targetJid;

    try {
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        console.warn(`[AutoDestruct] Cliente WhatsApp não conectado para conexão ${connectionId}. Reagendando tentativa...`);
        this.scheduleRetry(task, 'Cliente WhatsApp não conectado');
        return;
      }

      if (!targetJid && conversationId) {
        const conv = await Conversation.findOne({ where: { id: conversationId, connectionId } });
        if (conv?.jid) targetJid = conv.jid;
      }

      if (!targetJid) {
        const msg = await Message.findOne({ where: { connectionId, stanzaId } });
        if (msg?.conversationId) {
          const conv = await Conversation.findOne({ where: { id: msg.conversationId, connectionId } });
          if (conv?.jid) targetJid = conv.jid;
        }
      }

      if (!targetJid) {
        console.warn(`[AutoDestruct] Não foi possível determinar targetJid para revogar ${stanzaId}`);
        return;
      }

      console.log(`[AutoDestruct] 🚀 Executando revogação no WhatsApp para apagar mensagem ${stanzaId} em ${targetJid}...`);

      // Dispara a revogação no protocolo WhatsApp (apagar para todos)
      await ZapoMessageAdapter.revokeMessage(client, targetJid, {
        stanzaId,
        fromMe: true,
      });

      // Sucesso na revogação: limpar estados e retries
      this.retryCounts.delete(taskKey);
      this.activeTimers.delete(taskKey);

      // Atualiza o registro no banco de dados local
      const msg = await Message.findOne({ where: { connectionId, stanzaId } });
      if (msg) {
        await msg.update({
          isRevoked: true,
          status: 'revoked',
          content: '🚫 Esta mensagem foi apagada',
        });
      }

      // Emite atualização em tempo real via Socket.io
      emitToConnection(connectionId, 'message_status', {
        connectionId,
        stanzaId,
        status: 'revoked',
        isRevoked: true,
        content: '🚫 Esta mensagem foi apagada',
      });

      console.log(`[AutoDestruct] ✅ Mensagem ${stanzaId} apagada com sucesso no celular após ${delaySeconds}s!`);
    } catch (err: any) {
      console.error(`[AutoDestruct] Erro ao revogar automaticamente ${stanzaId}:`, err?.message || err);
      this.scheduleRetry(task, err?.message || 'Falha no envio de revogação');
    }
  }

  /**
   * Reagenda tentativa de revogação com backoff progressivo quando o cliente estiver temporariamente desconectado
   */
  private static scheduleRetry(task: AutoDestructTask, reason: string) {
    const { connectionId, stanzaId } = task;
    const taskKey = this.getTaskKey(connectionId, stanzaId);
    const currentRetries = this.retryCounts.get(taskKey) || 0;

    if (currentRetries >= this.MAX_RETRIES) {
      console.error(`[AutoDestruct] ❌ Limite de ${this.MAX_RETRIES} tentativas excedido para ${stanzaId} (${connectionId}). Motivo: ${reason}`);
      this.retryCounts.delete(taskKey);
      return;
    }

    const backoffSec = this.RETRY_DELAYS_SEC[currentRetries] || 300;
    this.retryCounts.set(taskKey, currentRetries + 1);

    console.log(`[AutoDestruct] 🔄 Reagendando tentativa ${currentRetries + 1}/${this.MAX_RETRIES} para ${stanzaId} em ${backoffSec}s (motivo: ${reason})...`);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(taskKey);
      await this.executeRevoke(task);
    }, backoffSec * 1000);

    this.activeTimers.set(taskKey, timer);
  }

  /**
   * Cancela o timer de autodestruição para uma conexão e mensagem específicas
   */
  public static cancel(connectionId: string, stanzaId?: string) {
    if (!stanzaId) {
      // Compatibilidade retroativa caso chamado apenas com stanzaId
      const targetStanza = connectionId;
      for (const [key, timer] of this.activeTimers.entries()) {
        try {
          const parsed = JSON.parse(key);
          if (parsed[1] === targetStanza) {
            clearTimeout(timer);
            this.activeTimers.delete(key);
            this.retryCounts.delete(key);
            console.log(`[AutoDestruct] Timer de autodestruição cancelado para ${targetStanza}`);
          }
        } catch {}
      }
      return;
    }

    const taskKey = this.getTaskKey(connectionId, stanzaId);
    if (this.activeTimers.has(taskKey)) {
      clearTimeout(this.activeTimers.get(taskKey)!);
      this.activeTimers.delete(taskKey);
      this.retryCounts.delete(taskKey);
      console.log(`[AutoDestruct] Timer de autodestruição cancelado para ${stanzaId} [${connectionId}]`);
    }
  }

  /**
   * Varredura inicial paginada ao subir o servidor para agendar todas as mensagens temporárias pendentes
   * que ainda não expiraram ou revogar aquelas cujo tempo já se esgotou.
   */
  public static async init() {
    try {
      console.log('[AutoDestruct] Verificando mensagens temporárias pendentes em lotes...');
      const BATCH_SIZE = 100;
      let offset = 0;
      let totalProcessed = 0;
      let hasMore = true;

      while (hasMore) {
        const pendingMessages = await Message.findAll({
          where: {
            fromMe: true,
            isRevoked: false,
          },
          order: [['timestamp', 'ASC']],
          limit: BATCH_SIZE,
          offset,
        });

        if (pendingMessages.length === 0) {
          hasMore = false;
          break;
        }

        for (const msg of pendingMessages) {
          if (msg.messageType === 'ephemeral_message') continue;
          const raw = msg.rawPayload;
          if (!raw) continue;
          const expSeconds = raw.expirationSeconds || raw.duration || raw.seconds;
          if (!expSeconds || Number(expSeconds) <= 0) continue;

          const seconds = Number(expSeconds);
          const sentAt = new Date(msg.timestamp).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - sentAt) / 1000);
          const remaining = seconds - elapsed;

          if (remaining <= 0) {
            console.log(`[AutoDestruct] Mensagem pendente expirada ${msg.stanzaId} (expirou há ${-remaining}s). Revogando em 3s...`);
            setTimeout(() => {
              this.executeRevoke({
                connectionId: msg.connectionId,
                conversationId: msg.conversationId,
                stanzaId: msg.stanzaId,
                delaySeconds: seconds,
              });
            }, 3000);
          } else {
            console.log(`[AutoDestruct] Mensagem pendente ${msg.stanzaId} expira em ${remaining}s. Agendando autodestruição...`);
            this.scheduleAutoDestruct({
              connectionId: msg.connectionId,
              conversationId: msg.conversationId,
              stanzaId: msg.stanzaId,
              delaySeconds: remaining,
            });
          }
          totalProcessed++;
        }

        offset += pendingMessages.length;
        if (pendingMessages.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      console.log(`[AutoDestruct] Varredura de inicialização concluída: ${totalProcessed} mensagens temporárias processadas.`);
    } catch (err: any) {
      console.error('[AutoDestruct] Erro ao inicializar varredura de autodestruição:', err?.message || err);
    }
  }
}
