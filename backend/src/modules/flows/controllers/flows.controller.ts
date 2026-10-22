import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import { Flow, FlowVersion, FlowSession, FlowExecutionEvent, FormSubmission } from '../models/index.js';
import { FlowEngine } from '../services/FlowEngine.js';
import { FLOW_TEMPLATES } from '../templates/index.js';
import { ZapoConnectionManager } from '../../../integrations/zapo/ZapoConnectionManager.js';

export class FlowController {
  // 1. List Flows
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const flows = await Flow.findAll({
        where: { userId: req.user!.id },
        order: [['updatedAt', 'DESC']],
      });
      res.json({ flows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 2. Create Flow
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description, triggerKeywords, templateId, connectionId } = req.body;
      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Nome do fluxo é obrigatório.' });
        return;
      }

      let nodes: any[] = [];
      let edges: any[] = [];
      let variables: any[] = [];

      if (templateId && FLOW_TEMPLATES[templateId]) {
        const tpl = FLOW_TEMPLATES[templateId];
        nodes = tpl.nodes;
        edges = tpl.edges;
        variables = tpl.variables || [];
      } else {
        // Default start node
        nodes = [
          {
            id: 'trigger_1',
            type: 'trigger_keyword',
            name: 'Gatilho de Entrada',
            position: { x: 100, y: 150 },
            data: { keywords: triggerKeywords || ['/inicio', 'oi', 'ola'] },
          },
          {
            id: 'node_msg_1',
            type: 'message_text',
            name: 'Mensagem de Boas-vindas',
            position: { x: 380, y: 150 },
            data: { text: 'Olá! Bem-vindo ao atendimento automático do ZapTroll.' },
          },
        ];
        edges = [
          { id: 'edge_1', source: 'trigger_1', target: 'node_msg_1' },
        ];
      }

      const flow = await Flow.create({
        userId: req.user!.id,
        name: name.trim(),
        description: description || '',
        status: 'draft',
        currentVersion: 1,
        triggerKeywords: triggerKeywords || ['/inicio'],
        connectionId: connectionId || null,
      });

      const flowVersion = await FlowVersion.create({
        flowId: flow.id,
        version: 1,
        nodes,
        edges,
        variables,
        isPublished: false,
      });

