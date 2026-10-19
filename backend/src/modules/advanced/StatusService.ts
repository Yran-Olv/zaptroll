import fs from 'node:fs';
import path from 'node:path';
import { ZapoConnectionManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { Contact, Group, Conversation, Message } from '../../database/models/index.js';
import { ZapoMessageAdapter } from '../../integrations/zapo/ZapoMessageAdapter.js';
import { emitToConnection } from '../realtime/socket.js';

export interface StatusStoryItem {
  id: string;
  connectionId: string;
  senderJid: string;
  senderPhone?: string;
  senderName: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content?: string;
  caption?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  font?: number;
  timestamp: string;
  viewed: boolean;
}

export class StatusService {
  // Buffer em memória com os últimos status recebidos por conexão
  private static statusBuffer = new Map<string, StatusStoryItem[]>();
  private static MAX_STATUS_PER_CONN = 150;

  /**
   * Captura um novo status/story recebido em status@broadcast
   */
  public static async captureStatus(
    connectionId: string,
    rawEvent: {
      stanzaId: string;
      participant?: string;
      pushName?: string;
      message: any;
      timestamp?: number;
    }
  ) {
    const senderJid = rawEvent.participant || 'desconhecido@s.whatsapp.net';
    const senderPhone = senderJid.split('@')[0];
    const senderName = rawEvent.pushName || `+${senderPhone}`;
    const msg = rawEvent.message || {};

    let type: StatusStoryItem['type'] = 'text';
    let content: string | undefined = undefined;
    let caption: string | undefined = undefined;
    let mediaUrl: string | undefined = undefined;
    let backgroundColor: string | undefined = undefined;
    let font: number | undefined = undefined;

    if (msg.conversation) {
      type = 'text';
      content = msg.conversation;
    } else if (msg.extendedTextMessage) {
      type = 'text';
      content = msg.extendedTextMessage.text;
      backgroundColor = msg.extendedTextMessage.backgroundArgb
        ? `#${(msg.extendedTextMessage.backgroundArgb >>> 0).toString(16).slice(2)}`
        : undefined;
      font = msg.extendedTextMessage.font;
    } else if (msg.imageMessage) {
      type = 'image';
      caption = msg.imageMessage.caption;
      mediaUrl = msg.imageMessage.url;
    } else if (msg.videoMessage) {
      type = 'video';
      caption = msg.videoMessage.caption;
      mediaUrl = msg.videoMessage.url;
    } else if (msg.audioMessage) {
      type = 'audio';
    }

    const item: StatusStoryItem = {
      id: rawEvent.stanzaId,
      connectionId,
      senderJid,
      senderPhone,
      senderName,
      type,
      content,
      caption,
      mediaUrl,
      backgroundColor: backgroundColor || '#1f2937',
      font: font || 0,
      timestamp: new Date(rawEvent.timestamp ? rawEvent.timestamp * 1000 : Date.now()).toISOString(),
      viewed: false,
    };

    let list = this.statusBuffer.get(connectionId);
    if (!list) {
      list = [];
      this.statusBuffer.set(connectionId, list);
    }

    // Evita duplicatas pelo ID
    const exists = list.some((s) => s.id === item.id);
    if (!exists) {
      list.unshift(item);
      if (list.length > this.MAX_STATUS_PER_CONN) {
        list.pop();
      }
    }

    return item;
  }

  /**
   * Retorna os status mais recentes de uma conexão
   */
  public static listRecentStatus(connectionId: string): StatusStoryItem[] {
    return this.statusBuffer.get(connectionId) || [];
  }

  /**
   * Marca um status como visto (envia recibo de leitura ao WhatsApp)
   */
  public static async markStatusViewed(
    connectionId: string,
    params: { stanzaId: string; senderJid: string }
  ): Promise<boolean> {
    const zapoManager = ZapoConnectionManager.getInstance();
    const client = zapoManager.getClient(connectionId);

    // Atualiza no buffer local
    const list = this.statusBuffer.get(connectionId);
    if (list) {
      const item = list.find((s) => s.id === params.stanzaId);
      if (item) {
        item.viewed = true;
      }
    }

    if (client && typeof (client as any).message?.sendReadReceipt === 'function') {
      try {
        await (client as any).message.sendReadReceipt('status@broadcast', {
          id: params.stanzaId,
          participant: params.senderJid,
          fromMe: false,
        });
        return true;
      } catch (err: any) {
        console.warn('[StatusService] Falha ao enviar recibo de status:', err.message);
      }
    }
    return true;
  }

  /**
   * Obtém banner padrão 1080x1920 para Status de Grupo
   */
  public static getDefaultGroupMedia(): { banner: Buffer; thumb?: Buffer } {
    const possiblePaths = [
      path.resolve(process.cwd(), 'assets/group-status.jpg'),
      path.resolve(process.cwd(), 'backend/assets/group-status.jpg'),
      path.resolve(process.cwd(), 'dist/assets/group-status.jpg'),
      path.resolve('/app/assets/group-status.jpg'),
    ];
    const possibleThumbs = [
      path.resolve(process.cwd(), 'assets/group-status-thumb.jpg'),
      path.resolve(process.cwd(), 'backend/assets/group-status-thumb.jpg'),
      path.resolve(process.cwd(), 'dist/assets/group-status-thumb.jpg'),
      path.resolve('/app/assets/group-status-thumb.jpg'),
    ];

    for (let i = 0; i < possiblePaths.length; i++) {
      if (fs.existsSync(possiblePaths[i])) {
        const banner = fs.readFileSync(possiblePaths[i]);
        const thumb = fs.existsSync(possibleThumbs[i]) ? fs.readFileSync(possibleThumbs[i]) : undefined;
        return { banner, thumb };
      }
    }
    const fallback = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64'
    );
    return { banner: fallback };
  }

  /**
   * Posta um novo Status / Stories
   * Suporta postar para status@broadcast (pessoal) e NATIVO em Grupos (groupStatusMessageV2)
   */
  public static async postStatus(
    connectionId: string,
    params: {
      type?: 'text' | 'image';
      text?: string;
      caption?: string;
      backgroundColor?: string;
      font?: number;
      recipients?: string[];
      targetGroups?: string[];
      mentionAll?: boolean;
      imageUrl?: string;
      imageBase64?: string;
      alsoPostToPersonal?: boolean;
    }
  ) {
    const zapoManager = ZapoConnectionManager.getInstance();
    const client = zapoManager.getClient(connectionId);
    if (!client) {
      throw new Error('Conexão WhatsApp não conectada.');
    }

    let statusResult: any = null;
    const hasTargetGroups = Boolean(params.targetGroups && params.targetGroups.length > 0);

    // 1. Postar para status@broadcast (Status Pessoal do Número)
    // Se grupos foram selecionados, NUNCA posta no status pessoal a não ser que alsoPostToPersonal === true
    if (!hasTargetGroups || params.alsoPostToPersonal) {
      let recipients = params.recipients && params.recipients.length > 0 ? params.recipients : [];

      if (recipients.length === 0) {
        const contacts = await Contact.findAll({
          where: { connectionId },
          attributes: ['jid', 'phoneNumber'],
          limit: 250,
        });
        recipients = contacts
          .map((c) => c.jid || (c.phoneNumber ? `${c.phoneNumber}@s.whatsapp.net` : null))
          .filter((j): j is string => Boolean(j && !j.endsWith('@g.us')));
      }

      const credentials = client.getCredentials();
      const myLid = credentials?.meLid?.split(':')[0] + '@lid';
      const myJid = credentials?.meJid ? credentials.meJid.split(':')[0] + '@s.whatsapp.net' : null;
      if (myJid && !recipients.includes(myJid)) recipients.push(myJid);
      if (myLid && !recipients.includes(myLid)) recipients.push(myLid);

      const text = params.text || params.caption || '';
      let backgroundArgb: number | undefined = undefined;
      if (params.backgroundColor) {
        const hex = params.backgroundColor.replace('#', '');
        backgroundArgb = parseInt(`ff${hex}`, 16);
      }

      try {
        if (client.status && typeof client.status.send === 'function' && !params.imageUrl && !params.imageBase64) {
          statusResult = await client.status.send({
            content: {
              type: 'text',
              text: text || 'ZapTroll Status',
            },
            recipients: recipients.slice(0, 50),
            statusSetting: 'contacts',
          });
        } else {
          statusResult = await client.message.send('status@broadcast', {
            extendedTextMessage: {
              text: text || 'ZapTroll Status',
              backgroundArgb: backgroundArgb || 0xff25d366,
              font: params.font || 0,
            },
          } as any);
        }
      } catch (broadcastErr: any) {
        console.warn('[StatusService] Falha ao enviar para status@broadcast:', broadcastErr.message);
        statusResult = { error: broadcastErr.message };
        if (!hasTargetGroups) throw broadcastErr;
      }
    }

    // 2. Postar NATIVO em Grupos via groupStatusMessageV2 (Story de Grupo)
    const groupResults: Array<{ groupJid: string; statusId?: string; error?: string }> = [];
    if (hasTargetGroups && params.targetGroups) {
      let imageBytes: Buffer;
      let thumbBytes: Buffer | undefined;

      if (params.imageBase64) {
        const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        imageBytes = Buffer.from(cleanBase64, 'base64');
      } else if (params.imageUrl) {
        try {
          const fetchRes = await fetch(params.imageUrl);
          imageBytes = Buffer.from(await fetchRes.arrayBuffer());
        } catch (fetchErr: any) {
          console.warn('[StatusService] Falha ao baixar imagem, usando banner padrão:', fetchErr.message);
          const def = StatusService.getDefaultGroupMedia();
          imageBytes = def.banner;
          thumbBytes = def.thumb;
        }
      } else {
        const def = StatusService.getDefaultGroupMedia();
        imageBytes = def.banner;
        thumbBytes = def.thumb;
      }

      const caption = params.caption || params.text || '';

      for (const groupJid of params.targetGroups) {
        try {
          let mentionedJids: string[] = [];
          if (params.mentionAll) {
            try {
              const meta = await client.group.queryGroupMetadata(groupJid);
              if (meta?.participants) {
                mentionedJids = meta.participants.map((p: any) => p.id || p.jid).filter(Boolean);
              }
            } catch {
              const localGroup = await Group.findOne({ where: { connectionId, jid: groupJid } });
              const parts = localGroup?.metadata?.participants;
              if (parts && Array.isArray(parts)) {
                mentionedJids = parts.map((p: any) => p.id || p.jid).filter(Boolean);
              }
            }
          }

          // Envio nativo do Story do Grupo (groupStatusMessageV2)
          const sendRes = await ZapoMessageAdapter.sendGroupStatus(
            client,
            groupJid,
            imageBytes,
            caption,
            {
              width: 1080,
              height: 1920,
              jpegThumbnail: thumbBytes,
              mentionedJids,
            }
          );

          const stanzaId = (sendRes as any)?.id || (sendRes as any)?.key?.id || `GRP_STATUS_${Date.now()}`;

          let convRecord = await Conversation.findOne({ where: { connectionId, jid: groupJid } });
          if (!convRecord) {
            convRecord = await Conversation.create({
              connectionId,
              jid: groupJid,
              chatType: 'group',
              name: groupJid.split('@')[0],
              unreadCount: 0,
            });
          }

          const msg = await Message.create({
            connectionId,
            conversationId: convRecord.id,
            senderJid: groupJid,
            stanzaId,
            fromMe: true,
            messageType: 'group_status',
            content: caption || '🟢 Status de Grupo Postado',
            status: 'sent',
            timestamp: new Date(),
            rawPayload: {
              isGroupStatus: true,
              caption,
              mentionedCount: mentionedJids.length,
              mentionedJids,
            },
          });

          await convRecord.update({
            lastMessageText: `🟢 [Story/Status do Grupo]: ${caption.slice(0, 35)}`,
            lastMessageTimestamp: new Date(),
          });

          emitToConnection(connectionId, 'new_message', {
            connectionId,
            message: msg,
            conversation: convRecord,
          });

          groupResults.push({ groupJid, statusId: stanzaId });
        } catch (err: any) {
          console.error(`[StatusService] Erro ao postar groupStatusMessageV2 em ${groupJid}:`, err);
          groupResults.push({ groupJid, error: err.message });
        }
      }
    }

    return {
      success: true,
      hasTargetGroups,
      groupsCount: params.targetGroups?.length || 0,
      groupResults,
      result: statusResult,
    };
  }
}

