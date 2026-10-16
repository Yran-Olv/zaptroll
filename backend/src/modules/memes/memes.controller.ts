import { Request, Response } from 'express';
import { MemeFlowService } from './MemeFlowService.js';

export class MemesController {
  static async listFlows(req: Request, res: Response): Promise<void> {
    try {
      const flows = MemeFlowService.listFlows();
      res.json({ success: true, flows });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao listar fluxos de memes.' });
    }
  }

  static async triggerFlow(req: Request, res: Response): Promise<void> {
    const { connectionId, conversationId, recipientJid, flowId } = req.body;

    if (!connectionId) {
      res.status(400).json({ error: 'connectionId é obrigatório.' });
      return;
    }

    if (!conversationId && !recipientJid) {
      res.status(400).json({ error: 'conversationId ou recipientJid é obrigatório.' });
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
      res.status(500).json({ error: err.message || 'Erro ao disparar fluxo de meme.' });
    }
  }
}