      res.status(201).json({ flow, version: flowVersion });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 3. Get Flow Details with Latest Version
  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const flow = await Flow.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!flow) {
        res.status(404).json({ error: 'Fluxo não encontrado.' });
        return;
      }

      const versions = await FlowVersion.findAll({
        where: { flowId: flow.id },
        order: [['version', 'DESC']],
      });

      const currentVersion = versions.find((v) => v.version === flow.currentVersion) || versions[0];

      res.json({ flow, currentVersion, versions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 4. Save Flow Version
  static async saveVersion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nodes, edges, variables, name, triggerKeywords, connectionId } = req.body;

      const flow = await Flow.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!flow) {
        res.status(404).json({ error: 'Fluxo não encontrado.' });
        return;
      }

      // Atualiza metadados se fornecidos
      if (name) flow.name = name.trim();
      if (triggerKeywords && Array.isArray(triggerKeywords)) flow.triggerKeywords = triggerKeywords;
      if (connectionId !== undefined) flow.connectionId = connectionId || null;
      await flow.save();

      const nextVersionNum = flow.currentVersion + 1;

      const newVersion = await FlowVersion.create({
        flowId: flow.id,
        version: nextVersionNum,
        nodes: nodes || [],
        edges: edges || [],
        variables: variables || [],
        isPublished: false,
      });

      await flow.update({ currentVersion: nextVersionNum });

      res.json({ flow, version: newVersion });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 5. Publish Flow
  static async publish(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { versionId } = req.body;

      const flow = await Flow.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!flow) {
        res.status(404).json({ error: 'Fluxo não encontrado.' });
        return;
      }

      const version = versionId
        ? await FlowVersion.findOne({ where: { id: versionId, flowId: flow.id } })
        : await FlowVersion.findOne({ where: { flowId: flow.id, version: flow.currentVersion } });

      if (!version) {
        res.status(404).json({ error: 'Versão do fluxo não encontrada para publicação.' });
        return;
      }

      // Validação básica do grafo
      if (!version.nodes || version.nodes.length === 0) {
        res.status(400).json({ error: 'O fluxo precisa conter pelo menos um nó para ser publicado.' });
        return;
      }

      await FlowVersion.update({ isPublished: false }, { where: { flowId: flow.id } });
      await version.update({ isPublished: true, publishedAt: new Date() });

      await flow.update({
        status: 'published',
        publishedVersionId: version.id,
      });

      res.json({ success: true, flow, publishedVersion: version });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 6. Unpublish Flow
  static async unpublish(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const flow = await Flow.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!flow) {
        res.status(404).json({ error: 'Fluxo não encontrado.' });
        return;
      }

      await flow.update({
        status: 'draft',
        publishedVersionId: null,
      });

      await FlowVersion.update({ isPublished: false }, { where: { flowId: flow.id } });

      res.json({ success: true, flow });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 7. Delete Flow
  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const flow = await Flow.findOne({
        where: { id, userId: req.user!.id },
      });

      if (!flow) {
        res.status(404).json({ error: 'Fluxo não encontrado.' });
        return;
      }

      await flow.destroy();
      res.json({ success: true, message: 'Fluxo excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 8. Run Flow Simulator Step
  static async simulate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { flowId, versionId, userMessage, sessionId } = req.body;
      const mockJid = `sim_${req.user!.id.slice(0, 8)}@simulator.local`;

      let flowVersion: FlowVersion | null = null;
      if (versionId) {
        flowVersion = await FlowVersion.findByPk(versionId);
      } else if (flowId) {
        const flow = await Flow.findOne({ where: { id: flowId, userId: req.user!.id } });
        if (flow) {
          flowVersion = await FlowVersion.findOne({
            where: { flowId: flow.id, version: flow.currentVersion },
          });
        }
      }

      if (!flowVersion) {
        res.status(404).json({ error: 'Versão do fluxo não encontrada para o simulador.' });
        return;
      }

      let session: FlowSession | null = null;
      if (sessionId) {
        session = await FlowSession.findByPk(sessionId);
      }

      if (!session) {
        const initialNode = flowVersion.nodes[0];
        session = await FlowSession.create({
          flowId: flowVersion.flowId,
          flowVersionId: flowVersion.id,
          connectionId: '00000000-0000-0000-0000-000000000000',
          userJid: mockJid,
          currentNodeId: initialNode.id,
          status: 'active',
          variables: {},
          stepHistory: [{ nodeId: initialNode.id, timestamp: new Date().toISOString() }],
          lastInteractionAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const runResult = await FlowEngine.resumeSession(
          session,
          flowVersion,
          {
            connectionId: session.connectionId,
            userJid: mockJid,
            isSimulation: true,
          },
          initialNode.id
        );

        res.json({
          session: runResult.session,
          events: runResult.events,
        });
        return;
      }

      // Processa resposta na sessão existente
      const runResult = await FlowEngine.processMessage({
        connectionId: session.connectionId,
        userJid: mockJid,
        userInput: userMessage || '',
        isSimulation: true,
      });

      res.json(runResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 9. List Ready Templates
  static async getTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const templateSummaries = Object.values(FLOW_TEMPLATES).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        nodesCount: t.nodes.length,
        tags: t.tags,
      }));
      res.json({ templates: templateSummaries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 10. Instantiate Template into User Account
  static async instantiateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const tpl = FLOW_TEMPLATES[templateId];

      if (!tpl) {
        res.status(404).json({ error: 'Template não encontrado.' });
        return;
      }

      const flow = await Flow.create({
        userId: req.user!.id,
        name: tpl.name,
        description: tpl.description,
        status: 'draft',
        currentVersion: 1,
        triggerKeywords: tpl.triggerKeywords || ['/menu'],
      });

      const flowVersion = await FlowVersion.create({
        flowId: flow.id,
        version: 1,
        nodes: tpl.nodes,
        edges: tpl.edges,
        variables: tpl.variables || [],
        isPublished: false,
      });

      res.status(201).json({ flow, version: flowVersion });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 11. Public Form Schema Query (No Login Required)
  static async getPublicForm(req: any, res: Response): Promise<void> {
    try {
      const { publicId } = req.params;
      const submission = await FormSubmission.findOne({
        where: { publicId, status: 'pending' },
      });

      if (!submission) {
        res.status(404).json({ error: 'Formulário não encontrado ou já preenchido/expirado.' });
        return;
      }

      if (new Date() > new Date(submission.expiresAt)) {
        res.status(410).json({ error: 'Este link de formulário expirou.' });
        return;
      }

      res.json({
        publicId: submission.publicId,
        schema: submission.schemaSnapshot,
        expiresAt: submission.expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // 12. Public Form Submit (No Login Required)
  static async submitPublicForm(req: any, res: Response): Promise<void> {
    try {
      const { publicId } = req.params;
      const { data } = req.body;

      const submission = await FormSubmission.findOne({
        where: { publicId, status: 'pending' },
      });

      if (!submission) {
        res.status(404).json({ error: 'Formulário inválido ou já processado.' });
        return;
      }

      if (new Date() > new Date(submission.expiresAt)) {
        res.status(410).json({ error: 'O prazo para envio deste formulário expirou.' });
        return;
      }

      await submission.update({
        data: data || {},
        status: 'submitted',
        submittedAt: new Date(),
      });

      // Se houver sessão de fluxo associada, retoma a execução no WhatsApp com confirmação!
      if (submission.flowSessionId) {
        const session = await FlowSession.findByPk(submission.flowSessionId);
        if (session && session.status === 'waiting_input') {
          const version = await FlowVersion.findByPk(session.flowVersionId);
          if (version) {
            // Injeta dados do formulário nas variáveis
            const variables = { ...session.variables, ...data, form_submitted: true };
            await session.update({ variables, status: 'active', waitingFor: null });

            const edge = version.edges.find((e) => e.source === session.currentNodeId);
            if (edge) {
              await FlowEngine.resumeSession(
                session,
                version,
                {
                  connectionId: session.connectionId,
                  userJid: session.userJid,
                },
                edge.target
              );
            }
          }
        }
      }

      res.json({ success: true, message: 'Formulário enviado com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
