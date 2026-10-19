import path from 'path';
import { WaClient } from 'zapo-js';
import {
  WhatsAppConnection,
  WhatsAppConnectionEvent,
  Conversation,
  Message,
  Contact,
  Group,
} from '../../database/models/index.js';
import { emitToConnection, emitToUser } from '../../modules/realtime/socket.js';
import { config } from '../../config/index.js';
import { sequelize } from '../../database/index.js';
import { MailboxSyncService } from './MailboxSyncService.js';
import { MemeFlowService } from '../../modules/memes/MemeFlowService.js';
import { StatusService } from '../../modules/advanced/StatusService.js';
import { MetaAiService } from '../../modules/advanced/MetaAiService.js';
import fs from 'node:fs';

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

export class ZapoEventHandler {
  /**
   * Synchronizes all groups from the connected WhatsApp account into the database
   * and updates corresponding conversation names.
   */
  static async syncGroups(client: WaClient, connectionId: string): Promise<any[]> {
    try {
      console.log(`[ZapoEventHandler] Starting group sync for connection ${connectionId}...`);
      const groups = await client.group.queryAllGroups();
      console.log(`[ZapoEventHandler] Fetched ${groups.length} groups from WhatsApp.`);

      const syncedGroups: any[] = [];
      for (const g of groups) {
        if (!g.jid) continue;
        const groupSubject = g.subject || 'Grupo WhatsApp';

        const [grp] = await Group.upsert({
          connectionId,
          jid: g.jid,
          name: groupSubject,
          description: g.desc || null,
          participantCount: g.participants?.length || 0,
          metadata: {
            creation: g.creation,
            owner: g.owner,
            restrict: g.restrict,
            announce: g.announce,
            participants: g.participants || [],
          },
          lastSyncAt: new Date(),
        });
        syncedGroups.push(grp);

        // Update conversation if it exists
        const conv = await Conversation.findOne({ where: { connectionId, jid: g.jid } });
        if (conv) {
          conv.name = groupSubject;
          conv.chatType = 'group';
          await conv.save();
        }
      }

      emitToConnection(connectionId, 'groups_synced', {
        connectionId,
        count: syncedGroups.length,
      });

      return syncedGroups;
    } catch (err: any) {
      console.error('[ZapoEventHandler] Error syncing groups:', err.message);
      return [];
    }
  }

