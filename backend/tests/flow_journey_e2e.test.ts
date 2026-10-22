import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from '../src/modules/flows/services/FlowEngine.js';
import { FlowSession, FlowVersion, FormSubmission } from '../src/modules/flows/models/index.js';

describe('Flow Studio E2E Journey, Persistence & Session Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. walks the complete journey: trigger -> msg -> buttons -> capture -> condition -> form -> pix -> game -> end', async () => {
    const mockNodes = [
      {
        id: 'node_trg',
        type: 'trigger_keyword',
        name: 'Gatilho Pedido',
        position: { x: 0, y: 0 },
        data: { keywords: ['/pedido', 'comprar'] },
      },
      {
        id: 'node_welcome',
        type: 'message_text',
        name: 'Boas-vindas',
        position: { x: 100, y: 0 },
        data: { text: 'Olá! Bem-vindo à pizzaria ZapTroll.' },
      },
      {
        id: 'node_menu_btn',
        type: 'interactive_buttons',
        name: 'Menu Opções',
        position: { x: 200, y: 0 },
        data: {
          content: 'Escolha o que deseja fazer:',
          buttons: [
            { buttonId: 'btn_pizza', displayText: 'Pedir Pizza' },
            { buttonId: 'btn_duvida', displayText: 'Ver Cardápio' },
          ],
        },
      },
      {
        id: 'node_capture_name',
        type: 'data_capture',
        name: 'Coletar Nome',
        position: { x: 300, y: 0 },
        data: {
          promptMessage: 'Por favor, digite seu nome completo:',
          variableName: 'cliente_nome',
          validationType: 'text',
        },
      },
      {
        id: 'node_cond_vip',
        type: 'condition',
        name: 'Checa Cliente VIP',
        position: { x: 400, y: 0 },
        data: {
          variableName: 'cliente_nome',
          operator: 'contains',
          expectedValue: 'Silva',
        },
      },
      {
        id: 'node_msg_vip',
        type: 'message_text',
        name: 'Mensagem VIP',
        position: { x: 500, y: -50 },
        data: { text: 'Detectamos seu cadastro VIP, {{cliente_nome}}! Você tem 10% de desconto.' },
      },
      {
        id: 'node_form',
        type: 'hosted_page_button',
        name: 'Formulário Entrega',
        position: { x: 600, y: 0 },
        data: {
          buttonText: 'Preencher Endereço',
          schema: {
            title: 'Endereço de Entrega',
            fields: [{ id: 'rua', label: 'Rua e Número', type: 'text', required: true }],
          },
        },
      },
      {
        id: 'node_pix',
        type: 'pix_charge',
        name: 'Pagamento Pix',
        position: { x: 700, y: 0 },
        data: {
          amount: '59.90',
          pixKey: 'pizzaria@zaptroll.com',
          merchantName: 'ZapTroll Pizza',
        },
      },
      {
        id: 'node_game',
        type: 'game_launcher',
        name: 'Minigame Espera',
        position: { x: 800, y: 0 },
        data: {
          gameType: 'doom_retro',
          gameTitle: 'Doom Sector',
          buttonText: 'Jogar enquanto a pizza assa',
        },
      },
      {
        id: 'node_finish',
        type: 'end_flow',
        name: 'Conclusão',
        position: { x: 900, y: 0 },
        data: {
          finalMessage: 'Tudo pronto, {{cliente_nome}}! Seu pedido está em preparo.',
        },
      },
    ];

    const mockEdges = [
      { id: 'e1', source: 'node_trg', target: 'node_welcome' },
      { id: 'e2', source: 'node_welcome', target: 'node_menu_btn' },
      { id: 'e3', source: 'node_menu_btn', sourceHandle: 'btn_pizza', target: 'node_capture_name' },
      { id: 'e4', source: 'node_capture_name', target: 'node_cond_vip' },
      { id: 'e5_vip', source: 'node_cond_vip', sourceHandle: 'true', target: 'node_msg_vip' },
      { id: 'e5_norm', source: 'node_cond_vip', sourceHandle: 'false', target: 'node_form' },
      { id: 'e6_vip_to_form', source: 'node_msg_vip', target: 'node_form' },
      { id: 'e7', source: 'node_form', target: 'node_pix' },
      { id: 'e8', source: 'node_pix', target: 'node_game' },
      { id: 'e9', source: 'node_game', target: 'node_finish' },
    ];

    const mockVersion: any = {
      id: 'ver-e2e-pizza',
      flowId: 'flow-e2e-pizza',
      nodes: mockNodes,
      edges: mockEdges,
    };

    const mockSession: any = {
      id: 'sess-pizza-1',
      flowId: 'flow-e2e-pizza',
      flowVersionId: 'ver-e2e-pizza',
      connectionId: 'conn-e2e',
      userJid: '5511999990001@s.whatsapp.net',
      currentNodeId: 'node_trg',
      status: 'active',
      variables: {},
      stepHistory: [],
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    // ETAPA 1: Início via Gatilho -> Mensagem Boas-vindas -> Botões Interativos (Pausa)
    const run1 = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      { connectionId: mockSession.connectionId, userJid: mockSession.userJid, isSimulation: true },
      'node_trg'
    );

    expect(run1.handled).toBe(true);
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.currentNodeId).toBe('node_menu_btn');
    expect(run1.events.some((e) => e.text === 'Olá! Bem-vindo à pizzaria ZapTroll.')).toBe(true);
    expect(run1.events.some((e) => e.type === 'interactive_buttons')).toBe(true);

    // ETAPA 2: Usuário clica no botão "Pedir Pizza"
    const run2 = await (FlowEngine as any).handleUserInput(
      mockSession,
      mockVersion,
      { connectionId: mockSession.connectionId, userJid: mockSession.userJid, userInput: 'Pedir Pizza', isSimulation: true }
    );

    expect(run2.handled).toBe(true);
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.currentNodeId).toBe('node_capture_name');
    expect(run2.events.some((e) => e.text === 'Por favor, digite seu nome completo:')).toBe(true);

    // ETAPA 3: Usuário informa "Mariana Silva" (contém "Silva" -> ativa ramo VIP na condição)
    const run3 = await (FlowEngine as any).handleUserInput(
      mockSession,
      mockVersion,
      { connectionId: mockSession.connectionId, userJid: mockSession.userJid, userInput: 'Mariana Silva', isSimulation: true }
    );

    expect(run3.handled).toBe(true);
    expect(mockSession.variables.cliente_nome).toBe('Mariana Silva');
    // Deve ter avaliado a condição como TRUE, enviado mensagem VIP e pausado no formulário web
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.currentNodeId).toBe('node_form');
    expect(run3.events.some((e) => e.text?.includes('Detectamos seu cadastro VIP, Mariana Silva!'))).toBe(true);
    expect(run3.events.some((e) => e.type === 'hosted_page_button')).toBe(true);

    // ETAPA 4: Usuário submete o formulário web na página hospedada (/r/form/:id)
    // O formulário injeta as variáveis e chama resumeSession para continuar a partir de node_form
    mockSession.variables.rua = 'Av. Paulista, 1000';
    mockSession.status = 'active';
    mockSession.waitingFor = null;

    const nextEdge = mockEdges.find((e) => e.source === 'node_form');
    const run4 = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      { connectionId: mockSession.connectionId, userJid: mockSession.userJid, isSimulation: true },
      nextEdge!.target
    );

    expect(run4.handled).toBe(true);
    // Deve ter processado pix_charge -> game_launcher -> end_flow
    expect(mockSession.status).toBe('completed');
    expect(run4.events.some((e) => e.type === 'pix_charge' && e.amount === '59.90')).toBe(true);
    expect(run4.events.some((e) => e.type === 'game_launcher')).toBe(true);
    expect(run4.events.some((e) => e.text === 'Tudo pronto, Mariana Silva! Seu pedido está em preparo.')).toBe(true);
  });

  it('2. resumes session state from persistence after server restart', async () => {
    // Simula sessão gravada no banco antes de reiniciar o servidor
    const savedState = {
      id: 'sess-persisted-1',
      flowId: 'flow-p1',
      flowVersionId: 'ver-p1',
      connectionId: 'conn-persisted',
      userJid: '5511988887777@s.whatsapp.net',
      currentNodeId: 'node_capture_email',
      status: 'waiting_input',
      variables: { nome: 'Carlos Eduardo', pedido_id: 'PED-900' },
      stepHistory: [{ nodeId: 'node_start', timestamp: '2026-10-22T08:00:00Z' }],
      waitingFor: { type: 'data_capture', variableName: 'email' },
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(savedState, updates);
        return Promise.resolve(savedState);
      }),
    };

    const mockVersion: any = {
      id: 'ver-p1',
      flowId: 'flow-p1',
      nodes: [
        {
          id: 'node_capture_email',
          type: 'data_capture',
          name: 'Captura Email',
          position: { x: 0, y: 0 },
          data: { variableName: 'email' },
        },
        {
          id: 'node_ack',
          type: 'message_text',
          name: 'Confirmação Email',
          position: { x: 100, y: 0 },
          data: { text: 'Obrigado, {{nome}}! Enviamos os dados do {{pedido_id}} para {{email}}.' },
        },
      ],
      edges: [{ id: 'e1', source: 'node_capture_email', target: 'node_ack' }],
    };

    // Servidor reiniciou, memória RAM limpa. Chega a resposta do usuário:
    const resumed = await (FlowEngine as any).handleUserInput(
      savedState as any,
      mockVersion,
      {
        connectionId: savedState.connectionId,
        userJid: savedState.userJid,
        userInput: 'carlos@empresa.com.br',
        isSimulation: true,
      }
    );

    expect(resumed.handled).toBe(true);
    expect(savedState.variables.email).toBe('carlos@empresa.com.br');
    expect(savedState.variables.nome).toBe('Carlos Eduardo');
    expect(savedState.variables.pedido_id).toBe('PED-900');
    expect(resumed.events.some((e: any) => e.text === 'Obrigado, Carlos Eduardo! Enviamos os dados do PED-900 para carlos@empresa.com.br.')).toBe(true);
  });

  it('3. maintains strict isolation between different users and connections', async () => {
    const sessionUserA: any = {
      id: 'sess-user-a',
      connectionId: 'conn-1',
      userJid: '5511911111111@s.whatsapp.net',
      currentNodeId: 'node_ask',
      status: 'waiting_input',
      variables: { user: 'Alice', score: 100 },
      update: vi.fn().mockImplementation((u) => { Object.assign(sessionUserA, u); return Promise.resolve(sessionUserA); }),
    };

    const sessionUserB: any = {
      id: 'sess-user-b',
      connectionId: 'conn-1',
      userJid: '5511922222222@s.whatsapp.net',
      currentNodeId: 'node_ask',
      status: 'waiting_input',
      variables: { user: 'Bob', score: 50 },
      update: vi.fn().mockImplementation((u) => { Object.assign(sessionUserB, u); return Promise.resolve(sessionUserB); }),
    };

    const sessionUserC_OtherConn: any = {
      id: 'sess-user-c',
      connectionId: 'conn-2', // Conexão diferente, mesmo número de Alice
      userJid: '5511911111111@s.whatsapp.net',
      currentNodeId: 'node_ask',
      status: 'waiting_input',
      variables: { user: 'Alice_WorkConn', score: 0 },
      update: vi.fn().mockImplementation((u) => { Object.assign(sessionUserC_OtherConn, u); return Promise.resolve(sessionUserC_OtherConn); }),
    };

    const mockVersion: any = {
      id: 'ver-iso',
      flowId: 'flow-iso',
      nodes: [
        { id: 'node_ask', type: 'data_capture', name: 'Ask', position: { x: 0, y: 0 }, data: { variableName: 'resposta' } },
        { id: 'node_done', type: 'message_text', name: 'Done', position: { x: 100, y: 0 }, data: { text: 'Registrado: {{resposta}}' } },
      ],
      edges: [{ id: 'e1', source: 'node_ask', target: 'node_done' }],
    };

    // Apenas Alice na Conn-1 envia mensagem
    await (FlowEngine as any).handleUserInput(
      sessionUserA,
      mockVersion,
      { connectionId: 'conn-1', userJid: '5511911111111@s.whatsapp.net', userInput: 'Sim', isSimulation: true }
    );

    // Alice na Conn-1 teve a variável atualizada
    expect(sessionUserA.variables.resposta).toBe('Sim');

    // Bob na Conn-1 NÃO foi alterado
    expect(sessionUserB.variables.resposta).toBeUndefined();
    expect(sessionUserB.variables.user).toBe('Bob');

    // Alice na Conn-2 NÃO foi alterada
    expect(sessionUserC_OtherConn.variables.resposta).toBeUndefined();
    expect(sessionUserC_OtherConn.variables.user).toBe('Alice_WorkConn');
  });
});
