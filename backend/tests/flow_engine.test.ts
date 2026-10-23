import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafeHttpClient } from '../src/modules/flows/services/SafeHttpClient.js';
import { FlowEngine } from '../src/modules/flows/services/FlowEngine.js';
import { Flow, FlowVersion, FlowSession, FormSubmission } from '../src/modules/flows/models/index.js';

describe('SafeHttpClient & SSRF Protection', () => {
  it('1. correctly identifies and blocks private and restricted IPv4 and IPv6', () => {
    expect(SafeHttpClient.isPrivateOrRestrictedIp('127.0.0.1')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('10.0.0.5')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('172.16.0.1')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('172.31.255.255')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('192.168.1.1')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('169.254.169.254')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('::1')).toBe(true);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('0.0.0.0')).toBe(true);

    // Public IPs should not be blocked
    expect(SafeHttpClient.isPrivateOrRestrictedIp('8.8.8.8')).toBe(false);
    expect(SafeHttpClient.isPrivateOrRestrictedIp('1.1.1.1')).toBe(false);
  });

  it('2. rejects URLs with restricted schemes or local hostnames', async () => {
    await expect(SafeHttpClient.validateUrlAndResolve('file:///etc/passwd')).rejects.toThrow(
      /Protocolo "file:" não permitido/
    );
    await expect(SafeHttpClient.validateUrlAndResolve('ftp://example.com/file')).rejects.toThrow(
      /Protocolo "ftp:" não permitido/
    );
    await expect(SafeHttpClient.validateUrlAndResolve('http://localhost:3000/api')).rejects.toThrow(
      /Acesso ao host "localhost" bloqueado/
    );
    await expect(SafeHttpClient.validateUrlAndResolve('http://metadata.google.internal/computeMetadata')).rejects.toThrow(
      /Acesso ao host "metadata.google.internal" bloqueado/
    );
  });
});

