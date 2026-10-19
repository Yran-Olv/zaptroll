import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { Conversation, WhatsAppConnection, Message, Contact } from '../../database/models/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import {
  textMessageSchema,
  buttonsMessageSchema,
  listMessageSchema,
  webviewMessageSchema,
  ephemeralSettingSchema,
  singleMessageEphemeralSchema,
  revokeMessageSchema,
  rawProtoSchema,
  carouselMessageSchema,
} from '../../integrations/zapo/ZapoPayloadValidator.js';
import { emitToConnection } from '../realtime/socket.js';
import { MailboxSyncService } from '../../integrations/zapo/MailboxSyncService.js';
import { AutoDestructService } from './AutoDestructService.js';
import { MemeFlowService } from '../memes/MemeFlowService.js';

export class MessagesController {
  static async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = (page - 1) * limit;

      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: WhatsAppConnection,
            as: 'connection',
            where: { userId: req.user!.id },
          },
        ],
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversa não encontrada ou não autorizada.' });
        return;
      }

      // Mark conversation as read whenever user loads message history
      if (conversation.unreadCount > 0) {
        conversation.unreadCount = 0;
        await conversation.save().catch(() => {});
      }

      let { count, rows: messages } = await Message.findAndCountAll({
        where: { conversationId },
        order: [['timestamp', 'ASC']],
        limit,
        offset,
      });

      // If no messages stored yet for this conversation, fetch & populate from Zapo mailbox
      if (messages.length === 0 && conversation.jid) {
        await MailboxSyncService.syncMessagesForConversation(
          conversation.connectionId,
          conversation.id,
          conversation.jid,
          limit
        );

        const refetched = await Message.findAndCountAll({
          where: { conversationId },
          order: [['timestamp', 'ASC']],
          limit,
          offset,
        });
        count = refetched.count;
        messages = refetched.rows;
      }

      // Self-heal thumbnail for existing media messages that have rawPayload thumbnail
      for (const msg of messages) {
        if (!msg.thumbnailUrl && msg.rawPayload) {
          const img = msg.rawPayload.imageMessage;
          const vid = msg.rawPayload.videoMessage;
          const doc = msg.rawPayload.documentMessage;
          const thumb = img?.jpegThumbnail || vid?.jpegThumbnail || doc?.jpegThumbnail;
          if (thumb) {
            try {
              const bytes = thumb.data ? thumb.data : (Array.isArray(thumb) ? thumb : Object.values(thumb));
              const buf = Buffer.isBuffer(thumb) ? thumb : Buffer.from(bytes as any);
              msg.thumbnailUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
              msg.save().catch(() => {});
            } catch {}
          }
        }
      }

      res.json({
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        messages,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async send(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, conversationId, recipientJid, type, payload, quotedStanzaId } = req.body;

      if (!connectionId || (!conversationId && !recipientJid)) {
        res.status(400).json({ error: 'connectionId e (conversationId ou recipientJid) são obrigatórios.' });
        return;
      }

      // Check connection ownership
      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({
          error: 'Esta sessão do WhatsApp não está ativa. Por favor, conecte a sessão antes de enviar mensagens.',
        });
        return;
      }

      // Resolve recipient JID and conversation
      let targetJid = recipientJid;
      let convRecord: Conversation | null = null;

      if (conversationId) {
        convRecord = await Conversation.findByPk(conversationId);
        if (convRecord) {
          targetJid = convRecord.jid;
        }
      }

      if (!targetJid) {
        res.status(400).json({ error: 'Destinatário JID não pôde ser determinado.' });
        return;
      }

      // Resolve quote if replying to a message
      const quoteId = quotedStanzaId || payload?.quotedStanzaId;
      let quoteOptions: any = undefined;
      let quotedMsg: Message | null = null;

      if (quoteId) {
        quotedMsg = await Message.findOne({
          where: { connectionId, stanzaId: quoteId },
        });

        if (quotedMsg) {
          const isGroup = targetJid.endsWith('@g.us');
          let quoteMsgContent: any = {
            conversation: quotedMsg.content || quotedMsg.caption || 'Mensagem',
          };
          if (quotedMsg.rawPayload?.conversation) {
            quoteMsgContent = { conversation: quotedMsg.rawPayload.conversation };
          } else if (quotedMsg.rawPayload?.extendedTextMessage?.text) {
            quoteMsgContent = { conversation: quotedMsg.rawPayload.extendedTextMessage.text };
          }

          const myJid =
            (client as any).credentials?.meJid ||
            (connection.phoneNumber ? `${connection.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net` : undefined);

          quoteOptions = {
            id: quotedMsg.stanzaId,
            participant: isGroup
              ? (quotedMsg.fromMe ? myJid : (quotedMsg.senderJid === 'me' ? myJid : quotedMsg.senderJid))
              : (quotedMsg.fromMe ? undefined : (quotedMsg.senderJid === 'me' ? targetJid : quotedMsg.senderJid)),
            remoteJid: targetJid,
            fromMe: quotedMsg.fromMe,
            message: quoteMsgContent,
          };
        }
      }

      let sendResult: any;
      let storedContent = '';
      let msgType = type || 'text';
      let scheduledExpirationSeconds: number | undefined =
        payload?.expirationSeconds || payload?.duration || payload?.seconds
          ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
          : undefined;
      if (scheduledExpirationSeconds && (isNaN(scheduledExpirationSeconds) || scheduledExpirationSeconds <= 0)) {
        scheduledExpirationSeconds = undefined;
      }

      switch (type) {
        case 'text': {
          const validated = textMessageSchema.parse(payload);
          const ephemeralSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;

          if (ephemeralSeconds && ephemeralSeconds > 0) {
            // Mensagem Fantasma nativa que desaparece após a leitura pelo WhatsApp
            scheduledExpirationSeconds = undefined;
            sendResult = await ZapoMessageAdapter.sendEphemeralMessage(
              client,
              targetJid,
              validated.text,
              ephemeralSeconds,
              {
                afterReadDuration: payload.experimentalAfterRead || payload.afterReadDuration
                  ? Number(payload.afterReadDuration || ephemeralSeconds)
                  : ephemeralSeconds,
                quote: quoteOptions,
              }
            );
            storedContent = `👻 [Fantasma (${ephemeralSeconds}s)]: ${validated.text}`;
            msgType = 'ephemeral_message';
          } else {
            sendResult = await ZapoMessageAdapter.sendText(client, targetJid, validated.text, {
              linkPreview: validated.linkPreview,
              quote: quoteOptions,
            });
            storedContent = validated.text;
          }
          break;
        }

        case 'buttons': {
          const validated = buttonsMessageSchema.parse(payload);
          const expSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;
          if (expSeconds && expSeconds > 0) {
            validated.expirationSeconds = expSeconds;
            scheduledExpirationSeconds = expSeconds;
          }
          sendResult = await ZapoMessageAdapter.sendButtons(client, targetJid, validated);
          storedContent = expSeconds && expSeconds > 0
            ? `⏳ [Botões Temporários (${expSeconds}s): ${validated.contentText}]`
            : `[Botões: ${validated.contentText}]`;
          break;
        }

        case 'list': {
          const validated = listMessageSchema.parse(payload);
          const expSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;
          if (expSeconds && expSeconds > 0) {
            validated.expirationSeconds = expSeconds;
            scheduledExpirationSeconds = expSeconds;
          }
          sendResult = await ZapoMessageAdapter.sendList(client, targetJid, validated);
          storedContent = expSeconds && expSeconds > 0
            ? `⏳ [Menu Temporário (${expSeconds}s): ${validated.title}]`
            : `[Menu: ${validated.title} - ${validated.description}]`;
          break;
        }

        case 'webview': {
          const validated = webviewMessageSchema.parse(payload);
          const expSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;
          if (expSeconds && expSeconds > 0) {
            validated.expirationSeconds = expSeconds;
            scheduledExpirationSeconds = expSeconds;
          }
          sendResult = await ZapoMessageAdapter.sendWebview(client, targetJid, validated);
          storedContent = expSeconds && expSeconds > 0
            ? `⏳ [Webview Temporário (${expSeconds}s): ${validated.bodyText} -> ${validated.url}]`
            : `[Webview: ${validated.bodyText} -> ${validated.url}]`;
          break;
        }

        case 'carousel': {
          let validated: any = payload;
          if (payload.cards && Array.isArray(payload.cards)) {
            validated = carouselMessageSchema.parse(payload);
          }

          const expSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;

          if (expSeconds && expSeconds > 0) {
            validated.expirationSeconds = expSeconds;
            scheduledExpirationSeconds = expSeconds;
          }

          sendResult = await ZapoMessageAdapter.sendCarousel(client, targetJid, validated);
          const cardCount = validated.cards?.length || 0;
          if (expSeconds && expSeconds > 0) {
            storedContent = cardCount > 0 
              ? `⏳ [Carrossel Temporário (${expSeconds}s): ${validated.bodyText || 'Destaques'} — ${cardCount} ${cardCount === 1 ? 'cartão' : 'cartões'}]`
              : `⏳ [Carrossel Temporário (${expSeconds}s): ${payload.bodyText || 'Ações'}]`;
          } else {
            storedContent = cardCount > 0 
              ? `[Carrossel: ${validated.bodyText || 'Destaques'} — ${cardCount} ${cardCount === 1 ? 'cartão' : 'cartões'}]`
              : `[Carrossel: ${payload.bodyText || 'Ações'}]`;
          }
          break;
        }

        case 'ephemeral_setting':
        case 'ephemeral_chat': {
          const exp = Number(payload.ephemeralExpiration ?? payload.duration ?? payload.seconds ?? 0);
          const validated = ephemeralSettingSchema.parse({
            ephemeralExpiration: exp,
          });
          sendResult = await ZapoMessageAdapter.setChatEphemeral(client, targetJid, validated.ephemeralExpiration);
          storedContent = `[Configuração de Mensagens Temporárias: ${validated.ephemeralExpiration}s]`;
          msgType = 'ephemeral_setting';
          break;
        }

        case 'ephemeral':
        case 'ephemeral_single':
        case 'ephemeral_message': {
          const exp = Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds ?? 5);
          const validated = singleMessageEphemeralSchema.parse({
            ...payload,
            expirationSeconds: exp,
            experimentalAfterRead: true,
            afterReadDuration: exp,
          });
          // Mensagem Fantasma nativa WhatsApp (desaparece após ser lida sem deixar "Esta mensagem foi apagada")
          scheduledExpirationSeconds = undefined;
          sendResult = await ZapoMessageAdapter.sendEphemeralMessage(
            client,
            targetJid,
            validated.text,
            validated.expirationSeconds,
            {
              afterReadDuration: validated.afterReadDuration || exp,
              quote: quoteOptions,
            }
          );
          storedContent = `👻 [Fantasma (${validated.expirationSeconds}s)]: ${validated.text}`;
          msgType = 'ephemeral_message';
          break;
        }

        case 'raw': {
          const validated = rawProtoSchema.parse(payload);
          const expSeconds = payload.expirationSeconds || payload.duration || payload.seconds
            ? Number(payload.expirationSeconds ?? payload.duration ?? payload.seconds)
            : undefined;
          if (expSeconds && expSeconds > 0) {
            validated.expirationSeconds = expSeconds;
            scheduledExpirationSeconds = expSeconds;
          }
          sendResult = await ZapoMessageAdapter.sendRawProto(client, targetJid, validated.rawPayload, expSeconds);
          storedContent = expSeconds && expSeconds > 0
            ? `⏳ [Raw Proto Temporário (${expSeconds}s)]`
            : '[Envio de Código Raw Proto]';
          break;
        }

        default:
          res.status(400).json({ error: `Tipo de mensagem não suportado: ${type}` });
          return;
      }

      // Upsert Conversation if needed
      if (!convRecord) {
        convRecord = await Conversation.findOne({ where: { connectionId, jid: targetJid } });
      }

      if (!convRecord) {
        const isGroup = targetJid.endsWith('@g.us');
        convRecord = await Conversation.create({
          connectionId,
          jid: targetJid,
          chatType: isGroup ? 'group' : 'direct',
          name: isGroup ? 'Grupo ' + targetJid.slice(0, 8) : targetJid.split('@')[0],
          unreadCount: 0,
          lastMessageText: storedContent,
          lastMessageTimestamp: new Date(),
        });
      } else {
        convRecord.lastMessageText = storedContent;
        convRecord.lastMessageTimestamp = new Date();
        convRecord.status = 'open'; // Reopen closed conversation if sending message
        await convRecord.save();
      }

      const stanzaId = sendResult?.id || `out_${Date.now()}`;

      // Persist sent message with contextInfo so the quote is rendered cleanly
      let quoteSenderName = 'Mensagem';
      if (quotedMsg) {
        if (quotedMsg.fromMe) {
          quoteSenderName = 'Você';
        } else {
          const contact = await Contact.findOne({ where: { connectionId, jid: quotedMsg.senderJid } });
          quoteSenderName = contact?.name || contact?.notifyName || convRecord?.name || quotedMsg.senderJid.split('@')[0];
        }
      }

      const savedPayload = {
        ...(typeof payload === 'object' ? payload : { text: payload }),
        ...(scheduledExpirationSeconds && scheduledExpirationSeconds > 0
          ? { expirationSeconds: scheduledExpirationSeconds }
          : {}),
        ...(quotedMsg
          ? {
              contextInfo: {
                stanzaId: quotedMsg.stanzaId,
                participant: quotedMsg.fromMe ? 'me' : quotedMsg.senderJid,
                quotedSender: quoteSenderName,
                quotedText: quotedMsg.content || quotedMsg.caption || '',
                fromMe: quotedMsg.fromMe,
              },
            }
          : {}),
      };

      const savedMessage = await Message.create({
        connectionId,
        conversationId: convRecord.id,
        stanzaId,
        senderJid: 'me',
        fromMe: true,
        messageType: msgType,
        content: storedContent,
        rawPayload: savedPayload,
        status: 'sent',
        timestamp: new Date(),
        isRevoked: false,
      });

      // Se a mensagem possui expiração/duração temporária manual (ex: botões, carrossel, raw que o usuário pediu timer),
      // agenda autodestruição no WhatsApp (apagar para todos).
      // Mensagens efêmeras/fantasmas desaparecem nativamente pelo WhatsApp após a leitura e NÃO devem ser revogadas.
      if (scheduledExpirationSeconds && scheduledExpirationSeconds > 0 && msgType !== 'ephemeral_message') {
        AutoDestructService.scheduleAutoDestruct({
          connectionId,
          conversationId: convRecord.id,
          targetJid,
          stanzaId,
          delaySeconds: scheduledExpirationSeconds,
        });
      }

      emitToConnection(connectionId, 'new_message', {
        connectionId,
        message: savedMessage,
        conversation: convRecord,
      });

      // Gatilho Automático: Ao enviar emoji de jacaré 🐊, dispara o fluxo do Jacaré (áudio + figurinha)
      if (type === 'text' && typeof payload?.text === 'string' && payload.text.includes('🐊')) {
        if (MemeFlowService.shouldTrigger(stanzaId)) {
          setTimeout(async () => {
            try {
              await MemeFlowService.triggerJacareFlow({
                connectionId,
                conversationId: convRecord.id,
                recipientJid: targetJid,
              });
            } catch (flowErr) {
              console.error('[MemeFlow] Erro ao disparar fluxo do Jacaré via API send:', flowErr);
            }
          }, 400);
        }
      }

      res.status(200).json({
        success: true,
        stanzaId,
        sendResult,
        message: savedMessage,
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      res.status(400).json({ error: error.message || 'Falha ao enviar mensagem.' });
    }
  }

  static async revoke(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, stanzaId, conversationId } = req.body;
      const validated = revokeMessageSchema.parse({ stanzaId });

      // Cancela qualquer timer pendente para evitar execução duplicada
      AutoDestructService.cancel(validated.stanzaId);

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada.' });
        return;
      }

      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({ error: 'Sessão do WhatsApp não conectada.' });
        return;
      }

      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversa não encontrada.' });
        return;
      }

      // Execute revocation via Zapo
      await ZapoMessageAdapter.revokeMessage(client, conversation.jid, {
        stanzaId: validated.stanzaId,
        fromMe: true,
      });

      // Update message in database
      const msg = await Message.findOne({
        where: { connectionId, stanzaId: validated.stanzaId },
      });

      if (msg) {
        msg.status = 'revoked';
        msg.isRevoked = true;
        msg.content = '🚫 Esta mensagem foi apagada';
        await msg.save();
      }

      emitToConnection(connectionId, 'message_status', {
        connectionId,
        stanzaId: validated.stanzaId,
        status: 'revoked',
      });

      res.json({ success: true, message: 'Mensagem revogada com sucesso.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Falha ao revogar mensagem.' });
    }
  }
}
