import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { WhatsAppConnection } from '../../database/models/index.js';
import { MemeFlowService } from './MemeFlowService.js';

export class MemesController {
  static async listFlows(req: AuthRequest, res: Response): Promise<void> {
    try {
      const flows = MemeFlowService.listFlows();
      res.json({ success: true, flows });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao listar fluxos de memes.' });
    }
  }

  static async triggerFlow(req: AuthRequest, res: Response): Promise<void> {
    const { connectionId, conversationId, recipientJid, flowId } = req.body;

    if (!connectionId) {
      res.status(400).json({ error: 'connectionId é obrigatório.' });
      return;
    }

    if (!conversationId && !recipientJid) {
      res.status(400).json({ error: 'conversationId ou recipientJid é obrigatório.' });
      return;
    }

    // Validar propriedade da conexão pelo usuário autenticado
    const connection = await WhatsAppConnection.findOne({
      where: { id: connectionId, userId: req.user!.id },
    });

    if (!connection) {
      res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
      return;
    }

    try {
      if (!flowId || flowId === 'jacare') {
        const result = await MemeFlowService.triggerJacareFlow({
          connectionId,
          conversationId,
          recipientJid,
        });
        res.json(result);
        return;
      }

      res.status(400).json({ error: `Fluxo '${flowId}' não reconhecido.` });
    } catch (err: any) {
      console.error('[MemesController] Erro ao disparar fluxo:', err);
      const status = err.status || 400;
      res.status(status).json({ error: err.message || 'Erro ao disparar fluxo de meme.' });
    }
  }
}
