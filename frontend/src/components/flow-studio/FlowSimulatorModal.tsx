import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Send,
  Bot,
  User,
  Sliders,
  Sparkles,
  ExternalLink,
  QrCode,
  ShieldAlert,
  Smartphone,
  Eye,
  CheckCircle,
} from 'lucide-react';
import api from '../../services/api.js';
import { Flow, FlowVersion, FlowNode } from '../../types/flows.js';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  text?: string;
  buttons?: Array<{ buttonId: string; displayText: string }>;
  formUrl?: string;
  formTitle?: string;
  pixData?: { key: string; amount: string; qrCode: string };
  timestamp: string;
  nodeId?: string;
}

interface FlowSimulatorModalProps {
  flow: Flow;
  version: FlowVersion;
  isOpen: boolean;
  onClose: () => void;
  onHighlightNode?: (nodeId: string | null) => void;
  connections: Array<{ id: string; name: string; status: string }>;
}

export const FlowSimulatorModal: React.FC<FlowSimulatorModalProps> = ({
  flow,
  version,
  isOpen,
  onClose,
  onHighlightNode,
  connections,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'simulation' | 'whatsapp'>('simulation');
  const [selectedConnId, setSelectedConnId] = useState<string>(
    flow.connectionId || connections[0]?.id || ''
  );
  const [recipientNumber, setRecipientNumber] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'chat' | 'variables' | 'logs'>('chat');
  const [logs, setLogs] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Start or reset session
  const startSimulation = async () => {
    try {
      setLoading(true);
      setMessages([]);
      setLogs([]);
      setVariables({});
      setSessionId(null);
      if (onHighlightNode) onHighlightNode(null);

      addLog(`Iniciando simulação para o fluxo "${flow.name}" (v${version.version})...`);

      const res = await api.post('/flows/simulate', {
        flowId: flow.id,
        versionId: version.id,
      });

      const { session, events } = res.data;
      if (session) {
        setSessionId(session.id);
        setVariables(session.variables || {});
        if (onHighlightNode && session.currentNodeId) {
          onHighlightNode(session.currentNodeId);
        }
      }

      // Convert events to chat messages
      if (events && Array.isArray(events)) {
        const newMsgs: ChatMessage[] = [];
        for (const ev of events) {
          addLog(`Evento ${ev.eventType}: Nó ${ev.nodeId}`);
          if (ev.eventType === 'message_sent' && ev.payload) {
            newMsgs.push({
              id: `msg_${Date.now()}_${Math.random()}`,
              sender: 'bot',
              text: ev.payload.text || ev.payload.content,
              buttons: ev.payload.buttons,
              formUrl: ev.payload.url,
              formTitle: ev.payload.title,
              pixData: ev.payload.pixKey
                ? { key: ev.payload.pixKey, amount: ev.payload.amount, qrCode: ev.payload.qrCode }
                : undefined,
              timestamp: new Date().toLocaleTimeString(),
              nodeId: ev.nodeId,
            });
          }
        }
        setMessages(newMsgs);
      }
    } catch (err: any) {
      addLog(`Erro ao iniciar simulação: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startSimulation();
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend ?? inputText;
    if (!text.trim() || loading) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    addLog(`Usuário enviou: "${text}"`);

    try {
      setLoading(true);
      const res = await api.post('/flows/simulate', {
        flowId: flow.id,
        versionId: version.id,
        sessionId,
        userMessage: text,
      });

      const { session, events } = res.data;
      if (session) {
        setVariables(session.variables || {});
        if (onHighlightNode && session.currentNodeId) {
          onHighlightNode(session.currentNodeId);
        }
      }

      if (events && Array.isArray(events)) {
        const newMsgs: ChatMessage[] = [];
        for (const ev of events) {
          addLog(`Evento ${ev.eventType}: Nó ${ev.nodeId}`);
          if (ev.eventType === 'message_sent' && ev.payload) {
            newMsgs.push({
              id: `msg_${Date.now()}_${Math.random()}`,
              sender: 'bot',
              text: ev.payload.text || ev.payload.content,
              buttons: ev.payload.buttons,
              formUrl: ev.payload.url,
              formTitle: ev.payload.title,
              pixData: ev.payload.pixKey
                ? { key: ev.payload.pixKey, amount: ev.payload.amount, qrCode: ev.payload.qrCode }
                : undefined,
              timestamp: new Date().toLocaleTimeString(),
              nodeId: ev.nodeId,
            });
          }
        }
        setMessages((prev) => [...prev, ...newMsgs]);
      }
    } catch (err: any) {
      addLog(`Erro na execução: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#161922] border border-[#2a3346] w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Simulator Top Header */}
        <div className="p-4 bg-[#11141c] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-mono">Simulador de Conversa</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    mode === 'simulation'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  }`}
                >
                  {mode === 'simulation' ? '● Modo Seguro (Sandbox)' : '● Teste WhatsApp Real'}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                Fluxo: {flow.name} (v{version.version})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startSimulation}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center gap-1.5 text-xs font-mono transition-all"
              title="Reiniciar Sessão"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-4 py-2 bg-[#131722] border-b border-white/5 flex gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'chat'
                ? 'bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Chat Interativo ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('variables')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'variables'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Inspetor de Variáveis ({Object.keys(variables).length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'logs'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Logs de Execução ({logs.length})
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* 1. CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col bg-[#0b0e14]">
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs font-mono">
                    <Bot className="w-8 h-8 mb-2 opacity-50" />
                    <span>Inicie uma conversa digitando abaixo ou clique em Reiniciar.</span>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/30 rounded-tr-none'
                          : 'bg-[#161922] text-gray-200 border border-white/10 rounded-tl-none shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 mb-1">
                        {msg.sender === 'user' ? (
                          <>
                            <span>Você (Simulado)</span>
                            <User className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-[#39ff14]" />
                            <span className="text-[#39ff14]">ZapTroll Bot</span>
                          </>
                        )}
                      </div>

                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                      {/* Interactive Buttons Preview */}
                      {msg.buttons && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                          {msg.buttons.map((b) => (
                            <button
                              key={b.buttonId}
                              onClick={() => handleSendMessage(b.displayText)}
                              className="w-full py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 font-mono text-[11px] text-center transition-all hover:scale-[1.01]"
                            >
                              {b.displayText}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Form URL Link Preview */}
                      {msg.formUrl && (
                        <div className="mt-2.5 pt-2 border-t border-white/10">
                          <a
                            href={msg.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 font-mono text-[11px] transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir {msg.formTitle || 'Formulário Hospedado'}</span>
                          </a>
                        </div>
                      )}

                      {/* Pix Data Preview */}
                      {msg.pixData && (
                        <div className="mt-2.5 p-2 rounded-xl bg-lime-950/40 border border-lime-500/30 text-lime-300 text-[11px] font-mono space-y-1">
                          <div className="flex items-center gap-1 font-bold">
                            <QrCode className="w-4 h-4" />
                            <span>Cobrança Pix: R$ {msg.pixData.amount}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 break-all">
                            Chave: {msg.pixData.key}
                          </div>
                        </div>
                      )}

                      <span className="text-[9px] text-gray-500 font-mono block text-right mt-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#11141c] border-t border-white/10 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite uma mensagem ou resposta..."
                  disabled={loading}
                  className="flex-1 bg-[#0b0e14] border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputText.trim()}
                  className="p-2.5 rounded-2xl bg-[#39ff14] hover:bg-[#32e012] text-black font-bold disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 2. VARIABLES TAB */}
          {activeTab === 'variables' && (
            <div className="flex-1 p-4 bg-[#0b0e14] overflow-y-auto">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3">
                Estado Atual das Variáveis de Conversa
              </h3>
              {Object.keys(variables).length === 0 ? (
                <p className="text-xs text-gray-500 font-mono">Nenhuma variável gravada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(variables).map(([k, v]) => (
                    <div
                      key={k}
                      className="p-3 rounded-xl bg-[#161922] border border-white/5 font-mono text-xs"
                    >
                      <span className="text-cyan-400 font-bold block">{k}</span>
                      <pre className="text-gray-300 mt-1 text-[11px] whitespace-pre-wrap break-all">
                        {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="flex-1 p-4 bg-[#080a0f] overflow-y-auto font-mono text-xs text-gray-400 space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="hover:text-white transition-colors">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
