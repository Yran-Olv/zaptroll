import React, { useState, useEffect } from 'react';
import { Users, Search, MessageSquare, RefreshCw, Plus, Swords, X, ShieldAlert } from 'lucide-react';
import api from '../../services/api.js';
import { Group, WhatsAppConnection } from '../../types/index.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';

interface GroupsViewProps {
  connection: WhatsAppConnection | null;
  onSelectGroup?: (group: Group) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({ connection, onSelectGroup }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Create Group Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupParticipants, setNewGroupParticipants] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchGroups = () => {
    if (!connection) return;
    setLoading(true);
    api
      .get(`/groups/connection/${connection.id}?search=${encodeURIComponent(search)}`)
      .then((res) => setGroups(res.data.groups))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, [connection?.id, search]);

  const handleSyncGroups = async () => {
    if (!connection || syncing) return;
    setSyncing(true);
    setActionError(null);
    try {
      await api.post(`/groups/sync/${connection.id}`);
      fetchGroups();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Erro ao sincronizar grupos.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connection || !newGroupName.trim() || creatingGroup) return;

    setCreatingGroup(true);
    setActionError(null);
    setActionSuccess(null);

    const participants = newGroupParticipants
      .split(/[\n,;]+/)
      .map((p) => p.trim().replace(/\D/g, ''))
      .filter((p) => p.length >= 8)
      .map((p) => (p.includes('@') ? p : `${p}@s.whatsapp.net`));

    try {
      const res = await api.post(`/groups/connection/${connection.id}`, {
        subject: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        participants,
      });

      setActionSuccess(`Grupo "${newGroupName}" criado com sucesso!`);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupParticipants('');
      setShowCreateModal(false);
      fetchGroups();

      if (res.data.group && onSelectGroup) {
        onSelectGroup(res.data.group);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Erro ao criar grupo no WhatsApp.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleLaunchRpgInGroup = async (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!connection) return;

    try {
      await api.post('/messages/send', {
        connectionId: connection.id,
        recipientJid: group.jid,
        messageType: 'text',
        content: '/rpg',
      });
      setActionSuccess(`Comando /rpg enviado para o grupo "${group.name}"!`);
      if (onSelectGroup) {
        onSelectGroup(group);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Erro ao disparar RPG no grupo.');
    }
  };

  if (!connection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-[#0d1117]">
        <Users className="w-12 h-12 text-gray-600 mb-2" />
        <h3 className="text-sm font-bold text-gray-200 font-mono">Nenhuma Conexão Selecionada</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs font-mono">
          Vá para a aba Conexões e selecione uma sessão ativa para ver os grupos do WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden relative">
      {/* Search & Actions Header */}
      <div className="lab-glass sticky top-0 z-10 px-4 py-3 border-b border-[#2a3346]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold font-mono text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#39ff14]" />
            <span>Grupos de Teste ({groups.length})</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1 bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
              title="Criar novo grupo de WhatsApp"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Grupo</span>
            </button>
            <button
              type="button"
              onClick={handleSyncGroups}
              disabled={syncing}
              className="px-2.5 py-1 bg-[#161922] hover:bg-[#1a202c] border border-[#2a3346] hover:border-[#39ff14] text-[#39ff14] text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              title="Sincronizar grupos do WhatsApp"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="mb-2 p-2 bg-[#39ff14]/10 border border-[#39ff14]/40 rounded-xl text-xs text-[#39ff14] font-mono flex items-center justify-between">
            <span>✅ {actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-gray-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-2 p-2 bg-red-950/40 border border-red-500/50 rounded-xl text-xs text-red-400 font-mono flex items-center justify-between">
            <span>⚠️ {actionError}</span>
            <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome de grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition font-mono"
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-16 md:pb-3">
        {loading ? (
          <div className="text-center py-8 text-xs text-gray-400 font-mono">
            Carregando grupos...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-500 font-mono space-y-2">
            <div>Nenhum grupo sincronizado para esta sessão.</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/40 text-[#39ff14] text-xs font-mono font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Primeiro Grupo
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              onClick={() => onSelectGroup?.(group)}
              className="bg-[#161922] p-3 rounded-2xl border border-[#2a3346] hover:border-[#39ff14]/50 flex items-center justify-between cursor-pointer transition shadow-sm hover:scale-[1.005]"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <MemeAvatar
                  seed={group.jid || group.name || 'group'}
                  name={group.name}
                  size="md"
                />
                <div className="min-w-0 truncate">
                  <h4 className="text-xs font-bold text-white font-sans truncate">{group.name}</h4>
                  <p className="text-[11px] text-gray-400 font-mono truncate">
                    {group.participantCount > 0 ? `${group.participantCount} membros • ` : ''}
                    {group.jid}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleLaunchRpgInGroup(group, e)}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:text-amber-300 text-[11px] font-mono font-bold rounded-xl flex items-center gap-1 transition"
                  title="Testar RPG neste grupo (/rpg)"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>RPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectGroup?.(group)}
                  className="p-1.5 text-[#39ff14] hover:bg-[#1a202c] rounded-xl transition border border-transparent hover:border-[#2a3346]"
                  title="Abrir chat do grupo"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Criar Grupo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-[#2a3346] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a3346] pb-3">
              <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#39ff14]" />
                Criar Novo Grupo WhatsApp
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">
                  Nome do Grupo (Obrigatório)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 🏛️ Arena Política RPG"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Grupo oficial de combate de cartas do Zaptroll RPG."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition resize-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">
                  Participantes Iniciais (Opcional - Telefones separados por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5534999999999, 5511888888888"
                  value={newGroupParticipants}
                  onChange={(e) => setNewGroupParticipants(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161922] border border-[#2a3346] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  O WhatsApp adicionará você automaticamente como Administrador do Grupo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2a3346]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#2a3346] text-gray-400 hover:text-white hover:bg-[#161922] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-[#39ff14] text-black font-bold hover:bg-[#32e010] transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingGroup ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Criando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Grupo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

