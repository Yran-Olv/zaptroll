import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  LayoutTemplate,
  ShieldCheck,
  Smartphone,
  Undo2,
  Redo2,
  FolderOpen,
  Layers,
  ChevronDown,
  Sparkles,
  Zap,
  MessageSquare,
  Image as ImageIcon,
  MousePointerClick,
  ExternalLink,
  Database,
  GitBranch,
  Clock,
  Globe,
  QrCode,
  Gamepad2,
  CheckCircle,
  Download,
  Upload,
  Copy,
  Trash2,
  Search,
  FileJson,
  Check,
} from 'lucide-react';
import api from '../../services/api.js';
import { Flow, FlowVersion, FlowNode, FlowEdge, FlowNodeType } from '../../types/flows.js';
import { FlowCanvas } from './FlowCanvas.js';
import { NodePropertiesPanel } from './NodePropertiesPanel.js';
import { FlowSimulatorModal } from './FlowSimulatorModal.js';
import { TemplateSelectorModal } from './TemplateSelectorModal.js';
import { FlowDiagnosticsModal } from './FlowDiagnosticsModal.js';

interface FlowStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections?: Array<{ id: string; name: string; status: string }>;
  activeConnectionId?: string;
  initialFlowId?: string | null;
}

const PALETTE_ITEMS: Array<{
  type: FlowNodeType;
  label: string;
  category: string;
  icon: any;
  color: string;
  defaultData: Record<string, any>;
}> = [
  {
    type: 'trigger_keyword',
    label: 'Gatilho Palavra-chave',
    category: 'Gatilhos',
    icon: Zap,
    color: 'text-amber-400',
    defaultData: { keywords: ['/inicio', 'oi', 'menu'] },
  },
  {
    type: 'message_text',
    label: 'Mensagem de Texto',
    category: 'Mensagens',
    icon: MessageSquare,
    color: 'text-emerald-400',
    defaultData: { text: 'Olá! Como posso ajudar você hoje?' },
  },
  {
    type: 'interactive_buttons',
    label: 'Botões Interativos',
    category: 'Interação',
    icon: MousePointerClick,
    color: 'text-blue-400',
    defaultData: {
      content: 'Escolha uma das opções abaixo:',
      buttons: [
        { buttonId: 'btn_1', displayText: 'Fazer Pedido' },
        { buttonId: 'btn_2', displayText: 'Falar com Atendente' },
      ],
    },
  },
  {
    type: 'hosted_page_button',
    label: 'Formulário Web Hospedado',
    category: 'WebViews & Páginas',
    icon: ExternalLink,
    color: 'text-indigo-400',
    defaultData: {
      buttonText: 'Preencher Cadastro Seguro',
      schema: {
        title: 'Cadastro do Cliente',
        description: 'Preencha seus dados para entrega rápida.',
        fields: [
          { id: 'nome', label: 'Nome Completo', type: 'text', required: true },
          { id: 'telefone', label: 'Telefone WhatsApp', type: 'phone', required: true },
          { id: 'endereco', label: 'Endereço de Entrega', type: 'text', required: true },
        ],
      },
    },
  },
  {
    type: 'data_capture',
    label: 'Capturar Dados',
    category: 'Dados',
    icon: Database,
    color: 'text-cyan-400',
    defaultData: {
      promptMessage: 'Por favor, digite o seu nome:',
      variableName: 'cliente_nome',
      validationType: 'text',
    },
  },
  {
    type: 'condition',
    label: 'Condição / Desvio',
    category: 'Lógica',
    icon: GitBranch,
    color: 'text-pink-400',
    defaultData: {
      variableName: 'opcao_escolhida',
      operator: '==',
      expectedValue: '1',
    },
  },
  {
    type: 'wait_delay',
    label: 'Atraso / Espera',
    category: 'Lógica',
    icon: Clock,
    color: 'text-orange-400',
    defaultData: { delaySeconds: 2 },
  },
  {
    type: 'http_request',
    label: 'Requisição HTTP (SSRF Safe)',
    category: 'Integrações',
    icon: Globe,
    color: 'text-teal-400',
    defaultData: {
      method: 'POST',
      url: 'https://api.exemplo.com/webhook',
      outputVariable: 'api_result',
    },
  },
  {
    type: 'pix_charge',
    label: 'Cobrança Pix Dinâmica',
    category: 'Comércio',
    icon: QrCode,
    color: 'text-lime-400',
    defaultData: {
      pixKey: 'pix@zaptroll.com',
      merchantName: 'ZapTroll Comércio',
      amount: '49.90',
    },
  },
  {
    type: 'game_launcher',
    label: 'Jogo Web DOOM / RPG',
    category: 'Avançado',
    icon: Gamepad2,
    color: 'text-rose-400',
    defaultData: {
      gameType: 'doom_retro',
      gameTitle: 'DOOM Sector Retrô Arcade',
      buttonText: 'Jogar Agora 🚀',
    },
  },
  {
    type: 'end_flow',
    label: 'Encerrar Atendimento',
    category: 'Lógica',
    icon: CheckCircle,
    color: 'text-gray-400',
    defaultData: { finalMessage: 'Atendimento finalizado. Obrigado!' },
  },
];