describe('FlowEngine — Graph Execution & Variables', () => {
  it('1. correctly interpolates variables in strings', () => {
    const vars = {
      nome: 'Carlos',
      cidade: 'Uberlândia',
      pedido: { id: 123 },
    };

    const template = 'Olá {{nome}}, seu pedido {{pedido}} será entregue em {{cidade}}!';
    const result = FlowEngine.interpolateVariables(template, vars);

    expect(result).toBe('Olá Carlos, seu pedido {"id":123} será entregue em Uberlândia!');
  });

  it('2. handles missing variables with empty strings without crashing', () => {
    const result = FlowEngine.interpolateVariables('Olá {{inexistente}}!', {});
    expect(result).toBe('Olá !');
  });

  it('3. executes simulated flow from start node through text and pauses on interactive buttons', async () => {
    const mockNodes = [
      {
        id: 'start',
        type: 'trigger_keyword',
        name: 'Início',
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: 'node_msg',
        type: 'message_text',
        name: 'Mensagem 1',
        position: { x: 100, y: 0 },
        data: { text: 'Bem-vindo ao teste do simulador!' },
      },
      {
        id: 'node_btn',
        type: 'interactive_buttons',
        name: 'Opções',
        position: { x: 200, y: 0 },
        data: {
          text: 'Escolha uma opção:',
          buttons: [
            { id: 'b1', text: 'Opção 1' },
            { id: 'b2', text: 'Opção 2' },
          ],
        },
      },
    ];

    const mockEdges = [
      { id: 'e1', source: 'start', target: 'node_msg' },
      { id: 'e2', source: 'node_msg', target: 'node_btn' },
    ];

    const mockVersion: any = {
      id: 'ver-sim-1',
      flowId: 'flow-sim-1',
      nodes: mockNodes,
      edges: mockEdges,
      variables: [],
    };

    const mockSession: any = {
      id: 'sess-sim-1',
      flowId: 'flow-sim-1',
      flowVersionId: 'ver-sim-1',
      currentNodeId: 'start',
      status: 'active',
      variables: {},
      stepHistory: [],
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    const res = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      {
        connectionId: 'conn-sim',
        userJid: 'user@sim',
        isSimulation: true,
      },
      'start'
    );

    expect(res.handled).toBe(true);
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.waitingFor).toEqual(expect.objectContaining({ type: 'button' }));
    expect(mockSession.currentNodeId).toBe('node_btn');
    expect(res.events.length).toBeGreaterThanOrEqual(2);
    expect(res.events[0].text).toBe('Bem-vindo ao teste do simulador!');
  });

  it('4. routes along matching condition handle', async () => {
    const mockNodes = [
      {
        id: 'cond_1',
        type: 'logic_condition',
        name: 'Checagem de Idade',
        position: { x: 0, y: 0 },
        data: { variableName: 'idade', operator: 'greater_than', value: '18' },
      },
      {
        id: 'node_adulto',
        type: 'message_text',
        name: 'Adulto',
        position: { x: 200, y: -50 },
        data: { text: 'Você é maior de idade!' },
      },
      {
        id: 'node_menor',
        type: 'message_text',
        name: 'Menor',
        position: { x: 200, y: 50 },
        data: { text: 'Você é menor de idade.' },
      },
    ];

    const mockEdges = [
      { id: 'e_true', source: 'cond_1', sourceHandle: 'true', target: 'node_adulto' },
      { id: 'e_false', source: 'cond_1', sourceHandle: 'false', target: 'node_menor' },
    ];

    const mockVersion: any = {
      id: 'ver-cond-1',
      flowId: 'flow-cond-1',
      nodes: mockNodes,
      edges: mockEdges,
    };

    const mockSession: any = {
      id: 'sess-cond-1',
      flowId: 'flow-cond-1',
      flowVersionId: 'ver-cond-1',
      currentNodeId: 'cond_1',
      status: 'active',
      variables: { idade: '25' },
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    const res = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      {
        connectionId: 'conn-sim',
        userJid: 'user@sim',
        isSimulation: true,
      },
      'cond_1'
    );

    expect(res.handled).toBe(true);
    expect(res.events.some((e) => e.text === 'Você é maior de idade!')).toBe(true);
  });

  it('5. executes full end-to-end journey across all unified block types', async () => {
    // Grafo completo com 10 nós
    const mockNodes = [
      {
        id: 'n_trigger',
        type: 'trigger_keyword',
        name: 'Gatilho',
        position: { x: 0, y: 0 },
        data: { keywords: ['/iniciar'] },
      },
      {
        id: 'n_msg',
        type: 'message_text',
        name: 'Boas-vindas',
        position: { x: 100, y: 0 },
        data: { text: 'Olá!' },
      },
      {
        id: 'n_btn',
        type: 'interactive_buttons',
        name: 'Opções',
        position: { x: 200, y: 0 },
        data: {
          content: 'O que deseja fazer?',
          buttons: [
            { buttonId: 'btn_comprar', displayText: 'Quero Comprar' },
            { buttonId: 'btn_duvida', displayText: 'Tirar Dúvida' },
          ],
        },
      },
      {
        id: 'n_capture',
        type: 'data_capture',
        name: 'Captura Nome',
        position: { x: 300, y: 0 },
        data: { promptMessage: 'Qual o seu nome?', variableName: 'cliente_nome' },
      },
      {
        id: 'n_wait',
        type: 'wait_delay',
        name: 'Espera Curta',
        position: { x: 400, y: 0 },
        data: { delaySeconds: 1 },
      },
      {
        id: 'n_pix',
        type: 'pix_charge',
        name: 'Cobrança Pix',
        position: { x: 500, y: 0 },
        data: { amount: '99.00', pixKey: 'teste@pix.local' },
      },
      {
        id: 'n_game',
        type: 'game_launcher',
        name: 'Jogo Arcade',
        position: { x: 600, y: 0 },
        data: { gameType: 'doom_retro', gameTitle: 'Doom Retro' },
      },
      {
        id: 'n_end',
        type: 'end_flow',
        name: 'Fim',
        position: { x: 700, y: 0 },
        data: { finalMessage: 'Atendimento concluído, {{cliente_nome}}!' },
      },
    ];

    const mockEdges = [
      { id: 'e1', source: 'n_trigger', target: 'n_msg' },
      { id: 'e2', source: 'n_msg', target: 'n_btn' },
      { id: 'e3', source: 'n_btn', sourceHandle: 'btn_comprar', target: 'n_capture' },
      { id: 'e4', source: 'n_capture', target: 'n_wait' },
      { id: 'e5', source: 'n_wait', target: 'n_pix' },
      { id: 'e6', source: 'n_pix', target: 'n_game' },
      { id: 'e7', source: 'n_game', target: 'n_end' },
    ];

    const mockVersion: any = {
      id: 'ver-e2e',
      flowId: 'flow-e2e',
      nodes: mockNodes,
      edges: mockEdges,
    };

    const mockSession: any = {
      id: 'sess-e2e',
      flowId: 'flow-e2e',
      flowVersionId: 'ver-e2e',
      currentNodeId: 'n_trigger',
      status: 'active',
      variables: {},
      stepHistory: [],
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    // Passo 1: Disparo a partir do gatilho (avança até o nó de botões e pausa)
    const step1 = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      { connectionId: 'c1', userJid: 'u1@s.wa.net', isSimulation: true },
      'n_trigger'
    );

    expect(step1.handled).toBe(true);
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.currentNodeId).toBe('n_btn');

    // Passo 2: Usuário clica no botão "Quero Comprar" (por texto visível)
    // Simula a entrada de usuário
    const step2 = await (FlowEngine as any).handleUserInput(
      mockSession,
      mockVersion,
      { connectionId: 'c1', userJid: 'u1@s.wa.net', userInput: 'Quero Comprar', isSimulation: true }
    );

    expect(step2.handled).toBe(true);
    expect(mockSession.status).toBe('waiting_input');
    expect(mockSession.currentNodeId).toBe('n_capture');

    // Passo 3: Usuário informa o nome "Mariana"
    const step3 = await (FlowEngine as any).handleUserInput(
      mockSession,
      mockVersion,
      { connectionId: 'c1', userJid: 'u1@s.wa.net', userInput: 'Mariana', isSimulation: true }
    );

    expect(step3.handled).toBe(true);
    expect(mockSession.variables.cliente_nome).toBe('Mariana');
    // Deve ter percorrido wait_delay -> pix_charge -> game_launcher -> end_flow
    expect(mockSession.status).toBe('completed');
    expect(step3.events.some((e: any) => e.type === 'pix_charge')).toBe(true);
    expect(step3.events.some((e: any) => e.type === 'game_launcher')).toBe(true);
    expect(step3.events.some((e: any) => e.text === 'Atendimento concluído, Mariana!')).toBe(true);
  });

  it('6. safely logs and skips unknown node types without unhandled crash', async () => {
    const mockNodes = [
      {
        id: 'unknown_1',
        type: 'alien_quantum_node' as any,
        name: 'Nó Desconhecido',
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: 'msg_after',
        type: 'message_text',
        name: 'Mensagem',
        position: { x: 100, y: 0 },
        data: { text: 'Continuando após desconhecido' },
      },
    ];

    const mockEdges = [{ id: 'e1', source: 'unknown_1', target: 'msg_after' }];

    const mockVersion: any = {
      id: 'ver-unk',
      flowId: 'flow-unk',
      nodes: mockNodes,
      edges: mockEdges,
    };

    const mockSession: any = {
      id: 'sess-unk',
      flowId: 'flow-unk',
      flowVersionId: 'ver-unk',
      currentNodeId: 'unknown_1',
      status: 'active',
      variables: {},
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    const res = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      { connectionId: 'c1', userJid: 'u1@s.wa.net', isSimulation: true },
      'unknown_1'
    );

    expect(res.handled).toBe(true);
    expect(res.events.some((e) => e.text === 'Continuando após desconhecido')).toBe(true);
  });

  it('9. supports group sessions with senderJid, senderName and isGroup flag', async () => {
    const mockNodes = [
      { id: 'start', type: 'trigger_keyword', position: { x: 0, y: 0 }, data: { keywords: ['/jogo'] } },
      { id: 'game', type: 'game_launcher', position: { x: 100, y: 0 }, data: { gameTitle: 'DOOM Retrô' } },
    ];
    const mockEdges = [{ id: 'e1', source: 'start', target: 'game' }];
    const mockVersion: any = { id: 'ver-grp', flowId: 'flow-grp', nodes: mockNodes, edges: mockEdges };

    const mockSession: any = {
      id: 'sess-grp',
      flowId: 'flow-grp',
      flowVersionId: 'ver-grp',
      currentNodeId: 'start',
      status: 'active',
      variables: {
        isGroup: true,
        senderJid: '5511999999999@s.whatsapp.net',
        senderName: 'Jogador 1',
      },
      update: vi.fn().mockImplementation((updates) => {
        Object.assign(mockSession, updates);
        return Promise.resolve(mockSession);
      }),
    };

    const res = await FlowEngine.resumeSession(
      mockSession,
      mockVersion,
      {
        connectionId: 'c1',
        userJid: '120363410842001485@g.us',
        senderJid: '5511999999999@s.whatsapp.net',
        senderName: 'Jogador 1',
        isSimulation: true,
      },
      'start'
    );

    expect(res.handled).toBe(true);
    expect(mockSession.status).toBe('completed');
    expect(res.events.some((e) => e.isGame === true)).toBe(true);
  });
});
