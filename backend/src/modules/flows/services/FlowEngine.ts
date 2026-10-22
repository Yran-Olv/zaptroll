import { Op } from 'sequelize';
import { Flow, FlowVersion, FlowSession, FlowExecutionEvent, FormSubmission } from '../models/index.js';
import { ZapoConnectionManager } from '../../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../../integrations/zapo/ZapoMessageAdapter.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { MetaAiService } from '../../advanced/MetaAiService.js';
import { emitToConnection } from '../../realtime/socket.js';
import { config } from '../../../config/index.js';

export interface ExecuteFlowOptions {
  connectionId: string;
  userJid: string;
  userInput?: string;
  inputPayload?: any;
  isSimulation?: boolean;
}

export class FlowEngine {
  private static readonly MAX_STEPS_PER_RUN = 30; // Previne loops infinitos

  /**
   * Substitui marcações {{variavel}} no texto pelos valores atuais das variáveis da sessão.
   */
  public static interpolateVariables(text: string, variables: Record<string, any>): string {
    if (!text) return '';
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const val = variables[key];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  }

  /**
   * Tenta encontrar um gatilho de fluxo publicado correspondente à mensagem recebida.
   */
  public static async findTriggeredFlow(text: string, connectionId?: string): Promise<{ flow: Flow; version: FlowVersion } | null> {
    const cleanText = text.trim().toLowerCase();
    const whereClause: any = {
      status: 'published',
    };

    if (connectionId) {
      whereClause[Op.or] = [
        { connectionId: null },
        { connectionId },
      ];
    }

    const flows = await Flow.findAll({ where: whereClause });

    for (const flow of flows) {
      const keywords = Array.isArray(flow.triggerKeywords) ? flow.triggerKeywords : [];
      const isMatched = keywords.some((kw) => {
        const cleanKw = String(kw).trim().toLowerCase();
        return cleanText === cleanKw || cleanText.startsWith(cleanKw + ' ') || cleanText.includes(cleanKw);
      });

      if (isMatched && flow.publishedVersionId) {
        const version = await FlowVersion.findByPk(flow.publishedVersionId);
        if (version) {
          return { flow, version };
        }
      }
    }

    return null;
  }

  /**
   * Processa uma mensagem recebida (do WhatsApp ou do Simulador) na máquina de estados do FlowEngine.
   */
  public static async processMessage(options: ExecuteFlowOptions): Promise<{
    handled: boolean;
    session?: FlowSession;
    events?: any[];
    error?: string;
  }> {
    const { connectionId, userJid, userInput = '', inputPayload, isSimulation = false } = options;
    const cleanInput = userInput.trim();

    // 1. Verifica se já existe uma sessão ativa aguardando resposta para este usuário
    let session = await FlowSession.findOne({
      where: {
        connectionId,
        userJid,
        status: { [Op.in]: ['active', 'waiting_input'] },
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['lastInteractionAt', 'DESC']],
    });

    let flowVersion: FlowVersion | null = null;

    if (!session) {
      // 2. Não há sessão ativa: verifica se a mensagem aciona um novo fluxo
      const triggered = await this.findTriggeredFlow(cleanInput, connectionId);
      if (!triggered) {
        return { handled: false };
      }

      flowVersion = triggered.version;
      const initialNode = flowVersion.nodes.find(
        (n) => n.type.startsWith('trigger_') || n.id === 'start' || n.id === 'node_1'
      ) || flowVersion.nodes[0];

      if (!initialNode) {
        return { handled: false, error: 'Fluxo sem nós inicializáveis.' };
      }

      // Cria nova sessão persistida
      session = await FlowSession.create({
        flowId: triggered.flow.id,
        flowVersionId: flowVersion.id,
        connectionId,
        userJid,
        currentNodeId: initialNode.id,
        status: 'active',
        variables: {},
        stepHistory: [{ nodeId: initialNode.id, timestamp: new Date().toISOString(), action: 'trigger_started' }],
        lastInteractionAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      });

      await this.logEvent(session.id, session.flowId, initialNode.id, 'session_start', {
        trigger: cleanInput,
        flowName: triggered.flow.name,
      });

      // Executa a partir do nó seguinte ao gatilho
      return this.resumeSession(session, flowVersion, options, initialNode.id);
    } else {
      // 3. Sessão existente aguardando resposta do usuário
      flowVersion = await FlowVersion.findByPk(session.flowVersionId);
      if (!flowVersion) {
        await session.update({ status: 'error' });
        return { handled: false, error: 'Versão do fluxo não encontrada.' };
      }

      return this.handleUserInput(session, flowVersion, options);
    }
  }

