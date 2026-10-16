import { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.js';
import { WhatsAppConnection, WhatsAppConnectionEvent, Conversation, Message } from '../../database/models/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';

const createConnectionSchema = z.object({
  name: z.string().min(2, 'Nome da conexão deve ter no mínimo 2 caracteres').max(50),
});

const pairingCodeSchema = z.object({
  phoneNumber: z.string().min(10, 'Número de telefone deve conter DDI + DDD + Número'),
});

export class ConnectionsController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const connections = await WhatsAppConnection.findAll({
        where: { userId: req.user!.id },
        order: [['createdAt', 'DESC']],
      });
      res.json({ connections });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = createConnectionSchema.parse(req.body);

      // Check max connections limit
      const currentCount = await WhatsAppConnection.count({ where: { userId: req.user!.id } });
      if (currentCount >= req.user!.maxConnections) {
        res.status(403).json({
          error: `Você atingiu o limite de ${req.user!.maxConnections} conexões simultâneas.`,
        });
        return;
      }

      const sessionId = `user_${req.user!.id}_${crypto.randomUUID().slice(0, 8)}`;

      const connection = await WhatsAppConnection.create({
        userId: req.user!.id,
        name: validated.name.trim(),
        sessionId,
        status: 'disconnected',
      });

      res.status(201).json({ connection });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async connect(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const connection = await WhatsAppConnection.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada.' });
        return;
      }

      await zapoManager.connect(connection.id, req.user!.id);
      res.json({ message: 'Iniciando conexão com WhatsApp...', status: 'connecting' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async requestPairingCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = pairingCodeSchema.parse(req.body);

      const connection = await WhatsAppConnection.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada.' });
        return;
      }

      const code = await zapoManager.requestPairingCode(connection.id, req.user!.id, validated.phoneNumber);
      res.json({ code, message: 'Código de pareamento gerado com sucesso.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async disconnect(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const connection = await WhatsAppConnection.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada.' });
        return;
      }

      await zapoManager.disconnect(connection.id);
      res.json({ message: 'Conexão encerrada com sucesso.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const connection = await WhatsAppConnection.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada.' });
        return;
      }

      await zapoManager.logout(connection.id);
      await connection.destroy();

      res.json({ message: 'Conexão e sessão excluídas com sucesso.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
