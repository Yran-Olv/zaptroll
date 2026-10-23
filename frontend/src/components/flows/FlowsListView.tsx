import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Play,
  Copy,
  Trash2,
  CheckCircle2,
  Smartphone,
  ExternalLink,
  Zap,
  ArrowRight,
  Layers,
  LayoutTemplate,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api.js';
import { Flow } from '../../types/flows.js';

interface FlowsListViewProps {
  onOpenFlowStudio: (flowId?: string) => void;
  connections?: Array<{ id: string; name: string; status: string }>;
}

export const FlowsListView: React.FC<FlowsListViewProps> = ({
  onOpenFlowStudio,
  connections = [],
}) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateConnection = async (flow: Flow, newConnId: string | null) => {
    try {
      setActionLoadingId(flow.id);
      const res = await api.put(`/flows/${flow.id}`, {
        name: flow.name,
        triggerKeywords: flow.triggerKeywords,
        connectionId: newConnId,
      });
      setFlows((prev) =>
        prev.map((f) => (f.id === flow.id ? res.data.flow : f))
      );
      showToast(
        newConnId
          ? '✓ Conexão salva! Fluxo ativo nesta linha WhatsApp.'
          : '✓ Conexão salva! Fluxo ativo em Todas as Conexões.'
      );
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const res = await api.get('/flows');
      setFlows(res.data.flows || []);
    } catch (err) {
      console.error('Erro ao carregar lista de fluxos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const handleTogglePublish = async (flow: Flow) => {
    try {
      setActionLoadingId(flow.id);
      if (flow.status === 'published') {
        await api.post(`/flows/${flow.id}/unpublish`);
      } else {
        await api.post(`/flows/${flow.id}/publish`, {});
      }
      await fetchFlows();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status de publicação.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (flowId: string) => {
    try {
      setActionLoadingId(flowId);
      await api.post(`/flows/${flowId}/duplicate`);
      await fetchFlows();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao duplicar fluxo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (flowId: string, flowName: string) => {
    if (!confirm(`Deseja excluir permanentemente o fluxo "${flowName}"?`)) return;
    try {
      setActionLoadingId(flowId);
      await api.delete(`/flows/${flowId}`);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir fluxo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredFlows = flows.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.triggerKeywords || []).some((kw) => kw.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'published' ? f.status === 'published' : f.status !== 'published';
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Top Header */}
      <div className="lab-glass sticky top-0 z-10 px-4 py-3 border-b border-[#2a3346] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <span>Fluxos do WhatsApp</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300">
                  {flows.length} {flows.length === 1 ? 'fluxo' : 'fluxos'}
                </span>
              </h1>
              <span className="text-[10px] font-mono text-gray-400 block">
                Zaptroll Flow Studio • Automações visuais
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenFlowStudio()}
            className="px-3 py-1.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(57,255,20,0.3)] flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Abrir Studio</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou gatilho (/teste, /pedido)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] font-mono"
            />
          </div>

          <div className="flex items-center bg-[#161922] border border-[#2a3346] rounded-xl p-0.5 shrink-0 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded-lg transition ${
                statusFilter === 'all' ? 'bg-[#2a3346] text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('published')}
              className={`px-2 py-1 rounded-lg transition ${
                statusFilter === 'published' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('draft')}
              className={`px-2 py-1 rounded-lg transition ${
                statusFilter === 'draft' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Rascunho
            </button>
          </div>
        </div>
      </div>

      {/* Flows Content Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-16 md:pb-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500 text-xs font-mono">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2 opacity-60" />
            <span>Sincronizando fluxos com o banco...</span>
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-gray-400 font-mono">
            <Zap className="w-10 h-10 text-gray-600 mb-2" />
            <h3 className="text-sm font-bold text-gray-200">Nenhum fluxo encontrado</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mb-4">
              Crie seu primeiro fluxo de atendimento ou carregue a suíte completa de testes.
            </p>
            <button
              type="button"
              onClick={() => onOpenFlowStudio()}
              className="px-4 py-2 rounded-xl bg-[#39ff14] text-black font-bold text-xs flex items-center gap-1.5 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>Criar Primeiro Fluxo</span>
            </button>
          </div>
        ) : (
          filteredFlows.map((flow) => {
            const isPublished = flow.status === 'published';
            const boundConn = connections.find((c) => c.id === flow.connectionId);

            return (
              <div
                key={flow.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isPublished
                    ? 'bg-[#121620] border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                    : 'bg-[#121620] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Flow Top Bar */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isPublished
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <span>{isPublished ? '● Ativo no WhatsApp' : 'Rascunho'}</span>
                      </span>

                      <span className="text-[10px] font-mono text-gray-500">
                        v{flow.currentVersion || 1}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold font-mono text-white truncate">
                      {flow.name}
                    </h3>

                    {flow.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {flow.description}
                      </p>
                    )}
                  </div>

                  {/* Quick Edit button */}
                  <button
                    type="button"
                    onClick={() => onOpenFlowStudio(flow.id)}
                    className="px-2.5 py-1 bg-white/5 hover:bg-[#39ff14] text-gray-300 hover:text-black font-mono font-bold text-xs rounded-xl border border-white/10 hover:border-[#39ff14] flex items-center gap-1 transition shrink-0"
                    title="Editar este fluxo no Flow Studio"
                  >
                    <span>Editar</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Trigger Keywords & Connection info */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  {/* Triggers */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-500 text-[10px]">Gatilhos:</span>
                    {(flow.triggerKeywords || []).map((kw) => (
                      <span
                        key={kw}
                        className="px-1.5 py-0.5 bg-blue-950/40 border border-blue-500/30 text-blue-300 rounded text-[10px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Bound Connection Selector */}
                  <div className="flex items-center gap-1.5 bg-[#161922] border border-white/10 rounded-xl px-2 py-0.5 shrink-0">
                    <Smartphone className="w-3 h-3 text-emerald-400 shrink-0" />
                    <select
                      value={flow.connectionId || ''}
                      disabled={actionLoadingId === flow.id}
                      onChange={(e) => handleUpdateConnection(flow, e.target.value || null)}
                      className="bg-transparent text-[11px] font-mono text-gray-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
                      title="Vincular este fluxo a uma conexão WhatsApp"
                    >
                      <option value="" className="bg-[#161922] text-gray-300">
                        🌐 Todas as Conexões
                      </option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#161922] text-emerald-300">
                          🟢 {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="pt-2.5 mt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Publish button */}
                    <button
                      type="button"
                      disabled={actionLoadingId === flow.id}
                      onClick={() => handleTogglePublish(flow)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 transition ${
                        isPublished
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300'
                      }`}
                      title={isPublished ? 'Pausar fluxo no WhatsApp' : 'Ativar e publicar no WhatsApp'}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isPublished ? 'Desativar' : 'Ativar no WhatsApp'}</span>
                    </button>

                    {/* Test in Simulator */}
                    <button
                      type="button"
                      onClick={() => onOpenFlowStudio(flow.id)}
                      className="px-2.5 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold flex items-center gap-1 transition"
                      title="Abrir no Simulador"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Testar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Duplicate */}
                    <button
                      type="button"
                      disabled={actionLoadingId === flow.id}
                      onClick={() => handleDuplicate(flow.id)}
                      className="p-1.5 text-gray-400 hover:text-cyan-300 hover:bg-white/10 rounded-xl transition"
                      title="Duplicar fluxo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={actionLoadingId === flow.id}
                      onClick={() => handleDelete(flow.id, flow.name)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition"
                      title="Excluir fluxo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161922] border border-[#39ff14]/50 shadow-[0_0_20px_rgba(57,255,20,0.3)] text-white text-xs font-mono px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-2 h-2 rounded-full bg-[#39ff14] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