  /**
   * Trata a entrada do usuário para o nó que estava aguardando resposta.
   */
  private static async handleUserInput(
    session: FlowSession,
    version: FlowVersion,
    options: ExecuteFlowOptions
  ): Promise<{ handled: boolean; session: FlowSession; events: any[] }> {
    const currentNode = version.nodes.find((n) => n.id === session.currentNodeId);
    const cleanInput = (options.userInput || '').trim();
    const variables = { ...session.variables };

    await this.logEvent(session.id, session.flowId, session.currentNodeId, 'input_received', {
      userInput: cleanInput,
      waitingFor: session.waitingFor,
    });

    let targetNodeId: string | null = null;

    if (currentNode) {
      // 1. Botões interativos
      if (currentNode.type === 'interactive_buttons') {
        const buttons = currentNode.data.buttons || [];
        const matchedBtn = buttons.find(
          (b: any) =>
            b.id === cleanInput ||
            b.text?.toLowerCase() === cleanInput.toLowerCase() ||
            b.buttonId === cleanInput
        );

        if (matchedBtn) {
          const edge = version.edges.find(
            (e) => e.source === currentNode.id && (e.sourceHandle === matchedBtn.id || e.sourceHandle === matchedBtn.buttonId)
          );
          targetNodeId = edge ? edge.target : null;
          variables[currentNode.data.saveVariable || 'last_button'] = matchedBtn.text || matchedBtn.id;
        }
      }
      // 2. Captura de dados (texto, email, telefone, etc.)
      else if (currentNode.type.startsWith('capture_')) {
        const varName = currentNode.data.variableName || 'user_input';
        variables[varName] = cleanInput;

        const defaultEdge = version.edges.find((e) => e.source === currentNode.id);
        targetNodeId = defaultEdge ? defaultEdge.target : null;
      }
    }

    if (!targetNodeId) {
      // Fallback para aresta padrão
      const fallbackEdge = version.edges.find((e) => e.source === session.currentNodeId);
      targetNodeId = fallbackEdge ? fallbackEdge.target : null;
    }

    await session.update({
      variables,
      status: 'active',
      waitingFor: null,
      lastInteractionAt: new Date(),
    });

    if (!targetNodeId) {
      await session.update({ status: 'completed' });
      await this.logEvent(session.id, session.flowId, session.currentNodeId, 'flow_end', { reason: 'no_next_node' });
      return { handled: true, session, events: [] };
    }

    return this.resumeSession(session, version, options, targetNodeId);
  }

