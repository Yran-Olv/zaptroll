import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../../middleware/auth.js';
import { Group, WhatsAppConnection, Conversation } from '../../database/models/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoEventHandler } from '../../integrations/zapo/ZapoEventHandler.js';
import { emitToConnection, emitToUser } from '../../modules/realtime/socket.js';

export class GroupsController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { search } = req.query;

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const whereClause: any = { connectionId };

      if (search && typeof search === 'string') {
        whereClause[Op.or] = [
          { name: { [Op.iLike || Op.like]: `%${search}%` } },
          { jid: { [Op.iLike || Op.like]: `%${search}%` } },
        ];
      }

      let groups = await Group.findAll({
        where: whereClause,
        order: [['name', 'ASC']],
      });

      // If empty and connection is connected, attempt auto-sync
      if (groups.length === 0 && connection.status === 'connected') {
        const client = zapoManager.getClient(connectionId);
        if (client) {
          try {
            await ZapoEventHandler.syncGroups(client, connectionId);
            groups = await Group.findAll({
              where: whereClause,
              order: [['name', 'ASC']],
            });
          } catch (syncErr: any) {
            console.warn('[GroupsController] Auto-sync error on list:', syncErr.message);
          }
        }
      }

      res.json({ groups });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async sync(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({ error: 'A conexão com o WhatsApp não está ativa para sincronização em tempo real.' });
        return;
      }

      const groups = await ZapoEventHandler.syncGroups(client, connectionId);
      res.json({ success: true, count: groups.length, groups });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { subject, participants = [], description } = req.body;

      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        res.status(400).json({ error: 'O nome do grupo (subject) é obrigatório.' });
        return;
      }

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({ error: 'A conexão com o WhatsApp não está ativa no momento.' });
        return;
      }

      const cleanParticipants: string[] = Array.isArray(participants)
        ? participants.map((p: any) => String(p).trim()).filter(Boolean)
        : [];

      const metadata = await client.group.createGroup(subject.trim(), cleanParticipants, {
        description: description?.trim() || undefined,
      });

      const groupJid = metadata.jid;
      const groupName = metadata.subject || subject.trim();

      const [groupRecord] = await Group.upsert({
        connectionId,
        jid: groupJid,
        name: groupName,
        description: metadata.desc || description?.trim() || null,
        participantCount: metadata.participants?.length || (cleanParticipants.length + 1),
        metadata,
        lastSyncAt: new Date(),
      });

      const [convRecord] = await Conversation.upsert({
        connectionId,
        jid: groupJid,
        chatType: 'group',
        name: groupName,
        unreadCount: 0,
        lastMessageText: `Grupo criado: ${groupName}`,
        lastMessageTimestamp: new Date(),
      });

      emitToConnection(connectionId, 'group_created', {
        connectionId,
        group: groupRecord,
        conversation: convRecord,
      });
      emitToUser(req.user!.id, 'group_created', {
        connectionId,
        group: groupRecord,
        conversation: convRecord,
      });

      res.status(201).json({
        success: true,
        group: groupRecord,
        metadata,
      });
    } catch (error: any) {
      console.error('[GroupsController] Erro ao criar grupo:', error);
      res.status(500).json({ error: error.message || 'Falha ao criar grupo no WhatsApp.' });
    }
  }
}
