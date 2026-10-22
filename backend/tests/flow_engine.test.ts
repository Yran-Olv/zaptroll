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
    expect(mockSession.waitingFor).toBe('button');
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
});
