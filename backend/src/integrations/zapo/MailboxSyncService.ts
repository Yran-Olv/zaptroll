import { proto } from 'zapo-js';
import { sequelize } from '../../database/index.js';
import {
  WhatsAppConnection,
  Conversation,
  Message,
  Contact,
  Group,
} from '../../database/models/index.js';
import { emitToConnection, emitToUser } from '../../modules/realtime/socket.js';

function formatPhoneNumber(phoneOrJid: string): string {
  if (!phoneOrJid) return '';
  const clean = phoneOrJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  if (clean.length >= 10) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }
  return phoneOrJid;
}

export interface DecodedMailboxMessage {
  messageType: string;
  content: string;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaFilename: string | null;
  mediaMimetype: string | null;
  rawPayload: any;
  contextInfo: any | null;
}

export class MailboxSyncService {
  /**
   * Decodes raw protobuf bytes into friendly message attributes
   */
  static decodeMessageBytes(buf: Buffer): DecodedMailboxMessage | null {
    try {
      const msg = proto.Message.decode(buf);

      // Skip internal synchronization / protocol control messages
      if (msg.protocolMessage && !msg.protocolMessage.key?.id) {
        return null;
      }

      let messageType = 'text';
      let content = '[Mensagem]';
      let caption: string | null = null;
      let thumbnailUrl: string | null = null;
      let mediaFilename: string | null = null;
      let mediaMimetype: string | null = null;

      if (msg.conversation) {
        content = msg.conversation;
      } else if (msg.extendedTextMessage?.text) {
        content = msg.extendedTextMessage.text;
      } else if (msg.imageMessage) {
        messageType = 'image';
        caption = msg.imageMessage.caption || null;
        content = caption ? `📷 ${caption}` : '📷 Imagem';
        mediaMimetype = msg.imageMessage.mimetype || 'image/jpeg';
        if (msg.imageMessage.jpegThumbnail) {
          thumbnailUrl =
            'data:image/jpeg;base64,' + Buffer.from(msg.imageMessage.jpegThumbnail).toString('base64');
        }
      } else if (msg.videoMessage) {
        messageType = 'video';
        caption = msg.videoMessage.caption || null;
        content = caption ? `🎥 ${caption}` : '🎥 Vídeo';
        mediaMimetype = msg.videoMessage.mimetype || 'video/mp4';
        if (msg.videoMessage.jpegThumbnail) {
          thumbnailUrl =
            'data:image/jpeg;base64,' + Buffer.from(msg.videoMessage.jpegThumbnail).toString('base64');
        }
      } else if (msg.audioMessage) {
        messageType = 'audio';
        content = msg.audioMessage.ptt ? '🎤 Mensagem de Voz' : '🎵 Áudio';
        mediaMimetype = msg.audioMessage.mimetype || 'audio/ogg';
      } else if (msg.documentMessage) {
        messageType = 'document';
        mediaFilename = msg.documentMessage.fileName || 'Documento';
        caption = msg.documentMessage.caption || null;
        content = `📄 ${mediaFilename}`;
        mediaMimetype = msg.documentMessage.mimetype || 'application/octet-stream';
        if (msg.documentMessage.jpegThumbnail) {
          thumbnailUrl =
            'data:image/jpeg;base64,' +
            Buffer.from(msg.documentMessage.jpegThumbnail).toString('base64');
        }
      } else if (msg.stickerMessage) {
        messageType = 'sticker';
        content = 'Sticker';
        mediaMimetype = msg.stickerMessage.mimetype || 'image/webp';
      } else if (msg.buttonsMessage) {
        messageType = 'buttons';
        content = '🔘 Mensagem com Botões';
      } else if (msg.listMessage) {
        messageType = 'list';
        content = '📋 Menu de Opções';
      } else if (msg.interactiveMessage) {
        if (msg.interactiveMessage?.carouselMessage) {
          messageType = 'carousel';
          content = '🎠 Carrossel Interativo';
        } else {
          messageType = 'interactive';
          content = '⚡ Mensagem Interativa';
        }
      }

      // Context Info / Quotes
      const rawCtx =
        msg.extendedTextMessage?.contextInfo ||
        msg.imageMessage?.contextInfo ||
        msg.videoMessage?.contextInfo ||
        msg.audioMessage?.contextInfo ||
        msg.documentMessage?.contextInfo ||
        msg.stickerMessage?.contextInfo;

      let contextInfo: any = null;
      if (rawCtx?.stanzaId) {
        const qMsg = rawCtx.quotedMessage;
        const quotedText =
          qMsg?.conversation ||
          qMsg?.extendedTextMessage?.text ||
          qMsg?.imageMessage?.caption ||
          (qMsg?.imageMessage ? '📷 Foto' : null) ||
          qMsg?.videoMessage?.caption ||
          (qMsg?.videoMessage ? '🎥 Vídeo' : null) ||
          (qMsg?.audioMessage ? (qMsg.audioMessage.ptt ? '🎤 Áudio' : '🎵 Áudio') : null) ||
          (qMsg?.documentMessage ? `📄 ${qMsg.documentMessage.fileName || 'Doc'}` : null) ||
          '';

        contextInfo = {
          stanzaId: rawCtx.stanzaId,
          participant: rawCtx.participant || null,
          quotedSender: 'Mensagem',
          quotedText: quotedText || 'Mensagem',
        };
      }

      return {
        messageType,
        content,
        caption,
        thumbnailUrl,
        mediaFilename,
        mediaMimetype,
        rawPayload: msg,
        contextInfo,
      };
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes all contacts, threads and recent messages from the Zapo mailbox into app models
   */
  static async syncConnection(connectionId: string, userId: string): Promise<{ syncedConversations: number; syncedContacts: number }> {
    try {
      console.log(`[MailboxSyncService] Starting mailbox sync for connection ${connectionId}...`);
      const connection = await WhatsAppConnection.findByPk(connectionId);
      if (!connection) return { syncedConversations: 0, syncedContacts: 0 };

      const sessionId = connection.sessionId;
      const cleanUserPhone = connection.phoneNumber ? connection.phoneNumber.replace(/\D/g, '') : '';

      // 1. Sync Contacts from wa_mailbox_contacts
      const [rawContacts]: any = await sequelize.query(
        `SELECT jid, display_name, push_name, lid, phone_number 
         FROM wa_mailbox_contacts 
         WHERE session_id = :sessionId`,
        { replacements: { sessionId } }
      );

      const contactNameByJid = new Map<string, string>();
      let syncedContactsCount = 0;

      for (const rc of rawContacts) {
        const bestName = (rc.display_name || rc.push_name || '').trim();
        const pNum = rc.phone_number ? rc.phone_number.split('@')[0] : (rc.jid.includes('@s.whatsapp.net') ? rc.jid.split('@')[0] : null);

        if (bestName) {
          contactNameByJid.set(rc.jid, bestName);
          if (rc.lid) contactNameByJid.set(rc.lid, bestName);
          if (rc.phone_number) contactNameByJid.set(rc.phone_number, bestName);
        }

        if (bestName || pNum) {
          await Contact.upsert({
            connectionId,
            jid: rc.jid,
            name: bestName || (pNum ? formatPhoneNumber(pNum) : rc.jid.split('@')[0]),
            notifyName: rc.push_name || rc.display_name || null,
            phoneNumber: pNum,
          }).catch(() => {});
          syncedContactsCount++;
        }
      }

      // Map group names
      const groups = await Group.findAll({ where: { connectionId } });
      const groupNameByJid = new Map<string, string>();
      for (const g of groups) {
        if (g.name && !g.name.startsWith('Grupo 12036')) {
          groupNameByJid.set(g.jid, g.name);
        }
      }

      // 2. Sync Threads from wa_mailbox_threads
      const [rawThreads]: any = await sequelize.query(
        `SELECT jid, name, unread_count, archived, pinned 
         FROM wa_mailbox_threads 
         WHERE session_id = :sessionId 
         ORDER BY pinned DESC NULLS LAST, unread_count DESC`,
        { replacements: { sessionId } }
      );

      let syncedConversationsCount = 0;

      for (const t of rawThreads) {
        if (!t.jid || t.jid === 'status@broadcast') continue;

        const isGroup = t.jid.endsWith('@g.us');
        const isNewsletter = t.jid.includes('@newsletter');
        const chatType = isGroup ? 'group' : isNewsletter ? 'newsletter' : 'direct';
        const rawId = t.jid.split('@')[0];
        const isSelf = cleanUserPhone && (t.jid.includes(cleanUserPhone) || rawId === cleanUserPhone);

        let chatName: string;
        if (isSelf) {
          chatName = 'Você (Mensagens Salvas)';
        } else if (isGroup) {
          chatName = groupNameByJid.get(t.jid) || t.name || `Grupo ${rawId.slice(0, 8)}`;
        } else if (isNewsletter) {
          chatName = t.name || (t.jid.includes('120363194378500802') ? 'Canaltech (CT Responde)' : 'Canal WhatsApp');
        } else {
          chatName = contactNameByJid.get(t.jid) || t.name || (t.jid.includes('@lid') ? 'Contato WhatsApp' : formatPhoneNumber(rawId));
        }

        // Fetch most recent message for this thread to have correct text and timestamp
        const [recentMsgRows]: any = await sequelize.query(
          `SELECT message_id, from_me, timestamp_ms, message_bytes 
           FROM wa_mailbox_messages 
           WHERE session_id = :sessionId AND thread_jid = :threadJid AND message_bytes IS NOT NULL 
           ORDER BY timestamp_ms DESC 
           LIMIT 1`,
          { replacements: { sessionId, threadJid: t.jid } }
        );

        let lastMessageText = 'Conversa iniciada';
        let lastMessageTimestamp = new Date();

        if (recentMsgRows && recentMsgRows.length > 0) {
          const rMsg = recentMsgRows[0];
          lastMessageTimestamp = rMsg.timestamp_ms ? new Date(Number(rMsg.timestamp_ms)) : new Date();
          const decoded = MailboxSyncService.decodeMessageBytes(rMsg.message_bytes);
          if (decoded?.content) {
            lastMessageText = decoded.content;
          }
        }

        let conv = await Conversation.findOne({
          where: { connectionId, jid: t.jid },
        });

        if (!conv) {
          conv = await Conversation.create({
            connectionId,
            jid: t.jid,
            chatType,
            name: chatName,
            unreadCount: t.unread_count || 0,
            lastMessageText,
            lastMessageTimestamp,
          });
        } else {
          // Update details
          if (!conv.name || conv.name.includes('@') || conv.name.startsWith('Grupo 12036')) {
            conv.name = chatName;
          }
          if (t.unread_count !== undefined && t.unread_count !== null) {
            conv.unreadCount = t.unread_count;
          }
          conv.lastMessageText = lastMessageText;
          conv.lastMessageTimestamp = lastMessageTimestamp;
          await conv.save();
        }

        syncedConversationsCount++;
      }

      console.log(
        `[MailboxSyncService] Synced ${syncedConversationsCount} conversations and ${syncedContactsCount} contacts.`
      );

      // Emit real-time notification to client
      emitToConnection(connectionId, 'conversations_synced', {
        connectionId,
        count: syncedConversationsCount,
      });
      emitToUser(userId, 'conversations_synced', {
        connectionId,
        count: syncedConversationsCount,
      });

      return {
        syncedConversations: syncedConversationsCount,
        syncedContacts: syncedContactsCount,
      };
    } catch (err: any) {
      console.error('[MailboxSyncService] Error during mailbox sync:', err);
      return { syncedConversations: 0, syncedContacts: 0 };
    }
  }

  /**
   * Syncs historical messages for a specific conversation on-demand
   */
  static async syncMessagesForConversation(
    connectionId: string,
    conversationId: string,
    jid: string,
    limit = 50
  ): Promise<number> {
    try {
      const connection = await WhatsAppConnection.findByPk(connectionId);
      if (!connection) return 0;

      const sessionId = connection.sessionId;

      const [msgRows]: any = await sequelize.query(
        `SELECT message_id, thread_jid, sender_jid, participant_jid, from_me, timestamp_ms, message_bytes 
         FROM wa_mailbox_messages 
         WHERE session_id = :sessionId AND thread_jid = :jid AND message_bytes IS NOT NULL 
         ORDER BY timestamp_ms DESC 
         LIMIT :limit`,
        { replacements: { sessionId, jid, limit } }
      );

      if (!msgRows || msgRows.length === 0) return 0;

      let insertedCount = 0;

      for (const r of msgRows) {
        const decoded = MailboxSyncService.decodeMessageBytes(r.message_bytes);
        if (!decoded) continue;

        const stanzaId = r.message_id;
        const fromMe = Boolean(r.from_me);
        const timestamp = r.timestamp_ms ? new Date(Number(r.timestamp_ms)) : new Date();

        const [msg, created] = await Message.findOrCreate({
          where: { connectionId, stanzaId },
          defaults: {
            connectionId,
            conversationId,
            stanzaId,
            senderJid: fromMe ? 'me' : (r.participant_jid || r.sender_jid || r.thread_jid),
            fromMe,
            messageType: decoded.messageType,
            content: decoded.content,
            caption: decoded.caption,
            mediaUrl: null,
            mediaMimetype: decoded.mediaMimetype,
            mediaFilename: decoded.mediaFilename,
            thumbnailUrl: decoded.thumbnailUrl,
            rawPayload: decoded.rawPayload,
            status: fromMe ? 'sent' : 'delivered',
            timestamp,
            isRevoked: false,
            participant: r.participant_jid || null,
          },
        });

        if (created) insertedCount++;
      }

      return insertedCount;
    } catch (err: any) {
      console.error('[MailboxSyncService] Error syncing messages for conversation:', err.message);
      return 0;
    }
  }
}
