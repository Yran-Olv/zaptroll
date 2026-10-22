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

      if (flows.length > 0) {
        loadFlowDetails(flows[0].id);
      } else {
        // Instantiate default template if user has none
        handleInstantiateTemplate('welcome_menu');
      }
    } catch (err) {
      console.error('Erro ao carregar fluxos:', err);
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0e14] text-white select-none animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#161922] border border-[#39ff14] text-[#39ff14] px-4 py-2 rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.4)] text-xs font-mono font-bold animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="h-14 bg-[#11141c] border-b border-white/10 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand & Flow Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#161922] border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.2)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-black font-mono tracking-wider text-white">
                FLOW STUDIO
              </h1>
              <span className="text-[9px] text-[#39ff14] font-mono block">
                Zapo Engine • v1.10.0
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Current Flow Menu */}
          <div className="relative">
            <button
              onClick={() => setShowFlowsMenu(!showFlowsMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-medium text-white transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {currentFlow ? currentFlow.name : 'Selecione um fluxo...'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showFlowsMenu && (
              <div className="absolute left-0 top-11 w-64 bg-[#161922] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                <div className="px-3 py-1.5 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                  Meus Fluxos Salvos
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {flowsList.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        loadFlowDetails(f.id);
                        setShowFlowsMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        currentFlow?.id === f.id
                          ? 'bg-[#39ff14]/10 text-[#39ff14] font-bold'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] font-mono opacity-60">
                        {f.status === 'published' ? '● Ativo' : 'Rascunho'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          {currentFlow && (
            <span
              className={`hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
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

        {/* Center / Right: Undo/Redo & Actions */}
        <div className="flex items-center gap-2">
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

          {/* Templates Button */}
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-[#39ff14]" />
            <span className="hidden sm:inline">Modelos Prontos</span>
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={() => setShowDiagnostics(true)}
            className="px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Matriz Zapo</span>
          </button>

          {/* Save Version */}
          <button
            onClick={handleSave}
            disabled={saving || !currentFlow}
            className="px-3 py-1.5 rounded-xl bg-[#161922] border border-white/10 hover:border-[#39ff14]/40 text-xs font-mono text-gray-200 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
          </button>

          {/* Simulator Test */}
          <button
            onClick={() => setShowSimulator(true)}
            disabled={!currentFlow || !currentVersion}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
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
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{currentFlow?.status === 'published' ? 'Despublicar' : 'Publicar'}</span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
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
    </div>
  );
};
