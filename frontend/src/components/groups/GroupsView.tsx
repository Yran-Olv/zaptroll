import React, { useState, useEffect } from 'react';
import { Users, Search, MessageSquare, RefreshCw } from 'lucide-react';
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
    try {
      await api.post(`/groups/sync/${connection.id}`);
      fetchGroups();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao sincronizar grupos.');
    } finally {
      setSyncing(false);
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
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Search Header */}
      <div className="lab-glass sticky top-0 z-10 px-4 py-3 border-b border-[#2a3346]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold font-mono text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#39ff14]" />
            <span>Grupos de Teste ({groups.length})</span>
          </h1>
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
          <div className="text-center py-12 text-xs text-gray-500 font-mono">
            Nenhum grupo sincronizado para esta sessão.
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              onClick={() => onSelectGroup?.(group)}
              className="bg-[#161922] p-3 rounded-2xl border border-[#2a3346] hover:border-[#39ff14]/50 flex items-center justify-between cursor-pointer transition shadow-sm hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3">
                <MemeAvatar
                  seed={group.jid || group.name || 'group'}
                  name={group.name}
                  size="md"
                />
                <div>
                  <h4 className="text-xs font-bold text-white font-sans">{group.name}</h4>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {group.participantCount > 0 ? `${group.participantCount} membros • ` : ''}
                    {group.jid}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="p-2 text-[#39ff14] hover:bg-[#1a202c] rounded-xl transition border border-transparent hover:border-[#2a3346]"
                title="Abrir grupo"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
