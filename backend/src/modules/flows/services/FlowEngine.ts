import { Op } from 'sequelize';
import { Flow, FlowVersion, FlowSession, FlowExecutionEvent, FormSubmission } from '../models/index.js';
import { ZapoConnectionManager } from '../../../integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../../../integrations/zapo/ZapoMessageAdapter.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { config } from '../../../config/index.js';
import { FlowNodeType, LegacyFlowNodeType } from '../types/index.js';

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
   * Tenta encontrar um fluxo publicado correspondente à mensagem recebida.
   */
  public static async findTriggeredFlow(
    text: string,
    connectionId?: string
  ): Promise<{ flow: Flow; version: FlowVersion } | null> {
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
    const { connectionId, userJid, userInput = '', isSimulation = false } = options;
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
        (n) => n.type === 'trigger_keyword' || n.type.startsWith('trigger_') || n.id === 'start' || n.id === 'node_1'
      ) || flowVersion.nodes[0];

      if (!initialNode) {
        return { handled: false, error: 'Fluxo sem nós inicializáveis.' };
      }

      // Cria nova sessão persistida no banco
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

      // Executa a partir do nó inicial (que avançará automaticamente para o próximo nó conectado)
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
            b.buttonId?.toLowerCase() === cleanInput.toLowerCase() ||
            b.id?.toLowerCase() === cleanInput.toLowerCase() ||
            b.displayText?.toLowerCase() === cleanInput.toLowerCase() ||
            b.text?.toLowerCase() === cleanInput.toLowerCase()
        );

        if (matchedBtn) {
          const btnId = matchedBtn.buttonId || matchedBtn.id;
          const btnText = matchedBtn.displayText || matchedBtn.text || btnId;
          const edge = version.edges.find(
            (e) =>
              e.source === currentNode.id &&
              (e.sourceHandle === btnId ||
                e.sourceHandle === matchedBtn.id ||
                e.label?.toLowerCase() === btnText.toLowerCase() ||
                e.label?.toLowerCase() === btnId.toLowerCase())
          );
          targetNodeId = edge ? edge.target : null;
          variables[currentNode.data.saveVariable || 'last_button'] = btnText;
        }
      }
      // 2. Captura de dados (data_capture / capture_*)
      else if (currentNode.type === 'data_capture' || currentNode.type.startsWith('capture_')) {
        const varName = currentNode.data.variableName || 'user_input';
        variables[varName] = cleanInput;

        const defaultEdge = version.edges.find((e) => e.source === currentNode.id);
        targetNodeId = defaultEdge ? defaultEdge.target : null;
      }
      // 3. Formulário web hospedado aguardando preenchimento
      else if (currentNode.type === 'hosted_page_button') {
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
    const baseUrl = (config.appUrl || 'https://zaptroll.multivus.com.br').replace(/\/+$/, '');

    while (currentId && stepsCount < this.MAX_STEPS_PER_RUN) {
      stepsCount++;
      const node = version.nodes.find((n) => n.id === currentId);
      if (!node) {
        console.warn(`[FlowEngine] Nó não encontrado no grafo: ID "${currentId}". Encerrando execução.`);
        break;
      }

      await session.update({ currentNodeId: node.id });
      await this.logEvent(session.id, session.flowId, node.id, 'node_enter', {
        nodeType: node.type,
        nodeName: node.name,
      });

      // ==========================================
      // EXECUÇÃO DO NÓ POR TIPO UNIFICADO
      // ==========================================

      // 0. Gatilhos de Mensagem / Palavra-chave (Avança imediatamente para o nó conectado)
      if (node.type === 'trigger_keyword' || node.type.startsWith('trigger_')) {
        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 1. Mensagem de Texto
      else if (node.type === 'message_text') {
        const renderedText = this.interpolateVariables(node.data.text || '', session.variables);
        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, renderedText);
        }
        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { text: renderedText });
        events.push({ type: 'message_text', text: renderedText, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 2. Mensagem com Mídia (Imagem, Vídeo, Áudio)
      else if (node.type === 'message_media') {
        const mediaType = node.data.mediaType || 'image';
        const mediaUrl = this.interpolateVariables(node.data.mediaUrl || '', session.variables);
        const caption = this.interpolateVariables(node.data.caption || '', session.variables);

        if (client && !isSimulation && mediaUrl) {
          if (mediaType === 'image') {
            await ZapoMessageAdapter.sendImage(client, userJid, { url: mediaUrl, caption });
          } else if (mediaType === 'video') {
            await ZapoMessageAdapter.sendVideo(client, userJid, { url: mediaUrl, caption });
          }
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { mediaType, mediaUrl, caption });
        events.push({ type: 'message_media', mediaType, mediaUrl, caption, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 3. Botões Interativos
      else if (node.type === 'interactive_buttons') {
        const renderedText = this.interpolateVariables(
          node.data.content || node.data.text || 'Escolha uma das opções abaixo:',
          session.variables
        );
        const headerText = this.interpolateVariables(node.data.header || '', session.variables);
        const footerText = this.interpolateVariables(
          node.data.footer || node.data.footerText || 'ZapTroll Flow Studio',
          session.variables
        );

        const buttons = (node.data.buttons || []).map((b: any, idx: number) => ({
          buttonId: b.buttonId || b.id || `btn_${idx + 1}`,
          displayText: this.interpolateVariables(
            b.displayText || b.text || `Opção ${idx + 1}`,
            session.variables
          ),
        }));

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendButtons(client, userJid, {
            contentText: renderedText,
            headerText,
            footerText,
            buttons,
          });
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', {
          text: renderedText,
          buttons,
        });
        events.push({ type: 'interactive_buttons', text: renderedText, buttons, nodeId: node.id });

        // Pausa o fluxo para aguardar clique no botão
        await session.update({
          status: 'waiting_input',
          waitingFor: { type: 'button', validOptions: buttons.map((b: any) => b.buttonId), nodeId: node.id },
          currentNodeId: node.id,
        });
        return { handled: true, session, events };
      }
      // 4. Formulário Web Hospedado via CTA URL
      else if (node.type === 'hosted_page_button') {
        const renderedText = this.interpolateVariables(
          node.data.text || node.data.bodyText || node.data.content || 'Acesse o formulário exclusivo abaixo:',
          session.variables
        );
        const buttonText = this.interpolateVariables(node.data.buttonText || 'Abrir Formulário', session.variables);
        const formSchema = node.data.schema || node.data.formSchema || {
          title: 'Formulário Seguro ZapTroll',
          fields: [],
        };

        const publicId = `form_${Buffer.from(`${session.id}_${Date.now()}`).toString('base64url').slice(0, 16)}`;
        if (process.env.NODE_ENV !== 'test') {
          try {
            await FormSubmission.create({
              formId: node.id,
              publicId,
              flowSessionId: session.id,
              userJid,
              connectionId,
              schemaSnapshot: formSchema,
              data: {},
              status: 'pending',
              expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas de validade
            });
          } catch (err: any) {
            console.warn(`[FlowEngine] Falha ao registrar FormSubmission: ${err.message}`);
          }
        }

        const publicUrl = `${baseUrl}/r/form/${publicId}`;

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendWebview(client, userJid, {
            bodyText: renderedText,
            buttonText,
            url: publicUrl,
            footerText: 'Formulário Seguro ZapTroll',
          });
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', {
          url: publicUrl,
          buttonText,
        });
        events.push({
          type: 'hosted_page_button',
          text: renderedText,
          url: publicUrl,
          buttonText,
          title: formSchema.title,
          nodeId: node.id,
        });

        // Aguarda envio do formulário web pelo usuário
        await session.update({
          status: 'waiting_input',
          waitingFor: { type: 'form', formId: publicId, nodeId: node.id },
          currentNodeId: node.id,
        });
        return { handled: true, session, events };
      }
      // 5. Captura de Dados (Texto, Telefone, E-mail, Número)
      else if (node.type === 'data_capture' || node.type.startsWith('capture_')) {
        const promptText = this.interpolateVariables(
          node.data.promptMessage || node.data.prompt || 'Por favor, informe a informação solicitada:',
          session.variables
        );

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, promptText);
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { prompt: promptText });
        events.push({ type: 'data_capture', text: promptText, nodeId: node.id });

        // Pausa fluxo aguardando resposta textual do usuário
        await session.update({
          status: 'waiting_input',
          waitingFor: {
            type: 'data_capture',
            variableName: node.data.variableName || 'input',
            validationType: node.data.validationType || 'text',
            nodeId: node.id,
          },
          currentNodeId: node.id,
        });
        return { handled: true, session, events };
      }
      // 6. Condição / Desvio Lógico (IF / ELSE)
      else if (node.type === 'condition' || node.type === 'logic_condition') {
        const varName = node.data.variableName || '';
        const operator = node.data.operator || '==';
        const expectedValue = this.interpolateVariables(
          String(node.data.expectedValue ?? node.data.value ?? ''),
          session.variables
        );
        const actualValue = String(session.variables[varName] ?? '').trim();

        let isTrue = false;
        if (operator === '==' || operator === 'equals') {
          isTrue = actualValue.toLowerCase() === expectedValue.toLowerCase();
        } else if (operator === '!=' || operator === 'not_equals') {
          isTrue = actualValue.toLowerCase() !== expectedValue.toLowerCase();
        } else if (operator === 'contains') {
          isTrue = actualValue.toLowerCase().includes(expectedValue.toLowerCase());
        } else if (operator === '>' || operator === 'greater_than') {
          isTrue = parseFloat(actualValue) > parseFloat(expectedValue);
        } else if (operator === '<' || operator === 'less_than') {
          isTrue = parseFloat(actualValue) < parseFloat(expectedValue);
        }

        await this.logEvent(session.id, session.flowId, node.id, 'condition_eval', {
          varName,
          operator,
          actualValue,
          expectedValue,
          result: isTrue,
        });

        const handle = isTrue ? 'true' : 'false';
        const branchEdge = version.edges.find(
          (e) =>
            e.source === node.id &&
            (e.sourceHandle === handle ||
              e.label?.toLowerCase() === handle ||
              (isTrue && (e.label?.toLowerCase() === 'sim' || e.label?.toLowerCase() === 'verdadeiro')) ||
              (!isTrue && (e.label?.toLowerCase() === 'não' || e.label?.toLowerCase() === 'nao' || e.label?.toLowerCase() === 'falso')))
        );

        // Se não houver ramificação explícita, usa a aresta padrão
        const fallbackEdge = version.edges.find((e) => e.source === node.id && !e.sourceHandle);
        currentId = branchEdge ? branchEdge.target : fallbackEdge ? fallbackEdge.target : null;
      }
      // 7. Espera / Atraso (Wait Delay)
      else if (node.type === 'wait_delay') {
        const delaySeconds = Math.max(1, Math.min(Number(node.data.delaySeconds || 2), 60));
        await this.logEvent(session.id, session.flowId, node.id, 'wait_delay', { delaySeconds });
        events.push({ type: 'wait_delay', delaySeconds, nodeId: node.id });

        if (!isSimulation && process.env.NODE_ENV !== 'test') {
          await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 5) * 1000));
        }

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 8. Requisição HTTP Segura (SSRF & Rebinding Protected)
      else if (node.type === 'http_request' || node.type === 'integration_http') {
        const rawUrl = this.interpolateVariables(node.data.url || '', session.variables);
        const method = (node.data.method || 'POST').toUpperCase();
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

          const outVar = node.data.outputVariable || node.data.saveResponseVariable || 'api_response';
          const variables = { ...session.variables, [outVar]: httpRes.data };
          await session.update({ variables });

          const successEdge = version.edges.find(
            (e) => e.source === node.id && (e.sourceHandle === 'success' || !e.sourceHandle)
          );
          currentId = successEdge ? successEdge.target : null;
        } catch (httpErr: any) {
          await this.logEvent(session.id, session.flowId, node.id, 'error', {
            error: httpErr.message,
            context: 'http_request',
          });

          const errorEdge = version.edges.find((e) => e.source === node.id && e.sourceHandle === 'error');
          currentId = errorEdge ? errorEdge.target : null;
        }
      }
      // 9. Cobrança Pix Dinâmica
      else if (node.type === 'pix_charge' || node.type === 'commercial_pix_payment') {
        const pixKey = this.interpolateVariables(node.data.pixKey || 'multivus@zaptroll.local', session.variables);
        const amount = this.interpolateVariables(String(node.data.amount || '0.00'), session.variables);
        const merchant = this.interpolateVariables(node.data.merchantName || 'ZapTroll Store', session.variables);

        const pixText = `💳 *Cobrança PIX - ${merchant}*\nValor: *R$ ${amount}*\n\nChave Pix:\n\`${pixKey}\`\n\nCopie a chave acima e efetue o pagamento no seu aplicativo bancário.`;

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendText(client, userJid, pixText);
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { pixKey, amount, merchant });
        events.push({ type: 'pix_charge', text: pixText, pixKey, amount, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 10. Lançador de Jogos Web (DOOM / RPG Arena)
      else if (node.type === 'game_launcher') {
        const gameType = node.data.gameType || 'doom_retro';
        const gameTitle = this.interpolateVariables(
          node.data.gameTitle || (gameType === 'rpg_arena' ? 'Arena RPG ZapTroll' : 'DOOM Sector Retrô Arcade'),
          session.variables
        );
        const buttonText = this.interpolateVariables(node.data.buttonText || 'Jogar Agora 🚀', session.variables);

        const gameUrl =
          gameType === 'rpg_arena'
            ? `${baseUrl}/rpg/batalha/${session.id}?ref=${session.id.slice(0, 8)}`
            : `${baseUrl}/r/jogos/doom-sector?ref=${session.id.slice(0, 8)}`;

        const messageText = `🎮 *${gameTitle}*\nToque no botão abaixo para abrir o jogo web no navegador móvel ou desktop:`;

        if (client && !isSimulation) {
          await ZapoMessageAdapter.sendWebview(client, userJid, {
            bodyText: messageText,
            buttonText,
            url: gameUrl,
            footerText: 'ZapTroll Web Arcade',
          });
        }

        await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { gameUrl, gameTitle });
        events.push({ type: 'game_launcher', text: messageText, url: gameUrl, buttonText, nodeId: node.id });

        const nextEdge = version.edges.find((e) => e.source === node.id);
        currentId = nextEdge ? nextEdge.target : null;
      }
      // 11. Finalização do Atendimento (End Flow)
      else if (node.type === 'end_flow' || node.type === 'logic_end') {
        const finalMessage = this.interpolateVariables(node.data.finalMessage || '', session.variables);
        if (finalMessage) {
          if (client && !isSimulation) {
            await ZapoMessageAdapter.sendText(client, userJid, finalMessage);
          }
          await this.logEvent(session.id, session.flowId, node.id, 'message_sent', { text: finalMessage });
          events.push({ type: 'message_text', text: finalMessage, nodeId: node.id });
        }

        await session.update({ status: 'completed' });
        await this.logEvent(session.id, session.flowId, node.id, 'flow_end', { reason: 'end_flow' });
        break;
      }
      // 12. Tipo de nó desconhecido ou não registrado
      else {
        console.warn(`[FlowEngine] ⚠️ Nó de tipo desconhecido detectado: "${node.type}" (ID: ${node.id}).`);
        await this.logEvent(session.id, session.flowId, node.id, 'error', {
          error: `Tipo de nó desconhecido: "${node.type}".`,
          nodeType: node.type,
        });

        // Avança pela aresta padrão para não congelar o atendimento
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