  static attach(client: WaClient, connectionId: string, userId: string) {
    // 1. QR Code event
    client.on('auth_qr', async ({ qr, ttlMs }) => {
      try {
        await WhatsAppConnection.update(
          {
            qrCode: qr,
            status: 'awaiting_auth',
            lastError: null,
          },
          { where: { id: connectionId } }
        );

        await WhatsAppConnectionEvent.create({
          connectionId,
          eventType: 'auth_qr',
          payload: { qrLength: qr.length, ttlMs },
        });

        emitToConnection(connectionId, 'connection_qr', { connectionId, qr, ttlMs });
        emitToUser(userId, 'connection_qr', { connectionId, qr, ttlMs });
      } catch (err) {
        console.error('Error handling auth_qr:', err);
      }
    });

    // 2. Pairing Code event
    client.on('auth_pairing_code', async ({ code }) => {
      try {
        await WhatsAppConnection.update(
          {
            pairingCode: code,
            status: 'awaiting_auth',
            lastError: null,
          },
          { where: { id: connectionId } }
        );

        await WhatsAppConnectionEvent.create({
          connectionId,
          eventType: 'auth_pairing_code',
          payload: { code },
        });

        emitToConnection(connectionId, 'connection_pairing_code', { connectionId, code });
        emitToUser(userId, 'connection_pairing_code', { connectionId, code });
      } catch (err) {
        console.error('Error handling auth_pairing_code:', err);
      }
    });

    // 3. Paired event
    client.on('auth_paired', async ({ credentials }) => {
      try {
        const phone = credentials.meJid ? credentials.meJid.split('@')[0].split(':')[0] : null;

        await WhatsAppConnection.update(
          {
            status: 'connected',
            phoneNumber: phone,
            qrCode: null,
            pairingCode: null,
            lastConnectedAt: new Date(),
            lastError: null,
          },
          { where: { id: connectionId } }
        );

        await WhatsAppConnectionEvent.create({
          connectionId,
          eventType: 'auth_paired',
          payload: { meJid: credentials.meJid },
        });

        emitToConnection(connectionId, 'connection_status', {
          connectionId,
          status: 'connected',
          phoneNumber: phone,
        });
        emitToUser(userId, 'connection_status', {
          connectionId,
          status: 'connected',
          phoneNumber: phone,
        });

        // Trigger background group and mailbox sync once paired
        setTimeout(() => {
          ZapoEventHandler.syncGroups(client, connectionId).catch(() => {});
          MailboxSyncService.syncConnection(connectionId, userId).catch(() => {});
        }, 1500);
      } catch (err) {
        console.error('Error handling auth_paired:', err);
      }
    });

    // 4. Connection status changes
    client.on('connection', async (event: any) => {
      try {
        let mappedStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

        if (event.status === 'open') {
          mappedStatus = 'connected';
        } else if (event.status === 'connecting') {
          mappedStatus = 'connecting';
        } else if (event.status === 'close') {
          mappedStatus = event.reason ? 'error' : 'disconnected';
        }

        const updateData: any = { status: mappedStatus };
        if (mappedStatus === 'connected') {
          updateData.lastConnectedAt = new Date();
          updateData.lastError = null;
        } else if (mappedStatus === 'disconnected' || mappedStatus === 'error') {
          updateData.lastDisconnectedAt = new Date();
          if (event.reason) updateData.lastError = String(event.reason);
        }

        await WhatsAppConnection.update(updateData, { where: { id: connectionId } });

        await WhatsAppConnectionEvent.create({
          connectionId,
          eventType: 'connection',
          payload: { status: event.status, reason: event.reason },
        });

        emitToConnection(connectionId, 'connection_status', {
          connectionId,
          status: mappedStatus,
          reason: event.reason,
        });
        emitToUser(userId, 'connection_status', {
          connectionId,
          status: mappedStatus,
          reason: event.reason,
        });

        // Automatically sync groups and mailbox when connection opens
        if (event.status === 'open') {
          setTimeout(() => {
            ZapoEventHandler.syncGroups(client, connectionId).catch(() => {});
            MailboxSyncService.syncConnection(connectionId, userId).catch(() => {});
          }, 2000);
        }
      } catch (err) {
        console.error('Error handling connection event:', err);
      }
    });

    // 4.1 History Sync Chunks from Phone
    client.on('history_sync_chunk', async (event: any) => {
      try {
        console.log(`[ZapoEventHandler] history_sync_chunk for ${connectionId}: progress=${event.progress || 0}%`);
        emitToConnection(connectionId, 'history_sync_progress', {
          connectionId,
          progress: event.progress || 0,
          syncType: event.syncType,
        });
        emitToUser(userId, 'history_sync_progress', {
          connectionId,
          progress: event.progress || 0,
          syncType: event.syncType,
        });

        // Trigger sync of newly written mailbox records
        MailboxSyncService.syncConnection(connectionId, userId).catch(() => {});
      } catch (err) {
        console.error('Error handling history_sync_chunk:', err);
      }
    });

    // 5. Incoming Messages
    client.on('message', async (event: any) => {
      try {
        const remoteJid = event.key?.remoteJid;
        if (!remoteJid) return;

        // Captura de Status / Stories do WhatsApp (inclui broadcast e groupStatusMessageV2 de grupos)
        if (remoteJid === 'status@broadcast' || event.message?.groupStatusMessageV2) {
          const statusItem = await StatusService.captureStatus(connectionId, {
            stanzaId: event.key?.id,
            participant: event.key?.participant || event.participant || remoteJid,
            pushName: event.pushName,
            message: event.message?.groupStatusMessageV2?.message || event.message,
            timestamp: event.messageTimestamp,
          });
          emitToConnection(connectionId, 'status_received', statusItem);
          if (remoteJid === 'status@broadcast') return;
        }

        const stanzaId = event.key?.id;
        if (!stanzaId) return;

        const fromMe = Boolean(event.key?.fromMe);
        const participant = event.key?.participant || null;
        const isGroup = remoteJid.endsWith('@g.us');
        const isNewsletter = remoteJid.includes('@newsletter');
        const chatType = isGroup ? 'group' : isNewsletter ? 'newsletter' : 'direct';

        // 5.1 Protocol Message Handling (Revokes, History Sync, App State Sync)
        if (event.message?.protocolMessage) {
          const protoMsg = event.message.protocolMessage;
          // WhatsApp REVOKE protocol message (type 0 or message revocation)
          if (protoMsg.type === 0 || protoMsg.key?.id) {
            const targetStanzaId = protoMsg.key?.id;
            if (targetStanzaId) {
              await Message.update(
                {
                  status: 'revoked',
                  isRevoked: true,
                  content: '🚫 Esta mensagem foi apagada',
                },
                {
                  where: { connectionId, stanzaId: targetStanzaId },
                }
              );

              emitToConnection(connectionId, 'message_status', {
                connectionId,
                stanzaId: targetStanzaId,
                status: 'revoked',
              });
              emitToUser(userId, 'message_status', {
                connectionId,
                stanzaId: targetStanzaId,
                status: 'revoked',
              });
            }
          }
          // Do not store non-chat sync/protocol placeholders as conversational messages
          return;
        }

        // 5.2 Extract Name for Group or Contact
        let chatName: string = remoteJid.split('@')[0];
        let contactPhone: string | null = null;
        if (isGroup) {
          const existingGroup = await Group.findOne({ where: { connectionId, jid: remoteJid } });
          if (existingGroup && existingGroup.name && !existingGroup.name.startsWith('Grupo 12036')) {
            chatName = existingGroup.name;
          } else {
            try {
              const meta = await client.group.queryGroupMetadata(remoteJid);
              if (meta?.subject) {
                chatName = meta.subject;
                await Group.upsert({
                  connectionId,
                  jid: remoteJid,
                  name: meta.subject,
                  description: meta.desc || null,
                  participantCount: meta.participants?.length || 0,
                  metadata: { creation: meta.creation, owner: meta.owner },
                  lastSyncAt: new Date(),
                });
              } else {
                chatName = existingGroup?.name || `Grupo ${remoteJid.slice(0, 8)}`;
              }
            } catch (err: any) {
              chatName = existingGroup?.name || `Grupo ${remoteJid.slice(0, 8)}`;
            }
          }
        } else if (isNewsletter) {
          if (remoteJid.includes('120363194378500802')) chatName = 'Canaltech (CT Responde)';
          else if (remoteJid.includes('120363178498794895')) chatName = 'G1 Notícias (Canal)';
          else chatName = `Canal WhatsApp (${remoteJid.split('@')[0].slice(0, 8)})`;
        } else {
          // Direct chat: Could be companion account / self-chat, or individual contact
          const rawId = remoteJid.split('@')[0];
          const conn = await WhatsAppConnection.findByPk(connectionId);
          const cleanUserPhone = conn?.phoneNumber ? conn.phoneNumber.replace(/\D/g, '') : '';
          const isSelf = cleanUserPhone && (remoteJid.includes(cleanUserPhone) || rawId === cleanUserPhone);

          if (isSelf) {
            chatName = 'Você (Mensagens Salvas)';
            contactPhone = cleanUserPhone;
          } else {
            // Check wa_mailbox_contacts to resolve contact name and real phone number (especially for @lid)
            let resolvedName: string | null = null;
            let resolvedPhone: string | null = null;
            try {
              const [rows]: any = await sequelize.query(
                `SELECT display_name, push_name, phone_number, lid, jid FROM wa_mailbox_contacts 
                 WHERE (jid = :jid OR lid = :jid OR phone_number = :jid) 
                 ORDER BY 
                   CASE 
                     WHEN display_name IS NOT NULL AND display_name != '' AND display_name NOT LIKE '%∙%' THEN 1
                     WHEN push_name IS NOT NULL AND push_name != '' AND push_name != '.' THEN 2
                     ELSE 3
                   END,
                   last_updated_ms DESC
                 LIMIT 1`,
                { replacements: { jid: remoteJid } }
              );
              if (rows && rows.length > 0) {
                const match = rows[0];
                const matchedPhone = match.phone_number ? match.phone_number.split('@')[0].replace(/\D/g, '') : '';
                if (cleanUserPhone && matchedPhone === cleanUserPhone) {
                  resolvedName = 'Você (Mensagens Salvas)';
                } else {
                  resolvedName = (match.display_name || match.push_name || '').trim();
                }
                resolvedPhone = matchedPhone || null;
              }
            } catch {}

            // CRÍTICO: Nunca use event.pushName se fromMe for true!
            // Quando fromMe é true, event.pushName é o nome do próprio usuário que enviou (ex: "Yran")
            // e NUNCA o nome do destinatário. Só usamos event.pushName quando !fromMe.
            if (!resolvedName && !fromMe && event.pushName && event.pushName.trim() && event.pushName !== rawId) {
              resolvedName = event.pushName.trim();
            }

            if (resolvedName && resolvedName !== rawId) {
              chatName = resolvedName;
              contactPhone = resolvedPhone || (remoteJid.includes('@s.whatsapp.net') ? rawId : null);
              await Contact.upsert({
                connectionId,
                jid: remoteJid,
                name: resolvedName,
                notifyName: resolvedName,
                phoneNumber: contactPhone,
              }).catch(() => {});
            } else {
              const contact = await Contact.findOne({ where: { connectionId, jid: remoteJid } });
              if (contact && contact.name && contact.name !== 'Yran' && (contact.name || contact.notifyName)) {
                chatName = contact.name || contact.notifyName!;
                contactPhone = contact.phoneNumber || (remoteJid.includes('@s.whatsapp.net') ? rawId : null);
              } else if (remoteJid.includes('@bot')) {
                chatName = 'Meta AI';
              } else if (/^\d{10,15}$/.test(rawId)) {
                chatName = formatPhoneNumber(rawId);
                contactPhone = rawId;
              } else if (resolvedPhone) {
                chatName = formatPhoneNumber(resolvedPhone);
                contactPhone = resolvedPhone;
              }
            }
          }
        }

        // 5.3 Handle Media Attachments (Download & Store)
        let mediaUrl: string | null = null;
        let mediaMimetype: string | null = null;
        let mediaFilename: string | null = null;
        let thumbnailUrl: string | null = null;
        let caption: string | null = null;

        const msgPayload = event.message;
        const img = msgPayload?.imageMessage;
        const vid = msgPayload?.videoMessage;
        const aud = msgPayload?.audioMessage;
        const doc = msgPayload?.documentMessage;
        const stk = msgPayload?.stickerMessage;

        const hasMedia = Boolean(img || vid || aud || doc || stk);

        let messageType = 'text';
        if (img) messageType = 'image';
        else if (vid) messageType = 'video';
        else if (aud) messageType = 'audio';
        else if (doc) messageType = 'document';
        else if (stk) messageType = 'sticker';
        else if (msgPayload?.buttonsMessage) messageType = 'buttons';
        else if (msgPayload?.listMessage) messageType = 'list';
        else if (msgPayload?.interactiveMessage) {
          messageType = msgPayload.interactiveMessage?.carouselMessage ? 'carousel' : 'interactive';
        }

        if (hasMedia) {
          let ext = 'bin';
          if (img) {
            ext = 'jpg';
            mediaMimetype = img.mimetype || 'image/jpeg';
            caption = img.caption || null;
            if (img.jpegThumbnail) {
              thumbnailUrl = 'data:image/jpeg;base64,' + Buffer.from(img.jpegThumbnail).toString('base64');
            }
          } else if (vid) {
            ext = 'mp4';
            mediaMimetype = vid.mimetype || 'video/mp4';
            caption = vid.caption || null;
            if (vid.jpegThumbnail) {
              thumbnailUrl = 'data:image/jpeg;base64,' + Buffer.from(vid.jpegThumbnail).toString('base64');
            }
          } else if (aud) {
            ext = aud.ptt ? 'ogg' : 'mp3';
            mediaMimetype = aud.mimetype || 'audio/ogg';
          } else if (doc) {
            ext = doc.fileName?.split('.').pop() || 'pdf';
            mediaMimetype = doc.mimetype || 'application/octet-stream';
            mediaFilename = doc.fileName || `documento.${ext}`;
            caption = doc.caption || null;
            if (doc.jpegThumbnail) {
              thumbnailUrl = 'data:image/jpeg;base64,' + Buffer.from(doc.jpegThumbnail).toString('base64');
            }
          } else if (stk) {
            ext = 'webp';
            mediaMimetype = stk.mimetype || 'image/webp';
          }

          const safeStanza = stanzaId.replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `${connectionId.slice(0, 8)}_${safeStanza}_${Date.now()}.${ext}`;
          const filePath = path.join(config.mediaDir, filename);

          try {
            await client.message.downloadToFile(event, filePath);
            mediaUrl = `/api/media/${filename}`;
            if (!mediaFilename) {
              mediaFilename = filename;
            }
          } catch (dlErr: any) {
            console.warn(`[ZapoEventHandler] Download failed for message ${stanzaId}:`, dlErr.message);
          }
        }

        // 5.4 Extract message text / preview
        let textContent =
          caption ||
          msgPayload?.conversation ||
          msgPayload?.extendedTextMessage?.text ||
          msgPayload?.buttonsResponseMessage?.selectedDisplayText ||
          msgPayload?.listResponseMessage?.title ||
          msgPayload?.templateButtonReplyMessage?.selectedDisplayText ||
          (img ? (caption ? `📷 ${caption}` : '📷 Imagem') : null) ||
          (vid ? (caption ? `🎥 ${caption}` : '🎥 Vídeo') : null) ||
          (aud ? (aud.ptt ? '🎤 Mensagem de Voz' : '🎵 Áudio') : null) ||
          (doc ? `📄 ${doc.fileName || 'Documento'}` : null) ||
          (stk ? 'Sticker' : null) ||
          (msgPayload?.buttonsMessage ? '🔘 Mensagem com Botões' : null) ||
          (msgPayload?.listMessage ? '📋 Menu de Opções' : null) ||
          (msgPayload?.interactiveMessage?.carouselMessage ? '🎠 Carrossel Interativo' : null) ||
          (msgPayload?.interactiveMessage ? '⚡ Mensagem Interativa' : null) ||
          '[Mensagem não suportada ou formato especial]';

        // 5.5 Upsert Conversation
        let conversation = await Conversation.findOne({
          where: { connectionId, jid: remoteJid },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            connectionId,
            jid: remoteJid,
            chatType,
            name: chatName,
            phoneNumber: contactPhone,
            unreadCount: fromMe ? 0 : 1,
            lastMessageText: textContent,
            lastMessageTimestamp: new Date(),
          });
        } else {
          // If conversation name was previously a raw JID, placeholder, or poisoned with "Yran" on non-self chat, heal it!
          const isPoisonedYran = (conversation.name === 'Yran' || conversation.name === 'Admin Zaptroll') && chatName !== 'Yran';
          if (
            !conversation.name ||
            conversation.name.includes('@') ||
            conversation.name.startsWith('Grupo 12036') ||
            (conversation.jid.endsWith('@lid') && conversation.name === conversation.jid.split('@')[0]) ||
            isPoisonedYran
          ) {
            conversation.name = chatName;
          }
          if (contactPhone && !conversation.phoneNumber) {
            conversation.phoneNumber = contactPhone;
          }
          conversation.lastMessageText = textContent;
          conversation.lastMessageTimestamp = new Date();
          conversation.status = 'open'; // Automatically reopen closed conversation
          if (!fromMe) {
            conversation.unreadCount += 1;
          }
          await conversation.save();
        }

        // 5.5.1 Extract & normalize quoted contextInfo if message replies to another message
        const rawCtx =
          msgPayload?.extendedTextMessage?.contextInfo ||
          msgPayload?.imageMessage?.contextInfo ||
          msgPayload?.videoMessage?.contextInfo ||
          msgPayload?.audioMessage?.contextInfo ||
          msgPayload?.documentMessage?.contextInfo ||
          msgPayload?.stickerMessage?.contextInfo ||
          msgPayload?.buttonsResponseMessage?.contextInfo ||
          msgPayload?.listResponseMessage?.contextInfo ||
          msgPayload?.templateButtonReplyMessage?.contextInfo ||
          msgPayload?.interactiveResponseMessage?.contextInfo ||
          msgPayload?.contextInfo;

        let normalizedContextInfo: any = null;
        if (rawCtx?.stanzaId) {
          const qMsg = rawCtx.quotedMessage;
          let quotedText =
            qMsg?.conversation ||
            qMsg?.extendedTextMessage?.text ||
            qMsg?.imageMessage?.caption ||
            (qMsg?.imageMessage ? '📷 Foto' : null) ||
            qMsg?.videoMessage?.caption ||
            (qMsg?.videoMessage ? '🎥 Vídeo' : null) ||
            (qMsg?.audioMessage ? (qMsg.audioMessage.ptt ? '🎤 Mensagem de Voz' : '🎵 Áudio') : null) ||
            (qMsg?.documentMessage ? `📄 ${qMsg.documentMessage.fileName || 'Documento'}` : null) ||
            (qMsg?.locationMessage ? `📍 ${qMsg.locationMessage.name || 'Localização'}` : null) ||
            (qMsg?.contactMessage ? `👤 ${qMsg.contactMessage.displayName || 'Contato'}` : null) ||
            (qMsg?.stickerMessage ? 'Sticker' : null) ||
            '';

          if (!quotedText) {
            const existingQuoted = await Message.findOne({
              where: { connectionId, stanzaId: rawCtx.stanzaId },
            });
            if (existingQuoted) {
              quotedText = existingQuoted.content || existingQuoted.caption || '';
            }
          }

          let quotedSender = 'Mensagem';
          const pJid = rawCtx.participant;
          const connRec = await WhatsAppConnection.findByPk(connectionId);
          const userPhone = connRec?.phoneNumber ? connRec.phoneNumber.replace(/\D/g, '') : '';

          if (pJid) {
            const pRaw = pJid.split('@')[0];
            if (userPhone && (pJid.includes(userPhone) || pRaw === userPhone)) {
              quotedSender = 'Você';
            } else {
              const contact = await Contact.findOne({ where: { connectionId, jid: pJid } });
              if (contact?.name || contact?.notifyName) {
                quotedSender = contact.name || contact.notifyName!;
              } else {
                quotedSender = formatPhoneNumber(pRaw);
              }
            }
          } else {
            quotedSender = fromMe ? 'Você' : chatName;
          }

          normalizedContextInfo = {
            stanzaId: rawCtx.stanzaId,
            participant: rawCtx.participant || null,
            quotedSender,
            quotedText: quotedText || 'Mensagem',
            fromMe: Boolean(
              userPhone &&
                rawCtx.participant &&
                (rawCtx.participant.includes(userPhone) || rawCtx.participant.split('@')[0] === userPhone)
            ),
          };
        }

        const enrichedRawPayload = {
          ...(msgPayload || {}),
          ...(normalizedContextInfo ? { contextInfo: normalizedContextInfo } : {}),
        };

        // 5.6 Upsert Message
        const [message, created] = await Message.findOrCreate({
          where: { connectionId, stanzaId },
          defaults: {
            connectionId,
            conversationId: conversation.id,
            stanzaId,
            senderJid: fromMe ? 'me' : participant || remoteJid,
            fromMe,
            messageType,
            content: textContent,
            caption,
            mediaUrl,
            mediaMimetype,
            mediaFilename,
            thumbnailUrl,
            rawPayload: enrichedRawPayload || null,
            status: fromMe ? 'sent' : 'delivered',
            timestamp: event.timestampSeconds
              ? new Date(event.timestampSeconds * 1000)
              : event.messageTimestamp
              ? new Date(Number(event.messageTimestamp) * 1000)
              : new Date(),
            isRevoked: false,
            participant,
          },
        });

        // Ensure attributes are up to date if found
        if (mediaUrl && !message.mediaUrl) {
          message.mediaUrl = mediaUrl;
          message.mediaMimetype = mediaMimetype;
          message.mediaFilename = mediaFilename;
          message.thumbnailUrl = thumbnailUrl;
          message.caption = caption;
          await message.save();
        }

        const messagePayload = {
          id: message.id,
          stanzaId: message.stanzaId,
          connectionId: message.connectionId,
          conversationId: conversation.id,
          remoteJid,
          fromMe: message.fromMe,
          senderJid: message.senderJid,
          messageType: message.messageType,
          content: message.content,
          caption: message.caption,
          mediaUrl: message.mediaUrl,
          mediaMimetype: message.mediaMimetype,
          mediaFilename: message.mediaFilename,
          thumbnailUrl: message.thumbnailUrl,
          rawPayload: message.rawPayload,
          status: message.status,
          timestamp: message.timestamp,
        };

        emitToConnection(connectionId, 'new_message', {
          connectionId,
          message: messagePayload,
          conversation: {
            id: conversation.id,
            jid: conversation.jid,
            name: conversation.name,
            chatType: conversation.chatType,
            unreadCount: conversation.unreadCount,
            lastMessageText: conversation.lastMessageText,
            lastMessageTimestamp: conversation.lastMessageTimestamp,
          },
        });
        emitToUser(userId, 'new_message', {
          connectionId,
          message: messagePayload,
          conversation: {
            id: conversation.id,
            jid: conversation.jid,
            name: conversation.name,
            chatType: conversation.chatType,
            unreadCount: conversation.unreadCount,
            lastMessageText: conversation.lastMessageText,
            lastMessageTimestamp: conversation.lastMessageTimestamp,
          },
        });

        // Gatilho Inteligente via WhatsApp (de Contato ou do Celular):
        // Quando QUALQUER pessoa manda 🐊 ou "jacare" (seja o contato ou você mesmo),
        // o Zaptroll detecta e dispara automaticamente o Combo do Jacaré (áudio + figurinha)!
        const msgText = `${message.content || ''} ${message.caption || ''}`.toLowerCase().trim();
        const isJacareTrigger =
          msgText.includes('🐊') ||
          msgText === 'jacare' ||
          msgText === 'jacaré';

        if (
          created &&
          isJacareTrigger
        ) {
          if (MemeFlowService.shouldTrigger(message.stanzaId)) {
            setTimeout(async () => {
              try {
                console.log(`[ZapoEventHandler] 🐊 Gatilho do Jacaré detectado (${fromMe ? 'fromMe' : 'de contato'} - ${message.stanzaId})! Disparando combo...`);
                await MemeFlowService.triggerJacareFlow({
                  connectionId,
                  conversationId: conversation.id,
                  recipientJid: remoteJid,
                });
              } catch (flowErr) {
                console.error('[MemeFlow] Erro ao disparar fluxo via sync:', flowErr);
              }
            }, 500);
          }
        }

        // Gatilho Inteligente /ai - Meta AI no Chat (Inspirado em Jobas Fernandes / zapo-interactive-examples)
        const rawCommandText = (caption || message.content || '').trim();
        if (
          created &&
          !fromMe &&
          (rawCommandText.startsWith('/ai ') || rawCommandText === '/ai')
        ) {
          const question = rawCommandText.slice(3).trim() || 'Olá! O que você pode fazer?';
          setTimeout(async () => {
            try {
              let imageObj: any = undefined;
              if (img && mediaUrl) {
                const localPath = path.join(config.mediaDir, path.basename(mediaUrl));
                if (fs.existsSync(localPath)) {
                  imageObj = {
                    data: fs.readFileSync(localPath),
                    mimetype: mediaMimetype || 'image/jpeg',
                  };
                }
              }

              console.log(`[ZapoEventHandler] 🤖 /ai recebido de ${remoteJid}: "${question}"`);
              await MetaAiService.answerWithAi(client, remoteJid, question, {
                quote: event,
                image: imageObj,
              });
            } catch (aiErr: any) {
              console.error('[ZapoEventHandler] Erro ao responder /ai com Meta AI:', aiErr.message);
            }
          }, 300);
        }
      } catch (err) {
        console.error('Error handling message event:', err);
      }
    });

    // 6. Inbound Receipt
    client.on('receipt', async (receipt: any) => {
      try {
        const stanzaIds = receipt.ids || (receipt.stanzaId ? [receipt.stanzaId] : []);
        if (!stanzaIds.length) return;

        let status: 'sent' | 'delivered' | 'read' = 'delivered';
        if (receipt.status === 'read' || receipt.status === 'played') {
          status = 'read';
        }

        for (const stanzaId of stanzaIds) {
          await Message.update(
            { status },
            { where: { connectionId, stanzaId, fromMe: true } }
          );

          emitToConnection(connectionId, 'message_status', {
            connectionId,
            stanzaId,
            status,
          });
          emitToUser(userId, 'message_status', {
            connectionId,
            stanzaId,
            status,
          });
        }
      } catch (err) {
        console.error('Error handling receipt:', err);
      }
    });
  }
}
