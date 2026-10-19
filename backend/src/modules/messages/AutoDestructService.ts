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

  /**
   * Agenda a revogação automática (apagar para todos no WhatsApp) da mensagem após delaySeconds.
   * Funciona para todos os tipos (botões, listas, carrossel, webviews, proto raw e texto).
   * Garante que a mensagem suma do celular de forma real no WhatsApp.
   */
  public static scheduleAutoDestruct(task: AutoDestructTask) {
    const { stanzaId, delaySeconds } = task;

    if (!stanzaId || !delaySeconds || delaySeconds <= 0) return;

    // Cancela timer anterior caso já exista para esta stanzaId
    if (this.activeTimers.has(stanzaId)) {
      clearTimeout(this.activeTimers.get(stanzaId)!);
      this.activeTimers.delete(stanzaId);
    }

    // Node.js setTimeout máximo suportado é ~24.8 dias (2147483647 ms)
    const ms = Math.min(delaySeconds * 1000, 2147483647);

    console.log(`[AutoDestruct] ⏳ Mensagem ${stanzaId} programada para sumir no WhatsApp em ${delaySeconds}s`);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(stanzaId);
      await this.executeRevoke(task);
    }, ms);

    this.activeTimers.set(stanzaId, timer);
  }

  /**
   * Executa a revogação da mensagem para todos no WhatsApp e atualiza o banco e socket.
   */
  public static async executeRevoke(task: AutoDestructTask) {
    const { connectionId, conversationId, stanzaId, delaySeconds } = task;
    let targetJid = task.targetJid;

    try {
      const zapoManager = ZapoConnectionManager.getInstance();
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        console.warn(`[AutoDestruct] Cliente WhatsApp não conectado para conexão ${connectionId}`);
        return;
      }

      if (!targetJid && conversationId) {
        const conv = await Conversation.findByPk(conversationId);
        if (conv?.jid) targetJid = conv.jid;
      }

      if (!targetJid) {
        const msg = await Message.findOne({ where: { connectionId, stanzaId } });
        if (msg?.conversationId) {
          const conv = await Conversation.findByPk(msg.conversationId);
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
    }
  }

  public static cancel(stanzaId: string) {
    if (this.activeTimers.has(stanzaId)) {
      clearTimeout(this.activeTimers.get(stanzaId)!);
      this.activeTimers.delete(stanzaId);
      console.log(`[AutoDestruct] Timer de autodestruição cancelado para ${stanzaId}`);
    }
  }

  /**
   * Varredura inicial ao subir o servidor para agendar mensagens temporárias que ainda não expiraram
   * ou revogar aquelas cujo tempo já se esgotou.
   */
  public static async init() {
    try {
      console.log('[AutoDestruct] Verificando mensagens temporárias pendentes...');
      const pendingMessages = await Message.findAll({
        where: {
          fromMe: true,
          isRevoked: false,
        },
        order: [['timestamp', 'DESC']],
        limit: 100,
      });

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
      }
    } catch (err: any) {
      console.error('[AutoDestruct] Erro ao inicializar varredura de autodestruição:', err?.message || err);
    }
  }
}
