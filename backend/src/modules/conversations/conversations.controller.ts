import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../../middleware/auth.js';
import { Conversation, WhatsAppConnection, Message, Group, Contact } from '../../database/models/index.js';
import { sequelize } from '../../database/index.js';
import { MailboxSyncService } from '../../integrations/zapo/MailboxSyncService.js';

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

export class ConversationsController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { search, filter } = req.query;

      // Ensure connection belongs to current user
      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const cleanUserPhone = connection.phoneNumber ? connection.phoneNumber.replace(/\D/g, '') : '';

      const whereClause: any = { connectionId };

      if (search && typeof search === 'string') {
        whereClause[Op.or] = [
          { name: { [Op.iLike || Op.like]: `%${search}%` } },
          { jid: { [Op.iLike || Op.like]: `%${search}%` } },
          { lastMessageText: { [Op.iLike || Op.like]: `%${search}%` } },
        ];
      }

      if (filter === 'unread') {
        whereClause.unreadCount = { [Op.gt]: 0 };
      } else if (filter === 'groups') {
        whereClause.chatType = 'group';
      } else if (filter === 'direct') {
        whereClause.chatType = 'direct';
      }

      let conversations = await Conversation.findAll({
        where: whereClause,
        order: [['lastMessageTimestamp', 'DESC']],
      });

      // If no conversations found yet but mailbox has threads, auto-sync immediately
      if (conversations.length === 0 && !search && filter === 'all') {
        const syncRes = await MailboxSyncService.syncConnection(connectionId, req.user!.id);
        if (syncRes.syncedConversations > 0) {
          conversations = await Conversation.findAll({
            where: whereClause,
            order: [['lastMessageTimestamp', 'DESC']],
          });
        }
      }

      // Self-heal conversation names with accurate contact info
      for (const conv of conversations) {
        const rawJidId = conv.jid.split('@')[0];
        const isGroup = conv.chatType === 'group' || conv.jid.endsWith('@g.us');
        const isNewsletter = conv.jid.includes('@newsletter');
        const isSelf = cleanUserPhone && (conv.jid.includes(cleanUserPhone) || rawJidId === cleanUserPhone);

        if (isSelf) {
          if (conv.name !== 'Você (Mensagens Salvas)') {
            conv.name = 'Você (Mensagens Salvas)';
            await conv.save();
          }
          continue;
        }

        if (isGroup) {
          if (!conv.name || conv.name.includes('@') || conv.name.startsWith('Grupo 12036')) {
            const group = await Group.findOne({ where: { connectionId, jid: conv.jid } });
            if (group && group.name && !group.name.startsWith('Grupo 12036')) {
              conv.name = group.name;
              await conv.save();
            }
          }
          continue;
        }

        if (isNewsletter) {
          if (!conv.name || conv.name === rawJidId) {
            if (conv.jid.includes('120363194378500802')) conv.name = 'Canaltech (CT Responde)';
            else if (conv.jid.includes('120363178498794895')) conv.name = 'G1 Notícias (Canal)';
            else conv.name = `Canal WhatsApp (${rawJidId.slice(0, 8)})`;
            await conv.save();
          }
          continue;
        }

        // Direct chat: verify if erroneously named "Você (Mensagens Salvas)" or showing raw JID/digits
        const needsNameFix =
          !conv.name ||
          conv.name === rawJidId ||
          conv.name.includes('@') ||
          (conv.name === 'Você (Mensagens Salvas)' && !isSelf);

        if (needsNameFix) {
          // 1. Check wa_mailbox_contacts
          try {
            const [rows]: any = await sequelize.query(
              `SELECT display_name, push_name, phone_number, lid FROM wa_mailbox_contacts 
               WHERE (jid = :jid OR lid = :jid OR phone_number = :jid) 
               AND (display_name IS NOT NULL OR push_name IS NOT NULL) 
               LIMIT 1`,
              { replacements: { jid: conv.jid } }
            );

            if (rows && rows.length > 0) {
              const match = rows[0];
              const resolved = (match.display_name || match.push_name || '').trim();
              if (resolved && resolved !== rawJidId) {
                conv.name = resolved;
                await conv.save();
                continue;
              }
            }
          } catch {}

          // 2. Check Contact model
          const contact = await Contact.findOne({ where: { connectionId, jid: conv.jid } });
          if (contact && (contact.name || contact.notifyName)) {
            conv.name = contact.name || contact.notifyName!;
            await conv.save();
            continue;
          }

          // 3. If raw phone number, format it cleanly
          if (/^\d{10,15}$/.test(rawJidId)) {
            conv.name = formatPhoneNumber(rawJidId);
            await conv.save();
          }
        }
      }

      res.json({ conversations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const conversation = await Conversation.findByPk(id, {
        include: [
          {
            model: WhatsAppConnection,
            as: 'connection',
            where: { userId: req.user!.id },
          },
        ],
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversa não encontrada.' });
        return;
      }

      // Mark unread messages as read
      if (conversation.unreadCount > 0) {
        conversation.unreadCount = 0;
        await conversation.save();
      }

      res.json({ conversation });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const conversation = await Conversation.findByPk(id, {
        include: [
          {
            model: WhatsAppConnection,
            as: 'connection',
            where: { userId: req.user!.id },
          },
        ],
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversa não encontrada.' });
        return;
      }

      conversation.unreadCount = 0;
      await conversation.save();

      res.json({ success: true, conversationId: id, unreadCount: 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async syncMailbox(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const result = await MailboxSyncService.syncConnection(connectionId, req.user!.id);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