export const FlowStudioModal: React.FC<FlowStudioModalProps> = ({
  isOpen,
  onClose,
  connections = [],
  activeConnectionId,
  initialFlowId,
}) => {
  if (!isOpen) return null;

  const [flowsList, setFlowsList] = useState<Flow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [currentVersion, setCurrentVersion] = useState<FlowVersion | null>(null);

  // Canvas State
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeSimulatedNodeId, setActiveSimulatedNodeId] = useState<string | null>(null);

  // Undo / Redo history
  const [history, setHistory] = useState<Array<{ nodes: FlowNode[]; edges: FlowEdge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Modals & Panels
  const [showSimulator, setShowSimulator] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showFlowsMenu, setShowFlowsMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-Flow Creation State
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowKeywords, setNewFlowKeywords] = useState('/inicio, menu');
  const [newFlowTemplate, setNewFlowTemplate] = useState('full_demo_suite');
  const [newFlowConnectionId, setNewFlowConnectionId] = useState('');
  const [creatingFlow, setCreatingFlow] = useState(false);

  // Search filter for flows
  const [flowSearchTerm, setFlowSearchTerm] = useState('');

  // Import / Export JSON State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importAsNew, setImportAsNew] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // Save history state
  const pushHistory = (newNodes: FlowNode[], newEdges: FlowEdge[]) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push({ nodes: newNodes, edges: newEdges });
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch all user flows on load
  const loadFlows = async () => {
    try {
      const res = await api.get('/flows');
      const flows: Flow[] = res.data.flows || [];
      setFlowsList(flows);

      if (initialFlowId && flows.some((f) => f.id === initialFlowId)) {
        loadFlowDetails(initialFlowId);
      } else if (flows.length > 0) {
        loadFlowDetails(flows[0].id);
      } else {
        // Instantiate master test demo suite if user has none
        handleInstantiateTemplate('full_demo_suite');
      }
    } catch (err) {
      console.error('Erro ao carregar fluxos:', err);
    }
  };

  // Create brand new flow
  const handleCreateNewFlow = async () => {
    if (!newFlowName.trim()) {
      alert('Por favor, informe o nome do fluxo.');
      return;
    }
    try {
      setCreatingFlow(true);
      const keywords = newFlowKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload: any = {
        name: newFlowName.trim(),
        triggerKeywords: keywords.length > 0 ? keywords : ['/inicio'],
        connectionId: newFlowConnectionId || null,
      };

      if (newFlowTemplate && newFlowTemplate !== 'blank') {
        payload.templateId = newFlowTemplate;
      }

      const res = await api.post('/flows', payload);
      const { flow, version } = res.data;

      setFlowsList((prev) => [flow, ...prev]);
      setCurrentFlow(flow);
      setCurrentVersion(version);
      setNodes(version.nodes || []);
      setEdges(version.edges || []);
      setSelectedNodeId(null);
      setHistory([{ nodes: version.nodes || [], edges: version.edges || [] }]);
      setHistoryIndex(0);

      setShowCreateFlowModal(false);
      setNewFlowName('');
      showToast(`✓ Fluxo "${flow.name}" criado com sucesso!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao criar fluxo.');
    } finally {
      setCreatingFlow(false);
    }
  };

  // Duplicate an existing flow
  const handleDuplicateFlow = async (flowId: string) => {
    try {
      const res = await api.post(`/flows/${flowId}/duplicate`);
      const { flow, version } = res.data;
      setFlowsList((prev) => [flow, ...prev]);
      setCurrentFlow(flow);
      setCurrentVersion(version);
      setNodes(version.nodes || []);
      setEdges(version.edges || []);
      setSelectedNodeId(null);
      setHistory([{ nodes: version.nodes || [], edges: version.edges || [] }]);
      setHistoryIndex(0);
      setShowFlowsMenu(false);
      showToast(`✓ Fluxo duplicado: "${flow.name}"`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao duplicar fluxo.');
    }
  };

  // Delete flow
  const handleDeleteFlow = async (flowId: string, flowName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o fluxo "${flowName}"? Esta ação removerá versões e histórico de execução associados.`)) {
      return;
    }
    try {
      await api.delete(`/flows/${flowId}`);
      const updatedList = flowsList.filter((f) => f.id !== flowId);
      setFlowsList(updatedList);
      showToast(`Fluxo "${flowName}" excluído.`);
      setShowFlowsMenu(false);
      if (currentFlow?.id === flowId) {
        if (updatedList.length > 0) {
          loadFlowDetails(updatedList[0].id);
        } else {
          handleInstantiateTemplate('full_demo_suite');
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir fluxo.');
    }
  };

  // Export flow as JSON file and clipboard
  const handleExportJson = () => {
    if (!currentFlow) return;
    try {
      const flowExportData = {
        name: currentFlow.name,
        description: currentFlow.description || '',
        triggerKeywords: currentFlow.triggerKeywords || [],
        connectionId: currentFlow.connectionId || null,
        nodes,
        edges,
        version: currentVersion?.version || 1,
        exportedAt: new Date().toISOString(),
        zaptrollVersion: '1.10.0',
      };

      const jsonStr = JSON.stringify(flowExportData, null, 2);

      // Download file
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = currentFlow.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
      link.href = url;
      link.download = `zaptroll_fluxo_${safeName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr).catch(() => {});
      }

      showToast(`✓ Fluxo "${currentFlow.name}" exportado (.json baixado e copiado)!`);
    } catch (err: any) {
      alert('Erro ao exportar fluxo: ' + err.message);
    }
  };

  // Read uploaded JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      setImportError(null);
    };
    reader.readAsText(file);
  };

  // Import flow from JSON
  const handleImportJson = async () => {
    setImportError(null);
    try {
      if (!importJsonText.trim()) {
        setImportError('Por favor, cole o código JSON ou selecione um arquivo válido.');
        return;
      }

      const parsed = JSON.parse(importJsonText);
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        setImportError('Estrutura inválida: o JSON precisa conter as propriedades "nodes" e "edges" como listas.');
        return;
      }

      if (importAsNew) {
        // Criar como novo fluxo no banco
        const flowName = parsed.name ? `${parsed.name} (Importado)` : 'Novo Fluxo Importado';
        const res = await api.post('/flows', {
          name: flowName,
          description: parsed.description || 'Importado via arquivo JSON',
          triggerKeywords: parsed.triggerKeywords || ['/inicio'],
          connectionId: parsed.connectionId || null,
        });

        const { flow } = res.data;
        const vRes = await api.put(`/flows/${flow.id}`, {
          nodes: parsed.nodes,
          edges: parsed.edges,
          name: flow.name,
          triggerKeywords: flow.triggerKeywords,
          connectionId: flow.connectionId,
        });

        setFlowsList((prev) => [flow, ...prev]);
        setCurrentFlow(flow);
        setCurrentVersion(vRes.data.version);
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        setSelectedNodeId(null);
        setHistory([{ nodes: parsed.nodes, edges: parsed.edges }]);
        setHistoryIndex(0);

        setShowImportModal(false);
        setImportJsonText('');
        showToast(`✓ Novo fluxo "${flow.name}" importado e salvo com sucesso!`);
      } else {
        // Substituir nós e conexões no fluxo atual
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        setSelectedNodeId(null);
        pushHistory(parsed.nodes, parsed.edges);

        setShowImportModal(false);
        setImportJsonText('');
        showToast('✓ Nós e conexões importados no canvas atual! Clique em "Salvar" para gravar no banco.');
      }
    } catch (err: any) {
      setImportError(`Erro de sintaxe JSON: ${err.message}`);
    }
  };

  const loadFlowDetails = async (flowId: string) => {
    try {
      const res = await api.get(`/flows/${flowId}`);
      setCurrentFlow(res.data.flow);
      setCurrentVersion(res.data.currentVersion);
      setNodes(res.data.currentVersion?.nodes || []);
      setEdges(res.data.currentVersion?.edges || []);
      setSelectedNodeId(null);
      setHistory([{ nodes: res.data.currentVersion?.nodes || [], edges: res.data.currentVersion?.edges || [] }]);
      setHistoryIndex(0);
    } catch (err) {
      console.error('Erro ao carregar detalhes do fluxo:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFlows();
    }
  }, [isOpen]);

  // Save flow version to PostgreSQL
  const handleSave = async () => {
    if (!currentFlow) return;
    try {
      setSaving(true);
      const res = await api.put(`/flows/${currentFlow.id}`, {
        nodes,
        edges,
        name: currentFlow.name,
        triggerKeywords: currentFlow.triggerKeywords,
        connectionId: currentFlow.connectionId,
      });
      setCurrentFlow(res.data.flow);
      setCurrentVersion(res.data.version);
      showToast('✓ Versão salva com sucesso no banco!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar fluxo.');
    } finally {
      setSaving(false);
    }
  };

  // Publish / Unpublish Flow
  const handleTogglePublish = async () => {
    if (!currentFlow || !currentVersion) return;
    try {
      setPublishing(true);
      if (currentFlow.status === 'published') {
        const res = await api.post(`/flows/${currentFlow.id}/unpublish`);
        setCurrentFlow(res.data.flow);
        showToast('Fluxo despublicado.');
      } else {
        const res = await api.post(`/flows/${currentFlow.id}/publish`, {
          versionId: currentVersion.id,
        });
        setCurrentFlow(res.data.flow);
        showToast('🚀 Fluxo publicado e ativo no WhatsApp!');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar publicação.');
    } finally {
      setPublishing(false);
    }
  };

  // Add block from palette to center canvas
  const handleAddBlock = (item: (typeof PALETTE_ITEMS)[0]) => {
    const newNode: FlowNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: item.type,
      name: item.label,
      position: { x: 200 + Math.random() * 80, y: 150 + Math.random() * 80 },
      data: { ...item.defaultData },
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNodeId(newNode.id);
    pushHistory(newNodes, edges);
  };

  // Duplicate node
  const handleDuplicateNode = (nodeToDup: FlowNode) => {
    const dupNode: FlowNode = {
      ...nodeToDup,
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${nodeToDup.name} (Cópia)`,
      position: { x: nodeToDup.position.x + 30, y: nodeToDup.position.y + 30 },
      data: JSON.parse(JSON.stringify(nodeToDup.data)),
    };
    const newNodes = [...nodes, dupNode];
    setNodes(newNodes);
    setSelectedNodeId(dupNode.id);
    pushHistory(newNodes, edges);
  };

  // Delete node and associated edges
  const handleDeleteNode = (nodeId: string) => {
    const newNodes = nodes.filter((n) => n.id !== nodeId);
    const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    pushHistory(newNodes, newEdges);
  };

  // Instantiate template
  const handleInstantiateTemplate = async (templateId: string) => {
    try {
      setShowTemplates(false);
      const res = await api.post(`/flows/templates/${templateId}/instantiate`);
      const { flow, version } = res.data;
      setFlowsList((prev) => [flow, ...prev]);
      setCurrentFlow(flow);
      setCurrentVersion(version);
      setNodes(version.nodes || []);
      setEdges(version.edges || []);
      setSelectedNodeId(null);
      showToast(`Modelo carregado: ${flow.name}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao carregar modelo.');
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setEdges(next.edges);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0e14] text-white select-none animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#161922] border border-[#39ff14] text-[#39ff14] px-4 py-2 rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.4)] text-xs font-mono font-bold animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="h-14 bg-[#11141c] border-b border-white/10 px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 gap-2 overflow-x-auto no-scrollbar">
        {/* Left: Brand & Flow Selector */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#161922] border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.2)] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs font-black font-mono tracking-wider text-white">
                FLOW STUDIO
              </h1>
              <span className="text-[9px] text-[#39ff14] font-mono block">
                Zapo Engine • v1.10.0
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Current Flow Menu & Selector */}
          <div className="relative">
            <button
              onClick={() => setShowFlowsMenu(!showFlowsMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-medium text-white transition-all max-w-[150px] sm:max-w-[200px]"
              title="Gerenciar e Alternar entre Fluxos"
            >
              <FolderOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">
                {currentFlow ? currentFlow.name : 'Selecione um fluxo...'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {showFlowsMenu && (
              <div className="absolute left-0 top-11 w-72 bg-[#161922] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                <div className="p-1 mb-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={flowSearchTerm}
                      onChange={(e) => setFlowSearchTerm(e.target.value)}
                      placeholder="Filtrar meus fluxos..."
                      className="w-full pl-8 pr-3 py-1.5 bg-[#0b0e14] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14]/50 font-mono"
                    />
                  </div>
                </div>

                <div className="px-2 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Fluxos Salvos ({flowsList.length})</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 my-1">
                  {flowsList
                    .filter((f) =>
                      f.name.toLowerCase().includes(flowSearchTerm.toLowerCase())
                    )
                    .map((f) => (
                      <div
                        key={f.id}
                        className={`group px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                          currentFlow?.id === f.id
                            ? 'bg-[#39ff14]/15 border border-[#39ff14]/30 text-white font-bold'
                            : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            loadFlowDetails(f.id);
                            setShowFlowsMenu(false);
                          }}
                          className="flex-1 text-left truncate flex items-center gap-1.5 mr-2"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              f.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="truncate">{f.name}</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                          {/* Botão Duplicar */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateFlow(f.id);
                            }}
                            className="p-1 text-gray-400 hover:text-cyan-300 hover:bg-white/10 rounded-lg transition"
                            title="Duplicar este fluxo"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {/* Botão Excluir */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFlow(f.id, f.name);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition"
                            title="Excluir este fluxo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-white/10 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFlowsMenu(false);
                      setShowCreateFlowModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Criar Novo Fluxo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick "+ Novo Fluxo" button in header */}
          <button
            type="button"
            onClick={() => setShowCreateFlowModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1 transition shadow-sm"
            title="Criar um Novo Fluxo para o WhatsApp"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Novo</span>
          </button>

          {/* Status Badge */}
          {currentFlow && (
            <span
              className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                currentFlow.status === 'published'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentFlow.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {currentFlow.status === 'published'
                ? `Publicado (v${currentFlow.currentVersion})`
                : 'Rascunho'}
            </span>
          )}
        </div>

        {/* Center: Conexão Vinculada & Undo/Redo */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Conexão WhatsApp selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#161922] border border-white/10 text-xs shadow-sm">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-mono text-gray-400 hidden xl:inline">Conexão:</span>
            <select
              value={currentFlow?.connectionId || ''}
              onChange={async (e) => {
                const newConnId = e.target.value || null;
                if (!currentFlow) return;
                try {
                  const res = await api.put(`/flows/${currentFlow.id}`, {
                    nodes,
                    edges,
                    name: currentFlow.name,
                    triggerKeywords: currentFlow.triggerKeywords,
                    connectionId: newConnId,
                  });
                  setCurrentFlow(res.data.flow);
                  showToast(
                    newConnId
                      ? '✓ Fluxo vinculado exclusivamente a esta conexão!'
                      : '✓ Fluxo vinculado a Todas as Conexões WhatsApp!'
                  );
                } catch (err: any) {
                  alert(err.message);
                }
              }}
              className="bg-transparent text-gray-200 text-xs font-mono focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[140px] truncate"
              title="Vincular este fluxo a uma conexão específica ou torná-lo global"
            >
              <option value="" className="bg-[#161922] text-gray-300">
                🌐 Todas as Conexões
              </option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id} className="bg-[#161922] text-emerald-300">
                  🟢 {conn.name}
                </option>
              ))}
            </select>
          </div>

          {/* Undo / Redo */}
          <div className="hidden lg:flex items-center gap-1 bg-[#161922] border border-white/10 rounded-xl p-1">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-all"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-all"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Actions, Import/Export, Templates, Test & Publish */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Import JSON */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Importar Fluxo em formato JSON"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Importar</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            disabled={!currentFlow}
            className="px-2.5 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-40"
            title="Exportar Fluxo completo em arquivo JSON e copiar código"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Templates Button */}
          <button
            onClick={() => setShowTemplates(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Abrir biblioteca de modelos prontos"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-[#39ff14]" />
            <span className="hidden md:inline">Modelos</span>
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={() => setShowDiagnostics(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Matriz de compatibilidade Zapo"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Matriz</span>
          </button>

          {/* Save Version */}
          <button
            onClick={handleSave}
            disabled={saving || !currentFlow}
            className="px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-[#39ff14]/40 text-xs font-mono text-gray-200 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Salvar alterações no banco PostgreSQL"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
          </button>

          {/* Simulator Test (Prominent Button) */}
          <button
            onClick={() => setShowSimulator(true)}
            disabled={!currentFlow || !currentVersion}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.02]"
            title="Testar fluxo em tempo real no Simulador Interativo"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Testar Fluxo</span>
          </button>

          {/* Publish / Unpublish */}
          <button
            onClick={handleTogglePublish}
            disabled={publishing || !currentFlow}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              currentFlow?.status === 'published'
                ? 'bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:bg-amber-600/50'
                : 'bg-[#39ff14] hover:bg-[#32e012] text-black shadow-[0_0_20px_rgba(57,255,20,0.3)]'
            }`}
            title="Publicar e ativar fluxo no WhatsApp ou reverter para rascunho"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {currentFlow?.status === 'published' ? 'Despublicar' : 'Publicar'}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            title="Fechar Flow Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* WORKSPACE AREA (Left Palette + Center Canvas + Right Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT BLOCK PALETTE */}
        <aside className="w-56 bg-[#11141c] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto p-3 space-y-4">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
            <span>Biblioteca de Blocos</span>
            <span className="text-[9px] text-[#39ff14]">{PALETTE_ITEMS.length} blocos</span>
          </div>

          <div className="space-y-1.5">
            {PALETTE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(item)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#161922] hover:bg-[#1f2430] border border-white/5 hover:border-white/15 transition-all flex items-center gap-2.5 group"
                >
                  <div className={`p-1.5 rounded-lg bg-black/40 ${item.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-medium text-gray-200 group-hover:text-white block truncate">
                      {item.label}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono block">
                      {item.category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER INTERACTIVE CANVAS */}
        <main className="flex-1 relative overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            activeSimulatedNodeId={activeSimulatedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNodes={(updated) => {
              setNodes(updated);
              pushHistory(updated, edges);
            }}
            onUpdateEdges={(updated) => {
              setEdges(updated);
              pushHistory(nodes, updated);
            }}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
          />
        </main>

        {/* RIGHT PROPERTIES DRAWER */}
        {selectedNode && (
          <NodePropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={(updated) => {
              const newNodes = nodes.map((n) => (n.id === updated.id ? updated : n));
              setNodes(newNodes);
            }}
          />
        )}
      </div>

      {/* BOTTOM STATUS FOOTER */}
      <footer className="h-8 bg-[#11141c] border-t border-white/10 px-4 flex items-center justify-between text-[11px] font-mono text-gray-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>{nodes.length} nós no fluxo</span>
          <span>{edges.length} conexões ativas</span>
          <span className="text-emerald-400">✓ Grafo validado</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Zaptroll Flow Studio • Versão Estável</span>
        </div>
      </footer>

      {/* SUB-MODALS */}
      {showSimulator && currentFlow && currentVersion && (
        <FlowSimulatorModal
          isOpen={showSimulator}
          onClose={() => {
            setShowSimulator(false);
            setActiveSimulatedNodeId(null);
          }}
          flow={currentFlow}
          version={currentVersion}
          onHighlightNode={setActiveSimulatedNodeId}
          connections={connections}
        />
      )}

      {showTemplates && (
        <TemplateSelectorModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={handleInstantiateTemplate}
        />
      )}

      {showDiagnostics && (
        <FlowDiagnosticsModal
          isOpen={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}

      {/* 4. MODAL CRIAR NOVO FLUXO */}
      {showCreateFlowModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#161922] border border-[#2a3346] w-full max-w-lg rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-mono text-white">Criar Novo Fluxo</h2>
                  <p className="text-[11px] text-gray-400">Configure um novo fluxo automatizado para o WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateFlowModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">Nome do Fluxo *</label>
                <input
                  type="text"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="Ex: Atendimento Suporte VIP, Vendas Delivery..."
                  className="w-full px-3 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Palavras-chave de Gatilho (separadas por vírgula)</label>
                <input
                  type="text"
                  value={newFlowKeywords}
                  onChange={(e) => setNewFlowKeywords(e.target.value)}
                  placeholder="Ex: /inicio, /suporte, oi, cardapio"
                  className="w-full px-3 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14]"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Quando o cliente enviar alguma dessas palavras, este fluxo será disparado.
                </span>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Estrutura Inicial / Modelo</label>
                <select
                  value={newFlowTemplate}
                  onChange={(e) => setNewFlowTemplate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#39ff14]"
                >
                  <option value="full_demo_suite">🧪 Suíte Completa de Testes (Todos os 11 Blocos) - Recomendado</option>
                  <option value="welcome_menu">👋 Atendimento & Menu de Opções</option>
                  <option value="order_delivery_form">📦 Pedido Comercial com Formulário Web</option>
                  <option value="pix_checkout">💳 Checkout de Pagamento Pix com QR Code</option>
                  <option value="doom_game">🕹️ Arcade Retrô DOOM no Navegador</option>
                  <option value="rpg_arena">⚔️ Arena RPG Parlamentar</option>
                  <option value="blank">📄 Em Branco (Apenas Gatilho e Mensagem)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Conexão WhatsApp Vinculada</label>
                <select
                  value={newFlowConnectionId}
                  onChange={(e) => setNewFlowConnectionId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#39ff14]"
                >
                  <option value="">🌐 Todas as Conexões WhatsApp (Global)</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      🟢 {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-5 border-t border-white/10 mt-5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowCreateFlowModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewFlow}
                disabled={creatingFlow || !newFlowName.trim()}
                className="px-4 py-2 rounded-xl bg-[#39ff14] hover:bg-[#32e012] text-black font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(57,255,20,0.3)] transition disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingFlow ? 'Criando...' : 'Criar Fluxo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL IMPORTAR FLUXO JSON */}
      {showImportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#161922] border border-[#2a3346] w-full max-w-xl rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-mono text-white">Importar Fluxo JSON</h2>
                  <p className="text-[11px] text-gray-400">Carregue um arquivo .json ou cole a estrutura do fluxo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* File Upload Option */}
              <div className="p-4 border-2 border-dashed border-white/10 hover:border-cyan-500/50 rounded-2xl bg-[#0b0e14] text-center transition">
                <FileJson className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
                <label className="cursor-pointer text-cyan-300 hover:text-cyan-200 font-bold block mb-1">
                  Clique aqui para selecionar arquivo .json
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-gray-500">Ou cole o conteúdo JSON na área abaixo</span>
              </div>

              {/* Textarea for JSON code */}
              <div>
                <label className="block text-gray-300 mb-1">Código JSON do Fluxo</label>
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportError(null);
                  }}
                  rows={6}
                  placeholder='{"name": "Meu Fluxo", "nodes": [...], "edges": [...]}'
                  className="w-full px-3 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 font-mono text-[11px]"
                />
              </div>

              {importError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Mode Selection */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-gray-300 font-bold block">Como deseja aplicar o fluxo?</span>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importAsNew}
                    onChange={() => setImportAsNew(true)}
                    className="text-[#39ff14] focus:ring-0"
                  />
                  <span>Criar como um <b>Novo Fluxo</b> independente no banco</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                  <input
                    type="radio"
                    name="importMode"
                    checked={!importAsNew}
                    onChange={() => setImportAsNew(false)}
                    className="text-[#39ff14] focus:ring-0"
                  />
                  <span>Substituir nós e conexões no <b>Fluxo Atual ({currentFlow?.name})</b></span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-5 border-t border-white/10 mt-5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                disabled={!importJsonText.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Fluxo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
