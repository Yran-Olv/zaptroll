import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../../middleware/auth.js';
import { Contact, WhatsAppConnection } from '../../database/models/index.js';

export class ContactsController {
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
          { notifyName: { [Op.iLike || Op.like]: `%${search}%` } },
          { phoneNumber: { [Op.iLike || Op.like]: `%${search}%` } },
          { jid: { [Op.iLike || Op.like]: `%${search}%` } },
        ];
      }

      const contacts = await Contact.findAll({
        where: whereClause,
        order: [['name', 'ASC']],
      });

      res.json({ contacts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
