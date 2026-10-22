import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  QrCode,
  KeyRound,
  Power,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  Flame,
  Terminal,
} from 'lucide-react';
import api from '../../services/api.js';
import { WhatsAppConnection } from '../../types/index.js';
import { useSocket } from '../../contexts/SocketContext.js';

interface ConnectionsViewProps {
  onSelectConnection?: (conn: WhatsAppConnection) => void;
  selectedConnectionId?: string | null;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  onSelectConnection,
  selectedConnectionId,
}) => {
  const { socket } = useSocket();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [activeModalConn, setActiveModalConn] = useState<WhatsAppConnection | null>(null);
  const [activeAuthTab, setActiveAuthTab] = useState<'qr' | 'pairing'>('qr');
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      const res = await api.get('/connections');
      setConnections(res.data.connections);
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  // Real-time socket listeners for QR, pairing code and status
  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: { connectionId: string; status: any; phoneNumber?: string }) => {
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId
            ? {
                ...conn,
                status: data.status,
                phoneNumber: data.phoneNumber || conn.phoneNumber,
                qrCode: data.status === 'connected' ? null : conn.qrCode,
                pairingCode: data.status === 'connected' ? null : conn.pairingCode,
              }
            : conn
        )
      );

      // Auto-close modal when successfully connected
      if (data.status === 'connected' && activeModalConn?.id === data.connectionId) {
        setActiveModalConn((prev) => (prev ? { ...prev, status: 'connected' } : null));
      }
    };

    const handleQr = (data: { connectionId: string; qr: string; ttlMs: number }) => {
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId
            ? { ...conn, qrCode: data.qr, status: 'awaiting_auth' }
            : conn
        )
      );
      if (activeModalConn?.id === data.connectionId) {
        setActiveModalConn((prev) => (prev ? { ...prev, qrCode: data.qr, status: 'awaiting_auth' } : null));
      }
    };

    const handlePairingCode = (data: { connectionId: string; code: string }) => {
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === data.connectionId
            ? { ...conn, pairingCode: data.code, status: 'awaiting_auth' }
            : conn
        )
      );
      if (activeModalConn?.id === data.connectionId) {
        setActiveModalConn((prev) => (prev ? { ...prev, pairingCode: data.code, status: 'awaiting_auth' } : null));
      }
    };

    socket.on('connection_status', handleStatus);
    socket.on('connection_qr', handleQr);
    socket.on('connection_pairing_code', handlePairingCode);

    return () => {
      socket.off('connection_status', handleStatus);
      socket.off('connection_qr', handleQr);
      socket.off('connection_pairing_code', handlePairingCode);
    };
  }, [socket, activeModalConn?.id]);

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConnName.trim()) return;

    try {
      const res = await api.post('/connections', { name: newConnName.trim() });
      setConnections([res.data.connection, ...connections]);
      setNewConnName('');
      setCreating(false);
      handleConnect(res.data.connection);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao criar conexão.');
    }
  };

  const handleConnect = async (conn: WhatsAppConnection) => {
    try {
      setActiveModalConn(conn);
      setActiveAuthTab('qr');
      setPairingError(null);
      await api.post(`/connections/${conn.id}/connect`);
      fetchConnections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar conexão.');
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalConn || !phoneNumberInput.trim()) return;

    setPairingLoading(true);
    setPairingError(null);

    try {
      const res = await api.post(`/connections/${activeModalConn.id}/pairing-code`, {
        phoneNumber: phoneNumberInput.trim(),
      });
      setActiveModalConn({ ...activeModalConn, pairingCode: res.data.code });
      fetchConnections();
    } catch (err: any) {
      setPairingError(err.response?.data?.error || 'Erro ao gerar código de pareamento.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDisconnect = async (connId: string) => {
    try {
      await api.post(`/connections/${connId}/disconnect`);
      fetchConnections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao desconectar.');
    }
  };

  const handleDelete = async (connId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão e seus dados locais?')) return;

    try {
      await api.delete(`/connections/${connId}`);
      setConnections(connections.filter((c) => c.id !== connId));
      if (activeModalConn?.id === connId) setActiveModalConn(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir conexão.');
    }
  };

  const formatPairingCode = (code: string) => {
    if (!code) return '';
    const clean = code.replace(/[^A-Za-z0-9]/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return code;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto">
      {/* Header */}
      <div className="lab-glass sticky top-0 z-10 px-3.5 py-2.5 border-b border-[#2a3346] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold font-mono text-white flex items-center gap-2 truncate">
            <Smartphone className="w-4 h-4 text-[#39ff14] shrink-0" />
            <span className="truncate">Sessões WhatsApp</span>
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-400 font-mono truncate">
            Instâncias conectadas para testes e trollagens
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-mono font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(57,255,20,0.3)] transition cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Sessão</span>
        </button>
      </div>

      {/* Connection List */}
      <div className="p-4 max-w-4xl mx-auto w-full space-y-3 pb-16 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-gray-400 font-mono text-xs">
            <div className="w-5 h-5 border-2 border-[#39ff14] border-t-transparent rounded-full animate-spin mr-2.5" />
            Carregando sessões...
          </div>
        ) : connections.length === 0 ? (
          <div className="bg-[#161922] rounded-3xl p-10 text-center border border-[#2a3346] shadow-xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#1a202c] text-[#39ff14] border border-[#39ff14]/30 rounded-2xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold font-mono text-white">Nenhuma sessão registrada</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto font-mono">
              Crie sua primeira sessão para conectar seu WhatsApp via QR Code ou Código de Pareamento e liberar o caos no laboratório.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-5 px-5 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black text-xs font-mono font-bold rounded-xl inline-flex items-center gap-2 shadow-lg shadow-[#39ff14]/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Sessão</span>
            </button>
          </div>
        ) : (
          connections.map((conn) => {
            const isSelected = selectedConnectionId === conn.id;
            return (
              <div
                key={conn.id}
                onClick={() => onSelectConnection?.(conn)}
                className={`bg-[#161922] rounded-2xl p-4 border transition-all cursor-pointer shadow-sm hover:scale-[1.01] ${
                  isSelected
                    ? 'border-[#39ff14] ring-1 ring-[#39ff14]/40 bg-[#1c2230]'
                    : 'border-[#2a3346] hover:border-gray-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                        conn.status === 'connected'
                          ? 'bg-[#10b981]/15 text-[#39ff14] border-[#10b981]/40'
                          : conn.status === 'connecting' || conn.status === 'awaiting_auth'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-500/40'
                          : conn.status === 'error'
                          ? 'bg-red-950/40 text-red-400 border-red-500/40'
                          : 'bg-[#1a202c] text-gray-500 border-[#2a3346]'
                      }`}
                    >
                      <Smartphone className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white font-sans">{conn.name}</h4>
                        {conn.phoneNumber && (
                          <span className="text-xs text-gray-400 font-mono">
                            +{conn.phoneNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 font-mono">
                        {conn.status === 'connected' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-950/50 text-[#39ff14] text-[10px] font-bold rounded-full border border-[#10b981]/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                            Conectado
                          </span>
                        ) : conn.status === 'awaiting_auth' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-950/50 text-amber-300 text-[10px] font-bold rounded-full border border-amber-500/40">
                            <Clock className="w-3 h-3" />
                            Aguardando Leitura
                          </span>
                        ) : conn.status === 'connecting' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-950/50 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/40">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Conectando...
                          </span>
                        ) : conn.status === 'error' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-950/50 text-red-300 text-[10px] font-bold rounded-full border border-red-500/40">
                            <AlertCircle className="w-3 h-3" />
                            Erro na Sessão
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#1a202c] text-gray-400 text-[10px] font-bold rounded-full border border-[#2a3346]">
                            Desconectado
                          </span>
                        )}

                        <span className="text-[10px] text-gray-500">
                          ID: {conn.sessionId.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {conn.status === 'connected' ? (
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        title="Desconectar"
                        className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-950/40 rounded-xl transition"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(conn)}
                        className="px-3 py-1.5 bg-[#39ff14] hover:bg-[#32e012] text-black text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Conectar</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(conn.id)}
                      title="Excluir Sessão"
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Criar Nova Conexão */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#161922] rounded-3xl p-6 max-w-sm w-full border border-[#2a3346] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-mono text-white">Nova Sessão Zapo</h3>
              <button
                onClick={() => setCreating(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateConnection} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-gray-300 mb-1">
                  Nome Identificador da Sessão
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Celular Principal, Lab Teste 1"
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#12151c] border border-[#2a3346] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-[#39ff14]"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 text-xs font-mono font-bold text-gray-400 hover:text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#39ff14] hover:bg-[#32e012] text-black text-xs font-mono font-bold rounded-xl shadow-md transition"
                >
                  Criar e Vincular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Autenticação via QR Code ou Código de Pareamento */}
      {activeModalConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#161922] rounded-3xl p-6 max-w-md w-full border border-[#2a3346] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a3346]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#39ff14]" />
                <h3 className="text-sm sm:text-base font-bold font-mono text-white">
                  Vincular: {activeModalConn.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalConn(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If already connected */}
            {activeModalConn.status === 'connected' ? (
              <div className="text-center py-8 space-y-3 font-mono">
                <div className="w-16 h-16 mx-auto bg-emerald-950/60 border border-[#10b981]/40 text-[#39ff14] rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h4 className="text-base font-bold text-white">WhatsApp Conectado!</h4>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Sua sessão do Zapo está sincronizada. Os testes e comandos já estão liberados.
                </p>
                <button
                  onClick={() => setActiveModalConn(null)}
                  className="mt-4 px-6 py-2.5 bg-[#39ff14] text-black text-xs font-bold rounded-xl shadow-lg transition"
                >
                  Ir para Conversas
                </button>
              </div>
            ) : (
              <div className="mt-4">
                {/* Method Switcher Tabs */}
                <div className="flex bg-[#0e1118] p-1 rounded-2xl mb-4 border border-[#2a3346]">
                  <button
                    onClick={() => setActiveAuthTab('qr')}
                    className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                      activeAuthTab === 'qr'
                        ? 'bg-[#1a202c] text-[#39ff14] shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => setActiveAuthTab('pairing')}
                    className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                      activeAuthTab === 'pairing'
                        ? 'bg-[#1a202c] text-[#39ff14] shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    Código de Pareamento
                  </button>
                </div>

                {activeAuthTab === 'qr' ? (
                  <div className="text-center py-2">
                    {activeModalConn.qrCode ? (
                      <div className="space-y-4">
                        {/* High-contrast white container so camera scans QR effortlessly */}
                        <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl border-4 border-[#39ff14]/30">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
                              activeModalConn.qrCode
                            )}`}
                            alt="WhatsApp QR Code"
                            className="w-56 h-56 mx-auto rounded-lg"
                          />
                        </div>
                        <p className="text-xs text-gray-300 font-mono">
                          1. Abra o WhatsApp &gt; <b>Aparelhos conectados</b><br />
                          2. Toque em <b>Conectar um aparelho</b> e aponte para o QR Code
                        </p>
                      </div>
                    ) : (
                      <div className="py-12 space-y-3 font-mono">
                        <div className="w-7 h-7 mx-auto border-2 border-[#39ff14] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-gray-400">
                          Solicitando QR Code à biblioteca Zapo...
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-2 space-y-4 font-mono">
                    {pairingError && (
                      <div className="p-2.5 bg-red-950/50 text-red-300 text-xs rounded-xl flex items-center gap-2 border border-red-500/40">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{pairingError}</span>
                      </div>
                    )}

                    {activeModalConn.pairingCode ? (
                      <div className="text-center p-4 bg-[#12151c] border border-[#39ff14]/40 rounded-2xl space-y-3">
                        <p className="text-xs text-[#39ff14] font-bold">
                          Código de Pareamento Gerado:
                        </p>
                        <div className="text-3xl font-mono font-black tracking-widest text-white bg-[#1a202c] py-3 px-4 rounded-xl border border-[#2a3346] shadow-lg inline-block">
                          {formatPairingCode(activeModalConn.pairingCode)}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed text-left pt-2">
                          1. Abra o WhatsApp &gt; <b>Aparelhos conectados</b><br />
                          2. Toque em <b>Conectar um aparelho</b> &gt; <b>Conectar com número de telefone</b><br />
                          3. Digite o código de 8 dígitos acima no seu WhatsApp.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleRequestPairingCode} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 mb-1">
                            Número do WhatsApp (DDI + DDD + Número)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: 5511999999999"
                            value={phoneNumberInput}
                            onChange={(e) => setPhoneNumberInput(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#12151c] border border-[#2a3346] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-[#39ff14]"
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            Apenas dígitos, incluindo código do país (Brasil: 55).
                          </span>
                        </div>
                        <button
                          type="submit"
                          disabled={pairingLoading}
                          className="w-full py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#39ff14]/20 disabled:opacity-50 cursor-pointer"
                        >
                          {pairingLoading ? (
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'Solicitar Código de 8 Dígitos'
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
