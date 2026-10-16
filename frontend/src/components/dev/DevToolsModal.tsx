import React, { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Search,
  Copy,
  Check,
  ExternalLink,
  Users,
  User as UserIcon,
  ShieldCheck,
  Shield,
  Download,
  Maximize2,
  RefreshCw,
  Code2,
  Send,
  Link,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import api from '../../services/api.js';
import { WhatsAppConnection } from '../../types/index.js';

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: WhatsAppConnection[];
  activeConnectionId?: string;
  initialQuery?: string;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  isOpen,
  onClose,
  connections,
  activeConnectionId,
  initialQuery,
}) => {
  const [activeTab, setActiveTab] = useState<'resolver' | 'groups' | 'generator'>('resolver');
  const [selectedConnId, setSelectedConnId] = useState<string>(activeConnectionId || connections[0]?.id || '');

  // Tab 1: Resolver States
  const [queryInput, setQueryInput] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);
  const [resolvedResult, setResolvedResult] = useState<any>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Tab 2: Groups Inspector States
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [participantSearch, setParticipantSearch] = useState<string>('');

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (activeConnectionId) {
      setSelectedConnId(activeConnectionId);
    } else if (connections.length > 0 && !selectedConnId) {
      setSelectedConnId(connections[0].id);
    }
  }, [activeConnectionId, connections]);

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQueryInput(initialQuery);
      setActiveTab('resolver');
      // Auto-trigger resolution if connection is selected
      const connId = selectedConnId || activeConnectionId || connections[0]?.id;
      if (connId) {
        setResolving(true);
        setResolveError(null);
        setResolvedResult(null);
        api
          .post('/contacts/resolve-dev', {
            connectionId: connId,
            query: initialQuery.trim(),
          })
          .then((res) => {
            if (res.data) setResolvedResult(res.data);
          })
          .catch((err) => {
            setResolveError(err.response?.data?.error || err.message || 'Erro ao consultar WhatsApp.');
          })
          .finally(() => {
            setResolving(false);
          });
      }
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (isOpen && activeTab === 'groups' && selectedConnId) {
      fetchGroups();
    }
  }, [isOpen, activeTab, selectedConnId]);

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryInput.trim() || !selectedConnId) return;

    setResolving(true);
    setResolveError(null);
    setResolvedResult(null);

    try {
      const res = await api.post('/contacts/resolve-dev', {
        connectionId: selectedConnId,
        query: queryInput.trim(),
      });
      if (res.data) {
        setResolvedResult(res.data);
      }
    } catch (err: any) {
      console.error('Erro ao resolver:', err);
      setResolveError(err.response?.data?.error || err.message || 'Erro ao consultar WhatsApp.');
    } finally {
      setResolving(false);
    }
  };

  const fetchGroups = async () => {
    if (!selectedConnId) return;
    setLoadingGroups(true);
    try {
      const res = await api.get(`/groups/connection/${selectedConnId}`);
      const list = res.data.groups || [];
      setGroups(list);
      if (list.length > 0 && !selectedGroup) {
        inspectGroup(list[0].jid);
      }
    } catch (err) {
      console.error('Erro ao listar grupos:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const inspectGroup = async (groupJid: string) => {
    if (!selectedConnId) return;
    setResolving(true);
    try {
      const res = await api.post('/contacts/resolve-dev', {
        connectionId: selectedConnId,
        query: groupJid,
      });
      if (res.data) {
        setSelectedGroup(res.data);
      }
    } catch (err) {
      console.error('Erro ao inspecionar grupo:', err);
    } finally {
      setResolving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-4xl bg-[#131722] border border-[#2a3346] rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3346] bg-[#161b26]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/30">
              <Terminal className="w-5 h-5 text-[#39ff14]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide font-mono">
                  Zaptroll Dev Tools ⚡
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/30 font-semibold">
                  DEVELOPER
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 font-sans">
                Inspetor de JID, LID, IDs de Grupo e Ferramentas para Desenvolvedores WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Session Selector */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-[#2a3346] bg-[#121620] gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('resolver')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'resolver'
                  ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Resolver JID / LID / Número</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'groups'
                  ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Inspetor de Grupos</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'generator'
                  ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Gerador de Links & Payloads</span>
            </button>
          </div>

          {/* Connection Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-medium">Sessão:</span>
            <select
              value={selectedConnId}
              onChange={(e) => setSelectedConnId(e.target.value)}
              className="bg-[#181d29] border border-[#2a3346] text-white text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:border-[#39ff14]"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phoneNumber ? `(${c.phoneNumber})` : ''} - {c.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: RESOLVER JID / LID / NÚMERO */}
          {activeTab === 'resolver' && (
            <div className="space-y-6">
              <form onSubmit={handleResolve} className="space-y-3">
                <label className="text-xs font-bold text-gray-300 block">
                  Digite ou cole qualquer Identificador (Número com DDD, JID, LID ou ID de Grupo):
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={queryInput}
                      onChange={(e) => setQueryInput(e.target.value)}
                      placeholder="Ex: 553499198782, 184907502497859@lid, 120363040554135738@g.us..."
                      className="w-full bg-[#181d29] border border-[#2a3346] text-white px-4 py-2.5 rounded-2xl text-xs font-mono placeholder:text-gray-500 focus:outline-none focus:border-[#39ff14] transition"
                    />
                    {queryInput && (
                      <button
                        type="button"
                        onClick={() => setQueryInput('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={resolving || !queryInput.trim()}
                    className="px-5 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs rounded-2xl transition flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(57,255,20,0.3)] disabled:opacity-50"
                  >
                    <Search className={`w-4 h-4 ${resolving ? 'animate-spin' : ''}`} />
                    <span>{resolving ? 'Consultando...' : 'Resolver'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="font-semibold text-gray-300">Exemplos rápidos:</span>
                  <button
                    type="button"
                    onClick={() => setQueryInput('553499198782')}
                    className="underline hover:text-[#39ff14]"
                  >
                    Pessoal (553499198782)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setQueryInput('5534933005932')}
                    className="underline hover:text-[#39ff14]"
                  >
                    Multivus (5534933005932)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setQueryInput('120363040554135738@g.us')}
                    className="underline hover:text-[#39ff14]"
                  >
                    Grupo Whaticket
                  </button>
                </div>
              </form>

              {resolveError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* Resolved Data Display */}
              {resolvedResult && (
                <div className="bg-[#161b26] border border-[#2a3346] rounded-2xl p-5 space-y-5 animate-fadeIn">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      {resolvedResult.profilePicUrl ? (
                        <img
                          src={resolvedResult.profilePicUrl}
                          alt={resolvedResult.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-[#39ff14]/40 shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#1e2535] border border-[#2a3346] flex items-center justify-center text-gray-400">
                          {resolvedResult.type === 'group' ? (
                            <Users className="w-7 h-7 text-[#39ff14]" />
                          ) : (
                            <UserIcon className="w-7 h-7 text-[#39ff14]" />
                          )}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white font-sans">
                            {resolvedResult.name}
                          </h4>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                              resolvedResult.type === 'group'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {resolvedResult.type === 'group' ? 'Grupo' : 'Contato'}
                          </span>
                        </div>
                        {resolvedResult.about && (
                          <p className="text-xs text-gray-400 italic mt-0.5 max-w-md truncate">
                            "{resolvedResult.about}"
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(resolvedResult, null, 2), 'full_json')
                      }
                      className="px-3 py-1.5 bg-[#1e2535] hover:bg-[#252f44] text-xs font-mono text-gray-300 rounded-xl border border-[#2a3346] flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedKey === 'full_json' ? (
                        <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'full_json' ? 'Copiado!' : 'Copiar JSON (Dev)'}</span>
                    </button>
                  </div>

                  {/* Identification Fields Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* JID Canônico */}
                    <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 block uppercase">
                          JID Canônico WhatsApp
                        </span>
                        <span className="font-mono text-white text-xs select-all">
                          {resolvedResult.jid || resolvedResult.groupJid}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            resolvedResult.jid || resolvedResult.groupJid,
                            'jid'
                          )
                        }
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                        title="Copiar JID"
                      >
                        {copiedKey === 'jid' ? (
                          <Check className="w-4 h-4 text-[#39ff14]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* WhatsApp LID */}
                    {resolvedResult.lid && (
                      <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-[#39ff14] block uppercase">
                            WhatsApp LID (Linked Identity)
                          </span>
                          <span className="font-mono text-white text-xs select-all">
                            {resolvedResult.lid}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(resolvedResult.lid, 'lid')}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                          title="Copiar LID"
                        >
                          {copiedKey === 'lid' ? (
                            <Check className="w-4 h-4 text-[#39ff14]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* ID do Grupo (Se for Grupo) */}
                    {resolvedResult.type === 'group' && resolvedResult.groupId && (
                      <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-purple-400 block uppercase">
                            ID Numérico Puro do Grupo
                          </span>
                          <span className="font-mono text-white text-xs select-all">
                            {resolvedResult.groupId}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(resolvedResult.groupId, 'groupId')}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                          title="Copiar ID do Grupo"
                        >
                          {copiedKey === 'groupId' ? (
                            <Check className="w-4 h-4 text-[#39ff14]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Número Puro E.164 */}
                    {resolvedResult.cleanNumber && (
                      <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            Número Puro (E.164)
                          </span>
                          <span className="font-mono text-white text-xs select-all">
                            {resolvedResult.cleanNumber} ({resolvedResult.phoneNumber})
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(resolvedResult.cleanNumber, 'cleanNumber')
                          }
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                          title="Copiar Número"
                        >
                          {copiedKey === 'cleanNumber' ? (
                            <Check className="w-4 h-4 text-[#39ff14]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Link wa.me */}
                    {resolvedResult.links?.waMe && (
                      <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-400 block uppercase">
                            Link Direto WhatsApp (wa.me)
                          </span>
                          <span className="font-mono text-gray-300 text-xs truncate max-w-[220px] block select-all">
                            {resolvedResult.links.waMe}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(resolvedResult.links.waMe, 'waMe')}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                            title="Copiar Link"
                          >
                            {copiedKey === 'waMe' ? (
                              <Check className="w-4 h-4 text-[#39ff14]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={resolvedResult.links.waMe}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
                            title="Abrir Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Dono do Grupo (Se for Grupo) */}
                    {resolvedResult.type === 'group' && resolvedResult.owner && (
                      <div className="p-3 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            Criador / Owner JID
                          </span>
                          <span className="font-mono text-white text-xs select-all">
                            {resolvedResult.owner}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(resolvedResult.owner, 'owner')}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#39ff14] transition"
                        >
                          {copiedKey === 'owner' ? (
                            <Check className="w-4 h-4 text-[#39ff14]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Participantes do Grupo (Se for grupo) */}
                  {resolvedResult.type === 'group' &&
                    resolvedResult.participants &&
                    resolvedResult.participants.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-[#2a3346]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#39ff14]" />
                            <span>
                              Participantes do Grupo ({resolvedResult.participants.length})
                            </span>
                          </span>
                          <button
                            onClick={() => {
                              const allJids = resolvedResult.participants
                                .map((p: any) => p.id)
                                .join('\n');
                              copyToClipboard(allJids, 'all_group_jids');
                            }}
                            className="px-2.5 py-1 bg-[#1e2535] hover:bg-[#252f44] text-[#39ff14] text-[11px] font-mono rounded-lg border border-[#2a3346] flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedKey === 'all_group_jids' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {copiedKey === 'all_group_jids'
                                ? 'Copiados!'
                                : 'Copiar Todos os JIDs (TXT)'}
                            </span>
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {resolvedResult.participants.map((p: any, idx: number) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2 truncate mr-2">
                                <span className="text-gray-400">#{idx + 1}</span>
                                <span className="text-white truncate">{p.id}</span>
                                {p.lid && (
                                  <span className="text-[10px] text-gray-400 truncate">
                                    (LID: {p.lid.split('@')[0]})
                                  </span>
                                )}
                                {p.admin && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-sans font-bold">
                                    {p.admin === 'superadmin' ? 'Fundador' : 'Admin'}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => copyToClipboard(p.id, `p_${idx}`)}
                                className="p-1 text-gray-400 hover:text-[#39ff14] hover:bg-white/5 rounded"
                                title="Copiar JID"
                              >
                                {copiedKey === `p_${idx}` ? (
                                  <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSPETOR DE GRUPOS */}
          {activeTab === 'groups' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Left Column: Group List */}
              <div className="md:col-span-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">
                    Grupos Conectados ({groups.length})
                  </span>
                  <button
                    onClick={fetchGroups}
                    disabled={loadingGroups}
                    className="p-1 text-gray-400 hover:text-[#39ff14]"
                    title="Atualizar Grupos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Filtrar grupos..."
                    className="w-full bg-[#181d29] border border-[#2a3346] text-white pl-8 pr-3 py-1.5 rounded-xl text-xs placeholder:text-gray-500 focus:outline-none focus:border-[#39ff14]"
                  />
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
                  {groups
                    .filter(
                      (g) =>
                        !groupSearch ||
                        g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
                        g.jid.includes(groupSearch)
                    )
                    .map((g) => {
                      const isSel = selectedGroup?.groupJid === g.jid;
                      return (
                        <div
                          key={g.id || g.jid}
                          onClick={() => inspectGroup(g.jid)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSel
                              ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-white'
                              : 'bg-[#181d29] border-[#2a3346] text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <div className="font-bold truncate">{g.name}</div>
                          <div className="text-[10px] font-mono text-gray-400 truncate mt-0.5">
                            {g.jid}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Group Inspector */}
              <div className="md:col-span-2">
                {selectedGroup ? (
                  <div className="bg-[#161b26] border border-[#2a3346] rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-bold text-white font-sans">
                          {selectedGroup.name}
                        </h4>
                        <span className="text-xs font-mono text-gray-400">
                          {selectedGroup.groupJid}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(selectedGroup, null, 2), 'sel_grp_json')
                        }
                        className="px-3 py-1.5 bg-[#1e2535] hover:bg-[#252f44] text-xs font-mono text-gray-300 rounded-xl border border-[#2a3346] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedKey === 'sel_grp_json' ? (
                          <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>JSON Dev</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-bold">
                            ID DO GRUPO (PURO)
                          </span>
                          <span className="font-mono text-white text-xs select-all">
                            {selectedGroup.groupId}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedGroup.groupId, 'g_puro')}
                          className="p-1 hover:text-[#39ff14]"
                        >
                          {copiedKey === 'g_puro' ? (
                            <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </button>
                      </div>

                      <div className="p-2.5 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-bold">
                            CRIADOR (OWNER)
                          </span>
                          <span className="font-mono text-white text-xs select-all truncate max-w-[150px] block">
                            {selectedGroup.owner || 'Não disponível'}
                          </span>
                        </div>
                        {selectedGroup.owner && (
                          <button
                            onClick={() => copyToClipboard(selectedGroup.owner, 'g_owner')}
                            className="p-1 hover:text-[#39ff14]"
                          >
                            {copiedKey === 'g_owner' ? (
                              <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Participantes */}
                    <div className="space-y-2 pt-2 border-t border-[#2a3346]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#39ff14]" />
                          <span>Membros ({selectedGroup.participants?.length || 0})</span>
                        </span>
                        <button
                          onClick={() => {
                            const txt = (selectedGroup.participants || [])
                              .map((p: any) => p.id)
                              .join('\n');
                            copyToClipboard(txt, 'copy_all_sel_g');
                          }}
                          className="text-[11px] font-mono text-[#39ff14] hover:underline flex items-center gap-1"
                        >
                          {copiedKey === 'copy_all_sel_g' ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copiar todos os JIDs</span>
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                        {(selectedGroup.participants || []).map((p: any, idx: number) => (
                          <div
                            key={idx}
                            className="px-3 py-1.5 bg-[#131722] border border-[#2a3346] rounded-xl flex items-center justify-between text-xs font-mono"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-gray-400 text-[10px]">#{idx + 1}</span>
                              <span className="text-white truncate">{p.id}</span>
                              {p.admin && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-sans font-bold">
                                  {p.admin}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => copyToClipboard(p.id, `gp_${idx}`)}
                              className="p-1 text-gray-400 hover:text-[#39ff14]"
                            >
                              {copiedKey === `gp_${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#161b26] border border-[#2a3346] rounded-2xl text-gray-400">
                    <Users className="w-10 h-10 text-gray-600 mb-2" />
                    <p className="text-xs">Selecione um grupo da lista ao lado para inspecionar.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GERADOR DE LINKS & PAYLOADS */}
          {activeTab === 'generator' && (
            <div className="space-y-6">
              <div className="bg-[#161b26] border border-[#2a3346] rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Link className="w-4 h-4 text-[#39ff14]" />
                  <span>Gerador de Link Direto wa.me</span>
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="dev-wame-input"
                    placeholder="Digite o número com DDD (ex: 553499198782)..."
                    className="flex-1 bg-[#181d29] border border-[#2a3346] text-white px-3.5 py-2 rounded-xl text-xs font-mono"
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const out = document.getElementById('dev-wame-output') as HTMLInputElement;
                      if (out) out.value = clean ? `https://wa.me/${clean}` : '';
                    }}
                  />
                  <input
                    type="text"
                    id="dev-wame-output"
                    readOnly
                    placeholder="Link gerado..."
                    className="flex-1 bg-[#131722] border border-[#2a3346] text-[#39ff14] px-3.5 py-2 rounded-xl text-xs font-mono select-all"
                  />
                  <button
                    onClick={() => {
                      const out = document.getElementById('dev-wame-output') as HTMLInputElement;
                      if (out?.value) copyToClipboard(out.value, 'wame_gen');
                    }}
                    className="px-4 py-2 bg-[#1e2535] hover:bg-[#252f44] text-white text-xs font-bold rounded-xl border border-[#2a3346] flex items-center gap-1.5"
                  >
                    {copiedKey === 'wame_gen' ? (
                      <Check className="w-3.5 h-3.5 text-[#39ff14]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar</span>
                  </button>
                </div>
              </div>

              {/* Code Snippets for Developers */}
              <div className="bg-[#161b26] border border-[#2a3346] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#39ff14]" />
                    <span>Payload de Disparo de Mensagem (cURL / API)</span>
                  </h4>
                  <button
                    onClick={() => {
                      const snippet = `curl -X POST https://zaptroll.multivus.com.br/api/messages/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <SEU_TOKEN>" \\
  -d '{
    "connectionId": "${selectedConnId}",
    "conversationId": "<ID_CONVERSA>",
    "type": "text",
    "content": "Olá via API Zaptroll!"
  }'`;
                      copyToClipboard(snippet, 'curl_snippet');
                    }}
                    className="text-xs text-[#39ff14] hover:underline flex items-center gap-1 font-mono"
                  >
                    {copiedKey === 'curl_snippet' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar cURL</span>
                  </button>
                </div>

                <pre className="p-3 bg-[#0d1017] border border-[#2a3346] rounded-xl text-[11px] font-mono text-gray-300 overflow-x-auto">
{`curl -X POST https://zaptroll.multivus.com.br/api/messages/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <SEU_TOKEN>" \\
  -d '{
    "connectionId": "${selectedConnId}",
    "conversationId": "<ID_CONVERSA>",
    "type": "text",
    "content": "Olá via API Zaptroll!"
  }'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
