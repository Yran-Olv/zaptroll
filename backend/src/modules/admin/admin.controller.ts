import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { User, WhatsAppConnection, Message, Conversation, AuditLog } from '../../database/models/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';

export class AdminController {
  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await User.findAll({
        attributes: ['id', 'name', 'email', 'role', 'status', 'maxConnections', 'rateLimit', 'createdAt', 'updatedAt'],
        include: [
          {
            model: WhatsAppConnection,
            as: 'connections',
            attributes: ['id', 'name', 'status', 'phoneNumber', 'lastConnectedAt'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, maxConnections, rateLimit, role } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado.' });
        return;
      }

      if (status) user.status = status;
      if (typeof maxConnections === 'number') user.maxConnections = maxConnections;
      if (typeof rateLimit === 'number') user.rateLimit = rateLimit;
      if (role) user.role = role;

      await user.save();

      await AuditLog.create({
        userId: req.user!.id,
        action: 'UPDATE_USER_LIMITS_OR_STATUS',
        resource: `User:${user.id}`,
        details: { status, maxConnections, rateLimit, role },
        ipAddress: req.ip || null,
      });

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalUsers = await User.count();
      const totalConnections = await WhatsAppConnection.count();
      const connectedConnections = await WhatsAppConnection.count({ where: { status: 'connected' } });
      const totalMessages = await Message.count();
      const totalConversations = await Conversation.count();
      const activeInMemorySessions = zapoManager.getActiveSessionsCount();

      res.json({
        stats: {
          totalUsers,
          totalConnections,
          connectedConnections,
          totalMessages,
          totalConversations,
          activeInMemorySessions,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const logs = await AuditLog.findAll({
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        order: [['createdAt', 'DESC']],
        limit: 100,
      });
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