  /**
   * Percorre e executa nós sequenciais do grafo até atingir um ponto de espera (input) ou finalização.
   */
  public static async resumeSession(
    session: FlowSession,
    version: FlowVersion,
    options: ExecuteFlowOptions,
    startNodeId: string
  ): Promise<{ handled: boolean; session: FlowSession; events: any[] }> {
    let currentId: string | null = startNodeId;
    let stepsCount = 0;
    const events: any[] = [];
    const { connectionId, userJid, isSimulation = false } = options;

    const zapoManager = ZapoConnectionManager.getInstance();
    const client = !isSimulation ? zapoManager.getClient(connectionId) : null;

    while (currentId && stepsCount < this.MAX_STEPS_PER_RUN) {
      stepsCount++;
      const node = version.nodes.find((n) => n.id === currentId);
      if (!node) break;

      await session.update({ currentNodeId: node.id });
      await this.logEvent(session.id, session.flowId, node.id, 'node_enter', {
        nodeType: node.type,
        nodeName: node.name,
      });

      // ==========================================
      // EXECUÇÃO DO NÓ POR TIPO
      // ==========================================

      // 1. Mensagem de Texto
      if (node.type === 'message_text') {
        const renderedText = this.interpolateVariables(node.data.text || '', session.variables);
        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, renderedText);
        }
        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { text: renderedText });
        events.push({ type: 'message_text', text: renderedText, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 2. Botões Interativos
      else if (node.type === 'interactive_buttons') {
        const renderedText = this.interpolateVariables(node.data.text || 'Escolha uma opção:', session.variables);
        const buttons = (node.data.buttons || []).map((b: any, idx: number) => ({
          buttonId: b.id || `btn_${idx + 1}`,
          displayText: this.interpolateVariables(b.text || `Opção ${idx + 1}`, session.variables),
        }));

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendButtons(client, userJid, {
            contentText: renderedText,
            footerText: node.data.footerText,
            buttons,
          });
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', {
          text: renderedText,
          buttonsCount: buttons.length,
        });
        events.push({ type: 'interactive_buttons', text: renderedText, buttons, nodeId: node.id });

        // Pausa o fluxo para aguardar clique no botão
        await session.update({
          status: 'waiting_input',
          waitingFor: 'button',
          currentNodeId: node.id,
        });
        return { handled: true, session, events };
      }
      // 3. Botão com Página Hospedada / Formulário / Jogo / RPG
      else if (node.type === 'hosted_page_button') {
        const renderedText = this.interpolateVariables(node.data.text || 'Acesse a experiência:', session.variables);
        const buttonText = node.data.buttonText || 'Abrir Página';
        const pageType = node.data.pageType || 'form'; // 'form' | 'game' | 'rpg' | 'custom'

        let publicUrl = '';
        const baseUrl = config.appUrl.replace(/\/+$/, '');

        if (pageType === 'form') {
          // Cria submissão temporária para formulário seguro
          const publicId = `form_${Buffer.from(`${session.id}_${Date.now()}`).toString('base64url').slice(0, 16)}`;
          await FormSubmission.create({
            formId: node.data.formId || node.id,
            publicId,
            flowSessionId: session.id,
            userJid,
            connectionId,
            schemaSnapshot: node.data.formSchema || {},
            data: {},
            status: 'pending',
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas de validade
          });
          publicUrl = `${baseUrl}/r/form/${publicId}`;
        } else if (pageType === 'game') {
          const gameId = node.data.gameId || 'doom';
          publicUrl = `${baseUrl}/r/jogos/${gameId}?ref=${session.id.slice(0, 8)}`;
        } else if (pageType === 'rpg') {
          publicUrl = `${baseUrl}/rpg`;
        } else {
          publicUrl = node.data.url || `${baseUrl}/r/fluxo/${session.id}`;
        }

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendWebview(client, userJid, {
            bodyText: renderedText,
            buttonText,
            url: publicUrl,
            footerText: 'Experiência Hospedada Zaptroll',
          });
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', {
          url: publicUrl,
          buttonText,
        });
        events.push({ type: 'hosted_page_button', text: renderedText, url: publicUrl, buttonText, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 4. Captura de Entrada (Texto, Email, Telefone)
      else if (node.type.startsWith('capture_')) {
        const promptText = this.interpolateVariables(node.data.prompt || 'Por favor, informe a informação solicitada:', session.variables);
        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, promptText);
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { prompt: promptText });
        events.push({ type: 'capture_prompt', text: promptText, nodeId: node.id });

        // Pausa fluxo aguardando resposta em texto
        await session.update({
          status: 'waiting_input',
          waitingFor: node.data.variableName || 'input',
          currentNodeId: node.id,
        });
        return { handled: true, session, events };
      }
      // 5. Condição Lógica (IF/ELSE)
      else if (node.type === 'logic_condition') {
        const varName = node.data.variableName || '';
        const operator = node.data.operator || 'equals';
        const expectedValue = this.interpolateVariables(node.data.value || '', session.variables);
        const actualValue = String(session.variables[varName] || '').trim();

        let isTrue = false;
        if (operator === 'equals') isTrue = actualValue.toLowerCase() === expectedValue.toLowerCase();
        else if (operator === 'not_equals') isTrue = actualValue.toLowerCase() !== expectedValue.toLowerCase();
        else if (operator === 'contains') isTrue = actualValue.toLowerCase().includes(expectedValue.toLowerCase());
        else if (operator === 'greater_than') isTrue = parseFloat(actualValue) > parseFloat(expectedValue);
        else if (operator === 'less_than') isTrue = parseFloat(actualValue) < parseFloat(expectedValue);

        await this.logEvent(session.id, session.flowId, node.id, 'condition_eval', {
          varName,
          operator,
          actualValue,
          expectedValue,
          result: isTrue,
        });

        const handle = isTrue ? 'true' : 'false';
        const branchEdge = version.edges.find(
          (e) => e.source === node.id && (e.sourceHandle === handle || e.label === handle)
        );
        currentId = branchEdge ? branchEdge.target : null;
      }
      // 6. Requisição HTTP Segura (SSRF Protected)
      else if (node.type === 'integration_http') {
        const rawUrl = this.interpolateVariables(node.data.url || '', session.variables);
        const method = (node.data.method || 'GET').toUpperCase();
        const headers = node.data.headers || {};
        let reqBody = node.data.body;

        if (reqBody && typeof reqBody === 'string') {
          reqBody = this.interpolateVariables(reqBody, session.variables);
          try {
            reqBody = JSON.parse(reqBody);
          } catch {}
        }

        try {
          await this.logEvent(session.id, session.flowId, node.id, 'http_request', { url: rawUrl, method });
          const httpRes = await SafeHttpClient.request(rawUrl, {
            method: method as any,
            headers,
            body: reqBody,
            timeoutMs: 8000,
          });

          await this.logEvent(session.id, session.flowId, node.id, 'http_response', {
            status: httpRes.status,
            durationMs: httpRes.durationMs,
          });

          // Mapeia variáveis de resposta
          if (node.data.saveResponseVariable) {
            const variables = { ...session.variables, [node.data.saveResponseVariable]: httpRes.data };
            await session.update({ variables });
          }

          const successEdge = version.edges.find(
            (e) => e.source === node.id && (e.sourceHandle === 'success' || !e.sourceHandle)
          );
          currentId = successEdge ? successEdge.target : null;
        } catch (httpErr: any) {
          await this.logEvent(session.id, session.flowId, node.id, 'error', {
            error: httpErr.message,
            context: 'integration_http',
          });

          const errorEdge = version.edges.find((e) => e.source === node.id && e.sourceHandle === 'error');
          currentId = errorEdge ? errorEdge.target : null;
        }
      }
      // 7. Pix Comercial
      else if (node.type === 'commercial_pix_payment') {
        const pixKey = node.data.pixKey || 'multivus@zaptroll.local';
        const amount = this.interpolateVariables(node.data.amount || '0.00', session.variables);
        const pixText = `💳 *Pagamento via PIX*\nValor: *R$ ${amount}*\n\nChave Pix: \`${pixKey}\`\n\nCopie a chave acima e efetue o pagamento no seu banco.`;

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, pixText);
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { pixKey, amount });
        events.push({ type: 'pix_payment', text: pixText, pixKey, amount, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 8. Finalização de Fluxo
      else if (node.type === 'logic_end') {
        await session.update({ status: 'completed' });
        await this.logEvent(session.id, session.flowId, node.id, 'flow_end', { reason: 'logic_end' });
        break;
      }
      // 9. Gatilhos (trigger_*)
      else if (node.type.startsWith('trigger_')) {
        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      } else {
        // Nó genérico: avança para o próximo
        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
    }

    if (!currentId) {
      await session.update({ status: 'completed' });
    }

    return { handled: true, session, events };
  }

  /**
   * Registra auditoria e histórico de evento de execução.
   */
  public static async logEvent(
    flowSessionId: string,
    flowId: string,
    nodeId: string | null,
    eventType: any,
    details: Record<string, any>
  ) {
    try {
      if (process.env.NODE_ENV !== 'test') {
        await FlowExecutionEvent.create({
          flowSessionId,
          flowId,
          nodeId,
          eventType,
          details,
        });
      }
    } catch (err: any) {
      console.warn(`[FlowEngine] Falha ao registrar log de execução: ${err.message}`);
    }
  }
}
