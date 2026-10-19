import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Smartphone,
  MessageSquare,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  Lock,
  Unlock,
  Terminal,
} from 'lucide-react';
import api from '../../services/api.js';

export const AdminView: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/audit-logs'),
      ]);
      setStats(statsRes.data.stats);
      setUsers(usersRes.data.users);
      setAuditLogs(logsRes.data.logs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/users/${user.id}`, { status: newStatus });
      setUsers(users.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status do usuário.');
    }
  };

  const handleUpdateLimit = async (userId: string, maxConnections: number) => {
    try {
      await api.put(`/admin/users/${userId}`, { maxConnections });
      setUsers(users.map((u) => (u.id === userId ? { ...u, maxConnections } : u)));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar cota.');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto">
      {/* Header */}
      <div className="lab-glass sticky top-0 z-10 px-4 py-3 border-b border-[#2a3346] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-purple-950/60 border border-purple-500/40 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold font-mono text-white">Painel Central do Laboratório</h1>
            <p className="text-[11px] text-gray-400 font-mono">Gestão global de usuários, cotas e auditoria</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto w-full space-y-4 pb-16 md:pb-6">
        {/* Metric Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161922] p-4 rounded-2xl border border-[#2a3346] shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-1 font-mono">
                <span className="text-xs font-semibold">Usuários</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.totalUsers}</div>
            </div>

            <div className="bg-[#161922] p-4 rounded-2xl border border-[#2a3346] shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-1 font-mono">
                <span className="text-xs font-semibold">Sessões Ativas</span>
                <Smartphone className="w-4 h-4 text-[#39ff14]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#39ff14]">
                {stats.connectedConnections} / {stats.totalConnections}
              </div>
            </div>

            <div className="bg-[#161922] p-4 rounded-2xl border border-[#2a3346] shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-1 font-mono">
                <span className="text-xs font-semibold">Mensagens</span>
                <MessageSquare className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.totalMessages}</div>
            </div>

            <div className="bg-[#161922] p-4 rounded-2xl border border-[#2a3346] shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-1 font-mono">
                <span className="text-xs font-semibold">Em Memória Zapo</span>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.activeInMemorySessions}</div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-[#161922] p-1 rounded-2xl max-w-xs border border-[#2a3346]">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-xl transition ${
              activeTab === 'users' ? 'bg-[#1a202c] text-[#39ff14] shadow' : 'text-gray-400'
            }`}
          >
            Usuários ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-xl transition ${
              activeTab === 'logs' ? 'bg-[#1a202c] text-[#39ff14] shadow' : 'text-gray-400'
            }`}
          >
            Auditoria ({auditLogs.length})
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="bg-[#161922] rounded-2xl border border-[#2a3346] shadow-sm overflow-hidden">
            <div className="p-3 border-b border-[#2a3346]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-[#12151c] border border-[#2a3346] text-white rounded-xl text-xs focus:outline-none focus:border-[#39ff14] font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12151c] text-gray-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#2a3346]">
                  <tr>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Papel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Limite Sessões</th>
                    <th className="px-4 py-3">Criadas</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a3346]/50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1a202c]/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white font-sans">{u.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40'
                              : 'bg-gray-800 text-gray-300 border border-gray-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'active'
                              ? 'bg-emerald-950/60 text-[#39ff14] border border-[#10b981]/40'
                              : 'bg-red-950/60 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {u.status === 'active' ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          defaultValue={u.maxConnections}
                          onBlur={(e) => handleUpdateLimit(u.id, Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-[#12151c] text-white border border-[#2a3346] rounded-lg text-xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono">
                        {u.connections?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition ${
                            u.status === 'active'
                              ? 'border-red-500/40 text-red-400 hover:bg-red-950/40'
                              : 'border-[#10b981]/40 text-[#39ff14] hover:bg-emerald-950/40'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspender' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#161922] rounded-2xl border border-[#2a3346] shadow-sm p-4 space-y-2">
            <h3 className="text-xs font-mono font-bold text-gray-300 uppercase">Eventos Recentes de Auditoria</h3>
            <div className="divide-y divide-[#2a3346]/50 text-xs font-mono">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white">{log.action}</span>
                    <span className="text-[#39ff14] text-[11px] ml-2">
                      ({log.resource})
                    </span>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Executado por: {log.user?.name || 'Sistema'} • IP: {log.ipAddress || 'local'}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
