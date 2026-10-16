import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../../middleware/auth.js';
import { Group, WhatsAppConnection } from '../../database/models/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoEventHandler } from '../../integrations/zapo/ZapoEventHandler.js';

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
}
