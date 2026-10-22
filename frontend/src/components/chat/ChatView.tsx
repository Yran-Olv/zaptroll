import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Send,
  Check,
  CheckCheck,
  Clock,
  Trash2,
  AlertCircle,
  ExternalLink,
  List,
  Sparkles,
  FlaskConical,
  Skull,
  Terminal,
  FileText,
  Download,
  Eye,
  Play,
  Volume2,
  Image as ImageIcon,
  X,
  Reply,
  CornerDownRight,
  CornerDownLeft,
  Phone,
  ShoppingBag,
  CheckCircle2,
  RotateCcw,
  Lock,
  Smartphone,
  MapPin,
  Ghost,
  AtSign,
  Users,
  Radio,
} from 'lucide-react';
import api from '../../services/api.js';
import { Conversation, Message, WhatsAppConnection, ContactProfile } from '../../types/index.js';
import { useSocket } from '../../contexts/SocketContext.js';
import { AdvancedFeaturesModal } from '../advanced-menu/AdvancedFeaturesModal.js';
import { FlowStudioModal } from '../flow-studio/FlowStudioModal.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';
import { MemeBackground } from '../memes/MemeBackground.js';
import { EmptyConversationState } from '../memes/EmptyConversationState.js';
import { UserProfileModal } from '../profile/UserProfileModal.js';
import { PostGroupStatusModal } from './PostGroupStatusModal.js';

interface CarouselExtractedCard {
  title: string;
  text: string;
  imageUrl?: string;
  buttons: Array<{
    type?: string;
    displayText: string;
    url?: string;
    id?: string;
    phoneNumber?: string;
  }>;
}

const getCarouselData = (msg: Message): {
  bodyText: string;
  footerText: string;
  cards: CarouselExtractedCard[];
} => {
  const p = (msg.rawPayload || {}) as any;
  let bodyText = p.bodyText || p.interactiveMessage?.body?.text || '';
  let footerText = p.footerText || p.interactiveMessage?.footer?.text || '';
  let cards: CarouselExtractedCard[] = [];

  if (Array.isArray(p.cards)) {
    cards = p.cards.map((c: any) => ({
      title: c.title || '',
      text: c.text || '',
      imageUrl: c.imageUrl,
      buttons: (Array.isArray(c.buttons) ? c.buttons : []).map((b: any) => ({
        type: b.type || b.name,
        displayText: b.displayText || b.display_text || b.name || 'Ação',
        url: b.url,
        id: b.id,
        phoneNumber: b.phoneNumber || b.phone_number,
      })),
    }));
  } else if (Array.isArray(p.interactiveMessage?.carouselMessage?.cards)) {
    cards = p.interactiveMessage.carouselMessage.cards.map((c: any, i: number) => {
      let img = undefined;
      const imgMsg = c.header?.imageMessage;
      if (imgMsg?.jpegThumbnail) {
        try {
          const t = imgMsg.jpegThumbnail;
          if (typeof t === 'string') {
            img = t.startsWith('data:') ? t : `data:image/jpeg;base64,${t}`;
          } else {
            const rawBytes = t.data ? t.data : (Array.isArray(t) ? t : Object.values(t));
            const binString = Array.from(new Uint8Array(rawBytes), (byte) => String.fromCharCode(byte)).join('');
            img = 'data:image/jpeg;base64,' + btoa(binString);
          }
        } catch {}
      } else if (imgMsg?.url) {
        img = imgMsg.url;
      }

      const flowBtns = (c.nativeFlowMessage?.buttons || []).map((b: any) => {
        let params: any = {};
        try {
          params = typeof b.buttonParamsJson === 'string' ? JSON.parse(b.buttonParamsJson) : (b.buttonParamsJson || {});
        } catch {}
        return {
          type: b.name,
          displayText: params.display_text || params.displayText || b.name || 'Ação',
          url: params.url,
          id: params.id,
          phoneNumber: params.phone_number,
        };
      });

      return {
        title: c.header?.title || `Cartão ${i + 1}`,
        text: c.body?.text || '',
        imageUrl: img,
        buttons: flowBtns,
      };
    });
  }

  if (!bodyText && msg.content?.includes('[Carrossel:')) {
    const match = msg.content.match(/\[Carrossel:\s*([^—\]]+)/);
    if (match) {
      bodyText = match[1].trim();
    }
  }

  return { bodyText, footerText, cards };
};

interface ChatViewProps {
  conversation: Conversation;
  connection: WhatsAppConnection;
  onBack?: () => void;
  onConversationUpdated?: (updated: Partial<Conversation> & { id: string }) => void;
  onOpenDevTools?: (initialQuery?: string, initialTab?: any) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  connection,
  onBack,
  onConversationUpdated,
  onOpenDevTools,
}) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [showFlowStudioModal, setShowFlowStudioModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [contactProfilePic, setContactProfilePic] = useState<string | null>(
    conversation.profilePicUrl || null
  );
  const [revokeModalMsg, setRevokeModalMsg] = useState<Message | null>(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState<string | null>(null);

  // Background fetch of contact profile and real picture
  useEffect(() => {
    setContactProfilePic(conversation.profilePicUrl || null);

    if (conversation.jid && connection.id) {
      api
        .get('/contacts/profile', {
          params: {
            connectionId: connection.id,
            jid: conversation.jid,
            conversationId: conversation.id,
          },
        })
        .then((res) => {
          if (res.data?.profilePicUrl) {
            setContactProfilePic(res.data.profilePicUrl);
            if (onConversationUpdated && res.data.profilePicUrl !== conversation.profilePicUrl) {
              onConversationUpdated({
                id: conversation.id,
                profilePicUrl: res.data.profilePicUrl,
                name: res.data.name || conversation.name,
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [conversation.id, conversation.jid, connection.id]);

  // Message Quoting / Reply
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedStanzaId, setHighlightedStanzaId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Group detection
  const isGroup = conversation.chatType === 'group' || conversation.jid?.endsWith('@g.us');

  // Quick Ghost Mention for Groups ("Marcar Geral 👻")
  const [isGhostMentionActive, setIsGhostMentionActive] = useState<boolean>(false);
  const [showGroupStatusModal, setShowGroupStatusModal] = useState<boolean>(false);

  useEffect(() => {
    setIsGhostMentionActive(false);
  }, [conversation.id]);

  // Quick Ephemeral Message ("Modo Fantasma Rápido")
  const [isEphemeralActive, setIsEphemeralActive] = useState<boolean>(() => {
    return localStorage.getItem('zaptroll_fast_ephemeral') === 'true';
  });
  const [ephemeralDuration, setEphemeralDuration] = useState<number>(() => {
    const saved = localStorage.getItem('zaptroll_fast_ephemeral_duration');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false);
  const ephemeralMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('zaptroll_fast_ephemeral', String(isEphemeralActive));
  }, [isEphemeralActive]);

  useEffect(() => {
    localStorage.setItem('zaptroll_fast_ephemeral_duration', String(ephemeralDuration));
  }, [ephemeralDuration]);

  // Close ephemeral modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEphemeralMenu(false);
      }
    };
    if (showEphemeralMenu) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEphemeralMenu]);

  const formatDuration = (secs: number) => {
    if (secs === 1) return '1 segundo';
    if (secs < 60) return `${secs} segundos`;
    if (secs < 3600) return `${Math.floor(secs / 60)} min`;
    if (secs < 86400) return `${Math.floor(secs / 3600)} hora${secs >= 7200 ? 's' : ''}`;
    return `${Math.floor(secs / 86400)} dia${secs >= 172800 ? 's' : ''}`;
  };

  const formatShortDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [closing, setClosing] = useState(false);
  const handleToggleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const isClosed = conversation.status === 'closed';
      const endpoint = isClosed ? `/conversations/${conversation.id}/reopen` : `/conversations/${conversation.id}/close`;
      await api.put(endpoint);
      if (onConversationUpdated) {
        onConversationUpdated({
          id: conversation.id,
          status: isClosed ? 'open' : 'closed',
        });
      }
    } catch (err: any) {
      console.error('Error toggling conversation status:', err);
    } finally {
      setClosing(false);
    }
  };

  // Cancel reply with Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && replyingTo) {
        setReplyingTo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replyingTo]);

  const handleStartReply = (msg: Message) => {
    setReplyingTo(msg);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const scrollToMessage = (stanzaId: string) => {
    if (!stanzaId) return;
    const el = document.getElementById(`msg-${stanzaId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedStanzaId(stanzaId);
      setTimeout(() => {
        setHighlightedStanzaId((prev) => (prev === stanzaId ? null : prev));
      }, 2000);
    }
  };

  const getQuotedInfo = (msg: Message) => {
    const ctx =
      msg.rawPayload?.contextInfo ||
      msg.rawPayload?.extendedTextMessage?.contextInfo ||
      msg.rawPayload?.imageMessage?.contextInfo ||
      msg.rawPayload?.videoMessage?.contextInfo ||
      msg.rawPayload?.audioMessage?.contextInfo ||
      msg.rawPayload?.documentMessage?.contextInfo ||
      msg.rawPayload?.stickerMessage?.contextInfo ||
      msg.rawPayload?.buttonsResponseMessage?.contextInfo ||
      msg.rawPayload?.listResponseMessage?.contextInfo;

    if (!ctx || !ctx.stanzaId) return null;

    let sender = ctx.quotedSender;
    if (!sender) {
      if (ctx.fromMe || ctx.participant === 'me') {
        sender = 'Você';
      } else if (ctx.participant) {
        sender = ctx.participant.split('@')[0];
      } else {
        sender = 'Mensagem';
      }
    }

    let text = ctx.quotedText;
    if (!text && ctx.quotedMessage) {
      const qm = ctx.quotedMessage;
      text =
        qm.conversation ||
        qm.extendedTextMessage?.text ||
        qm.imageMessage?.caption ||
        (qm.imageMessage ? '📷 Foto' : null) ||
        qm.videoMessage?.caption ||
        (qm.videoMessage ? '🎥 Vídeo' : null) ||
        (qm.audioMessage ? (qm.audioMessage.ptt ? '🎤 Mensagem de Voz' : '🎵 Áudio') : null) ||
        (qm.documentMessage ? `📄 ${qm.documentMessage.fileName || 'Documento'}` : null) ||
        (qm.locationMessage ? `📍 ${qm.locationMessage.name || 'Localização'}` : null) ||
        (qm.contactMessage ? `👤 ${qm.contactMessage.displayName || 'Contato'}` : null) ||
        '';
    }

    if (!text) {
      const found = messages.find((m) => m.stanzaId === ctx.stanzaId);
      if (found) {
        text = found.content || found.caption || '';
      }
    }

    return {
      stanzaId: ctx.stanzaId,
      sender: sender || 'Mensagem',
      text: text || 'Mensagem',
      fromMe: Boolean(ctx.fromMe),
    };
  };

  const scrollToBottom = (smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/messages/history/${conversation.id}?limit=100`);
      setMessages(res.data.messages);
      setTimeout(() => scrollToBottom(false), 80);
    } catch (err) {
      console.error('Failed to load message history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [conversation.id]);

  // Real-time socket listener for new messages & status updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { connectionId: string; message: Message; conversation: Conversation }) => {
      const isForThisChat =
        data.message.conversationId === conversation.id ||
        data.conversation?.id === conversation.id ||
        (data.conversation?.jid && data.conversation.jid === conversation.jid) ||
        (data.message.remoteJid && data.message.remoteJid === conversation.jid);

      if (isForThisChat) {
        setMessages((prev) => {
          if (prev.some((m) => m.stanzaId === data.message.stanzaId)) {
            return prev.map((m) => (m.stanzaId === data.message.stanzaId ? data.message : m));
          }
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    };

    const handleMessageStatus = (data: { connectionId: string; stanzaId: string; status: any }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.stanzaId === data.stanzaId
            ? {
                ...m,
                status: data.status,
                isRevoked: data.status === 'revoked' ? true : m.isRevoked,
                content: data.status === 'revoked' ? '[Mensagem revogada para todos]' : m.content,
              }
            : m
        )
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_status', handleMessageStatus);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_status', handleMessageStatus);
    };
  }, [socket, conversation.id]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || sending) return;

    let textToSend = textInput.trim();
    const quoteStanza = replyingTo?.stanzaId;

    // Detect @todos / /todos / @geral / /geral trigger in group
    const isTodosTrigger = isGroup && /^(@todos|@geral|\/todos|\/geral)\b/i.test(textToSend);
    const shouldGhostMention = (isGhostMentionActive || isTodosTrigger) && isGroup;

    if (isTodosTrigger) {
      textToSend = textToSend.replace(/^(@todos|@geral|\/todos|\/geral)\s*/i, '').trim() || textToSend;
    }

    setTextInput('');
    setReplyingTo(null);
    if (isGhostMentionActive) {
      setIsGhostMentionActive(false);
    }
    setSending(true);

    try {
      if (shouldGhostMention) {
        await api.post('/advanced/ghost-mention', {
          connectionId: connection.id,
          targetJid: conversation.jid,
          text: textToSend,
          mentionAll: true,
          quotedStanzaId: quoteStanza,
        });
      } else if (isEphemeralActive) {
        await api.post('/messages/send', {
          connectionId: connection.id,
          conversationId: conversation.id,
          recipientJid: conversation.jid,
          type: 'ephemeral_message',
          quotedStanzaId: quoteStanza,
          payload: {
            text: textToSend,
            quotedStanzaId: quoteStanza,
            expirationSeconds: ephemeralDuration,
            duration: ephemeralDuration,
            experimentalAfterRead: true,
            afterReadDuration: ephemeralDuration,
          },
        });
      } else {
        await api.post('/messages/send', {
          connectionId: connection.id,
          conversationId: conversation.id,
          recipientJid: conversation.jid,
          type: 'text',
          quotedStanzaId: quoteStanza,
          payload: {
            text: textToSend,
            quotedStanzaId: quoteStanza,
          },
        });
      }
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleRevokeMessage = async () => {
    if (!revokeModalMsg) return;

    try {
      await api.post('/messages/revoke', {
        connectionId: connection.id,
        conversationId: conversation.id,
        stanzaId: revokeModalMsg.stanzaId,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.stanzaId === revokeModalMsg.stanzaId
            ? { ...m, isRevoked: true, status: 'revoked', content: '[Mensagem revogada para todos]' }
            : m
        )
      );
      setRevokeModalMsg(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao apagar mensagem para todos.');
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 min-w-0 w-full max-w-full flex flex-col h-full bg-[#0d1117] relative overflow-hidden wa-lab-bg">
      {/* Background Meme Watermark */}
      <MemeBackground opacity={0.03} />

      {/* Lab Header */}
      <div className="lab-glass sticky top-0 z-20 px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-b border-[#2a3346] flex items-center justify-between shadow-lg w-full max-w-full min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-[#39ff14] hover:bg-white/10 rounded-full md:hidden flex items-center shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Contact Header clickable to view profile & real photo */}
          <div
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 mr-2 cursor-pointer group hover:opacity-95 transition"
            title="Clique para ver perfil e foto real do contato"
          >
            {/* Contact Avatar with real picture if available */}
            <div className="shrink-0 relative">
              <MemeAvatar
                src={contactProfilePic || conversation.profilePicUrl}
                seed={conversation.jid || conversation.name || 'zaptroll'}
                name={conversation.name}
                size="sm"
                statusOnline={connection.status === 'connected'}
                className="group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#39ff14] transition rounded-2xl"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight font-sans truncate group-hover:text-[#39ff14] transition flex items-center gap-1.5">
                <span>{conversation.name || conversation.jid}</span>
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[10px] text-gray-400 font-mono truncate max-w-[100px] sm:max-w-[160px]">
                  {conversation.jid}
                </span>
                {conversation.phoneNumber && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenDevTools) {
                        onOpenDevTools(conversation.phoneNumber || conversation.jid, 'location');
                      }
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-400 font-bold cursor-pointer transition"
                    title="Clique para ver DDD, Estado, Cidade e detalhes deste número"
                  >
                    <Phone className="w-2.5 h-2.5 text-emerald-400" />
                    +{conversation.phoneNumber.replace(/\D/g, '')}
                    <MapPin className="w-2 h-2 text-emerald-400 opacity-70" />
                  </button>
                )}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#162033] border border-[#2a3f66] text-[9px] font-mono text-cyan-300" title={`Enviando através do canal: ${conversation.connection?.name || connection.name}`}>
                  <Smartphone className="w-2.5 h-2.5 text-cyan-400" />
                  <span className="text-gray-400 text-[8px] uppercase tracking-wider">Canal:</span>
                  <span className="font-semibold text-cyan-200">{conversation.connection?.name || connection.name}</span>
                  {(conversation.connection?.phoneNumber || connection.phoneNumber) && (
                    <span className="text-gray-400">
                      (+{(conversation.connection?.phoneNumber || connection.phoneNumber)?.replace(/\D/g, '')})
                    </span>
                  )}
                </span>
                {conversation.status === 'closed' ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-[9px] font-mono text-red-400 font-bold">
                    <Lock className="w-2.5 h-2.5" />
                    Fechado
                  </span>
                ) : (
                  <span className={`text-[9px] font-mono ${connection.status === 'connected' ? 'text-[#10b981]' : 'text-amber-400'}`}>
                    • {connection.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions: Ghost Mention for Groups, Dev Tools, Reopen/Close & Zapo Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Ghost Mention Button in Group Header */}
          {isGroup && (
            <button
              type="button"
              onClick={() => {
                setIsGhostMentionActive((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                  return next;
                });
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 border rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                isGhostMentionActive
                  ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-purple-400'
                  : 'bg-[#141824] hover:bg-purple-950/40 text-purple-400 hover:text-purple-300 border-purple-500/40 hover:border-purple-500/70'
              }`}
              title={
                isGhostMentionActive
                  ? 'Menção Fantasma ATIVA (Marcar Geral). Clique para desativar.'
                  : 'Ativar Menção Fantasma (Marcar Geral): Notifica todos os participantes do grupo em segredo'
              }
            >
              <Ghost className={`w-3.5 h-3.5 text-purple-400 ${isGhostMentionActive ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">Marcar Geral 👻</span>
              <span className="sm:hidden font-mono font-black text-[11px]">@GERAL</span>
            </button>
          )}

          {/* Quick Post Status Button in Group Header */}
          {isGroup && (
            <button
              type="button"
              onClick={() => setShowGroupStatusModal(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 hover:text-white border border-emerald-500/50 hover:border-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition shrink-0 shadow-sm cursor-pointer"
              title="Postar Status / Story nativo do WhatsApp diretamente neste grupo"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Status</span>
              <span className="sm:hidden font-mono font-black text-[11px]">STATUS</span>
            </button>
          )}

          {/* Dev Tools Quick Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenDevTools) {
                onOpenDevTools(conversation.jid);
              } else {
                setShowProfileModal(true);
              }
            }}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-[#141824] hover:bg-[#1e2535] text-gray-300 hover:text-[#39ff14] border border-[#2a3346] hover:border-[#39ff14]/50 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition shrink-0"
            title="Abrir Ferramentas do Desenvolvedor (JID, LID, Grupos)"
          >
            <Terminal className="w-3.5 h-3.5 text-[#39ff14]" />
            <span className="hidden sm:inline">Dev Tools</span>
          </button>

          {conversation.status === 'closed' ? (
            <button
              onClick={handleToggleClose}
              disabled={closing}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition shrink-0"
              title="Reabrir conversa"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${closing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reabrir Conversa</span>
            </button>
          ) : (
            <button
              onClick={handleToggleClose}
              disabled={closing}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 hover:border-red-500/60 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition shrink-0"
              title="Fechar conversa"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${closing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Fechar Conversa</span>
            </button>
          )}

          <button
            onClick={() => setShowFlowStudioModal(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-blue-950/40 hover:bg-blue-900/60 text-blue-400 border border-blue-500/40 hover:border-blue-500/70 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(37,99,235,0.2)] transition shrink-0"
            title="Abrir Zaptroll Flow Studio (Construtor Visual de Automações)"
          >
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Flow Studio</span>
          </button>

          <button
            onClick={() => setShowAdvancedModal(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-[#161922] hover:bg-[#1f2533] text-[#39ff14] border border-[#39ff14]/40 hover:border-[#39ff14] text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(57,255,20,0.2)] transition shrink-0"
            title="Abrir Ferramentas do Laboratório"
          >
            <FlaskConical className="w-4 h-4 text-[#39ff14] shrink-0" />
            <span className="hidden sm:inline">Recursos Zapo</span>
          </button>
        </div>
      </div>

      {/* Closed Banner Notification */}
      {conversation.status === 'closed' && (
        <div className="bg-red-950/50 border-b border-red-500/30 px-3 py-1.5 text-[11px] font-mono text-red-300 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Esta conversa está fechada. Enviar uma mensagem irá reabri-la automaticamente.</span>
          </div>
          <button
            onClick={handleToggleClose}
            className="text-[#39ff14] hover:underline font-bold text-[10px] uppercase ml-2 shrink-0 cursor-pointer"
          >
            Reabrir Agora
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 space-y-3 relative z-10 w-full max-w-full min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-400 font-mono">
            Carregando mensagens do laboratório...
          </div>
        ) : messages.length === 0 ? (
          <EmptyConversationState
            type="empty_chat"
            onOpenTools={() => setShowAdvancedModal(true)}
          />
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.fromMe;
            const isCarousel =
              msg.messageType === 'carousel' ||
              Boolean((msg.rawPayload as any)?.cards) ||
              Boolean((msg.rawPayload as any)?.interactiveMessage?.carouselMessage?.cards) ||
              Boolean(msg.content?.includes('[Carrossel:'));
            const carouselData = isCarousel ? getCarouselData(msg) : null;
            const hasCarouselCards = Boolean(carouselData && carouselData.cards && carouselData.cards.length > 0);

            return (
              <div
                key={msg.id || msg.stanzaId}
                id={`msg-${msg.stanzaId}`}
                className={`flex flex-col group ${isOutgoing ? 'items-end' : 'items-start'}`}
              >
                <div
                  onDoubleClick={() => handleStartReply(msg)}
                  className={`${
                    hasCarouselCards
                      ? 'max-w-[96%] sm:max-w-xl md:max-w-2xl'
                      : 'max-w-[85%] sm:max-w-md'
                  } p-2.5 sm:p-3 rounded-2xl text-xs relative transition duration-200 shadow-md break-words overflow-hidden ${
                    isOutgoing
                      ? 'bg-[#14382d] text-white border border-[#10b981]/30 rounded-tr-none'
                      : 'bg-[#1c2230] text-gray-100 border border-[#2a3346] rounded-tl-none'
                  } ${msg.isRevoked ? 'italic text-gray-400 border-dashed border-red-500/30' : ''} ${
                    highlightedStanzaId === msg.stanzaId
                      ? 'ring-2 ring-[#39ff14] shadow-[0_0_22px_rgba(57,255,20,0.6)] scale-[1.01]'
                      : ''
                  }`}
                  title="Clique duas vezes para responder"
                >
                  {/* Quoted Message Preview inside Bubble (WhatsApp Native Style) */}
                  {(() => {
                    const quoted = getQuotedInfo(msg);
                    if (!quoted) return null;
                    return (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToMessage(quoted.stanzaId);
                        }}
                        className="mb-2 p-2 rounded-xl bg-black/40 hover:bg-black/60 cursor-pointer border-l-[3.5px] border-[#39ff14] transition select-text flex flex-col group/quote"
                        title="Clique para ir até a mensagem respondida"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#39ff14] mb-0.5">
                          <span className="truncate">{quoted.sender}</span>
                          <CornerDownRight className="w-3 h-3 text-gray-400 group-hover/quote:text-[#39ff14] transition" />
                        </div>
                        <p className="text-[11px] text-gray-300 line-clamp-2 leading-tight">
                          {quoted.text}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Sender Name in group */}
                  {!isOutgoing && msg.senderJid && conversation.chatType === 'group' && (
                    <div className="text-[11px] font-mono font-bold text-[#39ff14] mb-1">
                      {msg.senderJid.split('@')[0]}
                    </div>
                  )}

                  {/* Visualização Única (View Once) Intercepted & Saved Banner */}
                  {(() => {
                    const rawP = (msg.rawPayload as any) || {};
                    const isViewOnceMsg = Boolean(
                      rawP.isViewOnce ||
                      rawP.viewOnceMessage ||
                      rawP.viewOnceMessageV2 ||
                      rawP.viewOnceMessageV2Extension ||
                      rawP.imageMessage?.viewOnce ||
                      rawP.videoMessage?.viewOnce ||
                      rawP.audioMessage?.viewOnce ||
                      rawP.ptvMessage?.viewOnce ||
                      msg.messageType === 'view_once' ||
                      msg.mediaUrl?.includes('viewonce_') ||
                      (typeof msg.content === 'string' &&
                        (msg.content.includes('[Visualização Única]') ||
                         msg.content.toLowerCase().includes('visualização única') ||
                         msg.content.toLowerCase().includes('visualizacao unica')))
                    );

                    if (!isViewOnceMsg) return null;

                    return (
                      <div className="mb-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Visualização Única</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-400/25 text-amber-200 rounded font-semibold uppercase tracking-wider">
                            {msg.mediaUrl ? 'Salva' : isOutgoing ? 'Dispositivo' : 'Recebida'}
                          </span>
                        </div>
                        {msg.mediaUrl ? (
                          <a
                            href={msg.mediaUrl}
                            download={
                              msg.mediaFilename ||
                              (msg.messageType === 'video'
                                ? 'video_visualizacao_unica.mp4'
                                : 'foto_visualizacao_unica.jpg')
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white transition text-[11px] font-medium"
                            title="Baixar arquivo salvo permanentemente"
                          >
                            <Download className="w-3 h-3" />
                            <span>Baixar</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-amber-400/80 font-normal">
                            {isOutgoing ? '📱 Celular' : '🔒 WhatsApp'}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* 1. Image Media (mediaUrl or Base64 thumbnailUrl) */}
                  {(msg.messageType === 'image' || msg.mediaUrl || msg.thumbnailUrl) &&
                    (msg.mediaUrl || msg.thumbnailUrl) &&
                    msg.mediaMimetype !== 'image/webp' && (
                      <div
                        className="mb-2 overflow-hidden rounded-xl bg-black/40 relative group/img cursor-pointer border border-white/10"
                        onClick={() => setSelectedMediaPreview(msg.mediaUrl || msg.thumbnailUrl || null)}
                      >
                        <img
                          src={msg.mediaUrl || msg.thumbnailUrl || ''}
                          alt={msg.caption || 'Imagem WhatsApp'}
                          className="max-h-72 w-full object-cover rounded-xl transition hover:opacity-90"
                          loading="lazy"
                        />
                        {msg.mediaUrl && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
                            <a
                              href={msg.mediaUrl}
                              download={msg.mediaFilename || 'imagem_whatsapp.jpg'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 hover:bg-white/20 text-white rounded transition"
                              title="Baixar imagem"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                  {/* 2. Video Media */}
                  {(msg.messageType === 'video' || msg.mediaMimetype?.startsWith('video/')) && (
                    <div className="mb-2 overflow-hidden rounded-xl bg-black relative border border-white/10 group/vid">
                      {msg.mediaUrl ? (
                        <>
                          <video src={msg.mediaUrl} controls className="max-h-72 w-full rounded-xl" />
                          <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover/vid:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10 z-10 pointer-events-auto">
                            <a
                              href={msg.mediaUrl}
                              download={msg.mediaFilename || 'video_whatsapp.mp4'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-white/20 text-white rounded transition flex items-center gap-1 text-[11px] font-mono px-1.5"
                              title="Baixar vídeo"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar</span>
                            </a>
                          </div>
                        </>
                      ) : msg.thumbnailUrl ? (
                        <div
                          className="relative cursor-pointer"
                          onClick={() => setSelectedMediaPreview(msg.thumbnailUrl || null)}
                        >
                          <img
                            src={msg.thumbnailUrl}
                            alt="Vídeo preview"
                            className="max-h-72 w-full object-cover rounded-xl opacity-75"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="p-3 bg-black/70 text-white rounded-full">
                              <Play className="w-5 h-5 fill-white" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 3. Audio / Voice Note */}
                  {(msg.messageType === 'audio' || msg.mediaMimetype?.startsWith('audio/')) && (
                    <div className="mb-2 p-1.5 bg-black/40 rounded-xl flex items-center justify-between gap-2 border border-white/10">
                      {msg.mediaUrl ? (
                        <>
                          <audio src={msg.mediaUrl} controls className="w-full h-8" />
                          <a
                            href={msg.mediaUrl}
                            download={msg.mediaFilename || 'audio_whatsapp.ogg'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition shrink-0"
                            title="Baixar áudio"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 py-1 px-2 text-gray-300">
                          <Volume2 className="w-4 h-4 text-[#39ff14]" />
                          <span className="text-xs font-mono">Mensagem de Áudio</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Document */}
                  {(msg.messageType === 'document' ||
                    msg.mediaFilename ||
                    msg.mediaMimetype?.startsWith('application/')) && (
                    <div className="mb-2 p-2.5 bg-black/40 rounded-xl flex items-center justify-between gap-3 border border-white/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 bg-red-500/20 text-red-400 rounded-lg shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-semibold text-white truncate">
                            {msg.mediaFilename || 'Documento'}
                          </p>
                          <span className="text-[10px] text-gray-400 uppercase font-mono">
                            {msg.mediaMimetype?.split('/')[1] || 'ARQUIVO'}
                          </span>
                        </div>
                      </div>
                      {msg.mediaUrl && (
                        <a
                          href={msg.mediaUrl}
                          download={msg.mediaFilename || 'documento'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                          title="Baixar Arquivo"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* 5. Sticker */}
                  {(msg.messageType === 'sticker' || msg.mediaMimetype === 'image/webp') && msg.mediaUrl && (
                    <div className="mb-1 p-1">
                      <img src={msg.mediaUrl} alt="Sticker" className="w-28 h-28 object-contain" />
                    </div>
                  )}

                  {/* Ghost Mention (Marcar Geral) Badge */}
                  {(msg.messageType === 'ghost_mention' ||
                    (msg.rawPayload as any)?.isGhostMention ||
                    (msg.rawPayload as any)?.mentionedCount ||
                    msg.content?.startsWith('👻 [Menção Fantasma')) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-mono mb-2 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-lg w-fit shadow-sm">
                      <Ghost className="w-3 h-3 text-purple-400 animate-pulse" />
                      <span>
                        Menção Fantasma{' '}
                        {(msg.rawPayload as any)?.mentionedCount
                          ? `(${(msg.rawPayload as any).mentionedCount} marcados)`
                          : '(Geral)'}
                      </span>
                    </div>
                  )}

                  {/* Ephemeral Message Badge */}
                  {(msg.messageType === 'ephemeral_message' ||
                    msg.messageType === 'ephemeral' ||
                    (msg.rawPayload as any)?.expirationSeconds ||
                    msg.content?.startsWith('⏳')) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-mono mb-2 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-lg w-fit">
                      <Clock className="w-3 h-3 text-amber-300 animate-pulse" />
                      <span>
                        {hasCarouselCards ? 'Carrossel Temporário' : 'Mensagem Temporária'}
                      </span>
                    </div>
                  )}

                  {/* 6. Native Flow Carousel Gallery */}
                  {hasCarouselCards && carouselData && (
                    <div className="w-full my-1.5 min-w-0">
                      {/* Carousel Body Text */}
                      {carouselData.bodyText && (
                        <div className="text-[13px] font-sans font-medium text-white mb-2 leading-relaxed whitespace-pre-wrap">
                          {carouselData.bodyText}
                        </div>
                      )}

                      {/* Header hint */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-2 px-0.5">
                        <span className="flex items-center gap-1 text-gray-300">
                          <Sparkles className="w-3 h-3 text-[#39ff14]" />
                          Deslize horizontalmente nos cartões:
                        </span>
                        <span className="text-[#39ff14] font-bold">
                          {carouselData.cards.length} {carouselData.cards.length === 1 ? 'cartão' : 'cartões'}
                        </span>
                      </div>

                      {/* Horizontal scroll cards */}
                      <div className="flex gap-2.5 overflow-x-auto pb-2.5 pt-0.5 scrollbar-thin scrollbar-thumb-white/20 snap-x w-full">
                        {carouselData.cards.map((card, cIdx) => (
                          <div
                            key={cIdx}
                            className="w-[210px] sm:w-[220px] flex-shrink-0 bg-[#0e1219] border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col snap-start justify-between"
                          >
                            {/* Card Image */}
                            <div
                              className={`h-28 w-full bg-black/50 relative overflow-hidden flex items-center justify-center ${
                                card.imageUrl ? 'cursor-pointer group/cardimg' : ''
                              }`}
                              onClick={() => card.imageUrl && setSelectedMediaPreview(card.imageUrl)}
                              title={card.imageUrl ? 'Clique para expandir a imagem' : undefined}
                            >
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.title}
                                  className="w-full h-full object-cover group-hover/cardimg:scale-105 transition duration-300"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as any).src =
                                      'https://placehold.co/640x360/1a202c/39ff14?text=Card+Image';
                                  }}
                                />
                              ) : (
                                <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                  <ImageIcon className="w-4 h-4 text-gray-500" /> Sem Imagem
                                </div>
                              )}
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/75 backdrop-blur rounded text-[9px] font-mono text-[#39ff14] font-bold">
                                #{cIdx + 1}
                              </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-2.5 flex-1 flex flex-col justify-between">
                              <div>
                                <h4
                                  className="text-xs font-bold text-white leading-tight mb-1 truncate"
                                  title={card.title}
                                >
                                  {card.title || 'Título'}
                                </h4>
                                <p className="text-[11px] text-gray-300 leading-snug line-clamp-3 mb-2 font-sans">
                                  {card.text || ''}
                                </p>
                              </div>

                              {/* Card Buttons */}
                              {card.buttons && card.buttons.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-white/10">
                                  {card.buttons.map((b, bIdx) => {
                                    const isUrl = b.type === 'cta_url' || Boolean(b.url);
                                    const isCall = b.type === 'cta_call' || Boolean(b.phoneNumber);

                                    if (isUrl && b.url) {
                                      return (
                                        <a
                                          key={bIdx}
                                          href={b.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-full py-1.5 px-2 bg-[#1b2230] hover:bg-[#253045] border border-sky-500/30 rounded-lg text-center text-[10px] font-mono font-semibold text-sky-400 flex items-center justify-center gap-1.5 transition truncate shadow-sm cursor-pointer"
                                          title={`Abrir link: ${b.url}`}
                                        >
                                          <ExternalLink className="w-3 h-3 text-sky-400 shrink-0" />
                                          <span className="truncate">{b.displayText}</span>
                                        </a>
                                      );
                                    }

                                    if (isCall && b.phoneNumber) {
                                      return (
                                        <a
                                          key={bIdx}
                                          href={`tel:${b.phoneNumber}`}
                                          className="w-full py-1.5 px-2 bg-[#14291f] hover:bg-[#1a382b] border border-emerald-500/30 rounded-lg text-center text-[10px] font-mono font-semibold text-[#39ff14] flex items-center justify-center gap-1.5 transition truncate shadow-sm cursor-pointer"
                                        >
                                          <Phone className="w-3 h-3 text-[#39ff14] shrink-0" />
                                          <span className="truncate">{b.displayText}</span>
                                        </a>
                                      );
                                    }

                                    return (
                                      <button
                                        key={bIdx}
                                        type="button"
                                        onClick={() => setTextInput(b.displayText)}
                                        className="w-full py-1.5 px-2 bg-[#1a202c] hover:bg-[#232b3b] border border-white/10 hover:border-[#39ff14]/40 rounded-lg text-center text-[10px] font-mono font-semibold text-gray-200 hover:text-[#39ff14] flex items-center justify-center gap-1.5 transition truncate shadow-sm cursor-pointer"
                                        title="Clique para preencher resposta no chat"
                                      >
                                        <CornerDownLeft className="w-3 h-3 text-[#39ff14] shrink-0" />
                                        <span className="truncate">{b.displayText}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Carousel Footer Text */}
                      {carouselData.footerText && (
                        <div className="text-[10px] text-gray-400 italic px-1 mt-1 font-mono">
                          {carouselData.footerText}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content / Text / Caption */}
                  {(() => {
                    const isGenericFallback =
                      [
                        '📷 Imagem',
                        '🎥 Vídeo',
                        '🎵 Áudio',
                        '🎤 Mensagem de Voz',
                        'Sticker',
                        '🎠 Carrossel Interativo',
                      ].includes(msg.content || '') ||
                      (hasCarouselCards && Boolean(msg.content?.includes('[Carrossel:')));

                    const hasRenderedMedia = Boolean(msg.mediaUrl || msg.thumbnailUrl || hasCarouselCards);
                    let displayContent =
                      msg.caption ||
                      (!isGenericFallback || !hasRenderedMedia ? msg.content : null);

                    if (displayContent && displayContent.startsWith('👻 [Menção Fantasma')) {
                      displayContent = displayContent.replace(/^👻 \[Menção Fantasma \(.*?\)\]:\s*/, '');
                    }

                    if (!displayContent) return null;

                    return (
                      <div className="whitespace-pre-wrap break-words leading-relaxed font-sans text-[13px] mt-0.5 select-text">
                        {displayContent}
                      </div>
                    );
                  })()}

                  {/* Interactive Button Rendering if present */}
                  {msg.rawPayload?.buttons && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1">
                      {msg.rawPayload.buttons.map((b: any, idx: number) => (
                        <div
                          key={idx}
                          className="py-1.5 px-3 bg-[#161922]/90 hover:bg-[#1f2533] rounded-xl text-center font-mono font-semibold text-[#38bdf8] text-[11px] border border-[#2a3346] shadow-sm transition"
                        >
                          {b.buttonText?.displayText || b.displayText || 'Botão'}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive List Rendering if present */}
                  {msg.rawPayload?.sections && (
                    <div className="mt-2.5 pt-2 border-t border-white/10">
                      <div className="py-1.5 px-3 bg-[#161922]/90 rounded-xl text-center font-mono font-semibold text-[#a855f7] text-[11px] flex items-center justify-center gap-1.5 border border-[#2a3346] shadow-sm">
                        <List className="w-3.5 h-3.5" />
                        <span>{msg.rawPayload.buttonText || 'Ver Opções'}</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Webview Rendering if present */}
                  {msg.rawPayload?.url && (
                    <div className="mt-2.5 pt-2 border-t border-white/10">
                      <div className="py-1.5 px-3 bg-[#161922]/90 rounded-xl text-center font-mono font-semibold text-[#38bdf8] text-[11px] flex items-center justify-center gap-1.5 border border-[#2a3346] shadow-sm">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{msg.rawPayload.buttonText || 'Abrir Webview'}</span>
                      </div>
                    </div>
                  )}

                  {/* Timestamp & Status Icon */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-400 font-mono">
                    <span>{formatTime(msg.timestamp)}</span>
                    {isOutgoing && (
                      <span>
                        {msg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                        ) : msg.status === 'sent' ? (
                          <Check className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <Clock className="w-3 h-3 text-gray-400" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bubble Action Buttons (Responder & Apagar) */}
                <div className="flex items-center gap-1.5 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => handleStartReply(msg)}
                    className="text-[10px] text-gray-400 hover:text-[#39ff14] font-mono flex items-center gap-1 py-0.5 px-1.5 hover:bg-white/5 rounded-lg transition"
                    title="Responder mensagem (duplo clique)"
                  >
                    <Reply className="w-3 h-3" />
                    <span>Responder</span>
                  </button>

                  {isOutgoing && !msg.isRevoked && (
                    <button
                      type="button"
                      onClick={() => setRevokeModalMsg(msg)}
                      className="text-[10px] text-red-400 hover:text-red-300 font-mono flex items-center gap-1 py-0.5 px-1.5 hover:bg-red-500/10 rounded-lg transition"
                      title="Apagar para todos"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Apagar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composition Field Fixed at Bottom */}
      <div
        className="relative bg-[#131722]/95 backdrop-blur-xl border-t border-[#2a3346] px-2 sm:px-3 pt-2 pb-5 sm:pb-3 z-20 w-full max-w-full min-w-0 overflow-visible"
        style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
      >
        {/* Ephemeral Active Floating Banner */}
        {isEphemeralActive && (
          <div className="w-full max-w-4xl mx-auto mb-2 px-2.5 py-1.5 bg-[#39ff14]/10 border border-[#39ff14]/30 rounded-xl flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#39ff14] animate-in fade-in min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2 truncate">
              <Clock className="w-3.5 h-3.5 text-[#39ff14] shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="truncate">
                <b>Modo Fantasma:</b> {formatDuration(ephemeralDuration)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEphemeralActive(false)}
              className="text-[10px] text-gray-300 hover:text-white underline cursor-pointer shrink-0"
            >
              Desativar
            </button>
          </div>
        )}

        {/* WhatsApp Web-Style Quoting / Reply Banner */}
        {replyingTo && (
          <div className="w-full max-w-4xl mx-auto mb-2 px-3 py-2 bg-[#161a24] rounded-2xl border border-[#2a3346] flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-2 duration-150 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div className="w-1 self-stretch rounded-full bg-[#39ff14] shrink-0 min-h-[30px]" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#39ff14] font-mono truncate flex items-center gap-1.5">
                  <Reply className="w-3 h-3 text-[#39ff14] shrink-0" />
                  <span className="truncate">
                    Respondendo a{' '}
                    {replyingTo.fromMe
                      ? 'Você'
                      : replyingTo.senderJid
                      ? conversation.chatType === 'group'
                        ? replyingTo.senderJid.split('@')[0]
                        : conversation.name
                      : conversation.name}
                  </span>
                </div>
                <div className="text-[11px] text-gray-300 truncate mt-0.5">
                  {replyingTo.content || replyingTo.caption || (replyingTo.mediaUrl ? 'Arquivo de mídia' : 'Mensagem')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0"
              title="Cancelar resposta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Ghost Mention Mode Banner */}
        {isGhostMentionActive && (
          <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-purple-950/90 via-[#1a142e] to-purple-950/90 border border-purple-500/50 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)] text-xs font-mono text-purple-200 animate-in fade-in slide-in-from-bottom-2 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-purple-600/30 border border-purple-400/50 flex items-center justify-center shrink-0">
                <Ghost className="w-4 h-4 text-purple-300 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-purple-200 flex items-center gap-1.5 flex-wrap text-xs">
                  <span>👻 Menção Fantasma Ativa</span>
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/40 font-mono font-bold">
                    Marcar Geral ({conversation.name || 'Grupo'})
                  </span>
                </div>
                <div className="text-[10px] text-purple-300/80 truncate mt-0.5">
                  Todos os membros receberão notificação secreta sem poluir a mensagem com @nomes visíveis.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGhostMentionActive(false)}
              className="px-2.5 py-1 text-[11px] font-bold bg-purple-900/60 hover:bg-purple-800 text-purple-200 hover:text-white rounded-xl border border-purple-500/40 transition shrink-0 cursor-pointer shadow-sm"
              title="Cancelar modo fantasma"
            >
              Desativar
            </button>
          </div>
        )}

        <form onSubmit={handleSendText} className="relative flex items-center gap-1.5 sm:gap-2 w-full max-w-4xl mx-auto min-w-0">
          {/* Tool Button (+ / Tools) triggering Advanced Features Modal */}
          <button
            type="button"
            onClick={() => setShowAdvancedModal(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#161922] hover:bg-[#1f2533] text-[#39ff14] flex items-center justify-center transition shadow-sm shrink-0 border border-[#2a3346] hover:border-[#39ff14] cursor-pointer"
            title="Ferramentas Zapo (Botões, Menus, Carrossel, Webview, Efêmeras, Payloads)"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Quick Jacaré Meme Combo Trigger */}
          <button
            type="button"
            onClick={() => {
              setTextInput((prev) => (prev ? `${prev} 🐊` : '🐊'));
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#161922] hover:bg-[#1f2533] text-emerald-400 hover:text-emerald-300 flex items-center justify-center transition shadow-sm shrink-0 border border-[#2a3346] hover:border-emerald-500 cursor-pointer text-base sm:text-lg"
            title="Inserir Emoji do Jacaré 🐊 (Dispara o Combo de Áudio + Figurinha)"
          >
            🐊
          </button>

          {/* Ghost Mention Shortcut Button for Groups */}
          {isGroup && (
            <button
              type="button"
              onClick={() => {
                setIsGhostMentionActive((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                  return next;
                });
              }}
              className={`h-9 sm:h-10 px-2 sm:px-2.5 rounded-2xl flex items-center gap-1 transition shadow-sm shrink-0 border cursor-pointer font-mono font-bold text-xs ${
                isGhostMentionActive
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-purple-400'
                  : 'bg-[#161922] hover:bg-purple-950/40 text-purple-400 hover:text-purple-300 border-[#2a3346] hover:border-purple-500/60'
              }`}
              title={
                isGhostMentionActive
                  ? 'Menção Fantasma ATIVA (Marcar Geral). Clique para desativar.'
                  : 'Ativar Menção Fantasma (Marcar Geral): Notifica todos do grupo sem @ no texto'
              }
            >
              <Ghost className={`w-3.5 h-3.5 text-purple-400 ${isGhostMentionActive ? 'animate-bounce' : ''}`} />
              <span className="text-[11px] font-black">@GERAL</span>
            </button>
          )}

          {/* Clock Icon Button triggering Ephemeral Message Modal */}
          <button
            type="button"
            onClick={() => setShowEphemeralMenu(true)}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition shadow-sm border cursor-pointer shrink-0 ${
              isEphemeralActive
                ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14] shadow-[0_0_12px_rgba(57,255,20,0.35)]'
                : 'bg-[#161922] hover:bg-[#1f2533] text-gray-400 hover:text-white border-[#2a3346] hover:border-gray-500'
            }`}
            title={
              isEphemeralActive
                ? `Modo Fantasma Ativo (${formatDuration(ephemeralDuration)}). Clique para abrir modal de configuração.`
                : 'Configurar Mensagens Temporárias (Modo Fantasma)'
            }
          >
            <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isEphemeralActive ? 'text-[#39ff14]' : ''}`} />
            {isEphemeralActive && (
              <span className="absolute -top-1 -right-1 bg-[#39ff14] text-black font-black font-mono text-[8px] px-1 rounded-full shadow-sm leading-tight border border-black">
                {formatShortDuration(ephemeralDuration)}
              </span>
            )}
          </button>

          {/* Text Input */}
          <div
            className={`flex-1 min-w-0 bg-[#161922] rounded-2xl flex items-center px-2.5 sm:px-3.5 py-1 border transition ${
              isGhostMentionActive
                ? 'border-purple-500/70 shadow-[0_0_12px_rgba(168,85,247,0.25)] focus-within:border-purple-400'
                : isEphemeralActive
                ? 'border-[#39ff14]/60 shadow-[0_0_8px_rgba(57,255,20,0.15)] focus-within:border-[#39ff14]'
                : 'border-[#2a3346] focus-within:border-[#39ff14]'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={
                isGhostMentionActive
                  ? '👻 Digite a mensagem para marcar geral (fantasma)...'
                  : isEphemeralActive
                  ? `Temporária (${formatShortDuration(ephemeralDuration)})...`
                  : 'Digite uma mensagem...'
              }
              value={textInput}
              onChange={(e) => {
                const val = e.target.value;
                setTextInput(val);
                if (isGroup && !isGhostMentionActive && /^(@todos|@geral|\/todos|\/geral)$/i.test(val.trim())) {
                  setIsGhostMentionActive(true);
                }
              }}
              className="w-full min-w-0 bg-transparent py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none font-sans"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!textInput.trim() || sending}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition shrink-0 cursor-pointer ${
              isGhostMentionActive
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : isEphemeralActive
                ? 'bg-[#39ff14] hover:bg-[#32e012] text-black shadow-[0_0_15px_rgba(57,255,20,0.5)]'
                : 'bg-[#39ff14] hover:bg-[#32e012] text-black shadow-[0_0_12px_rgba(57,255,20,0.3)]'
            } disabled:opacity-40`}
            title={
              isGhostMentionActive
                ? 'Enviar Mensagem com Menção Fantasma (Marcar Geral)'
                : isEphemeralActive
                ? `Enviar Mensagem Temporária (${formatShortDuration(ephemeralDuration)})`
                : 'Enviar'
            }
          >
            {isGhostMentionActive ? <Ghost className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Ephemeral Message Configuration Modal */}
      {showEphemeralMenu && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowEphemeralMenu(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#12151c] border border-[#2a3346] rounded-3xl p-4 sm:p-6 shadow-2xl font-mono animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2a3346]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#39ff14]/15 border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Mensagem Temporária</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40">
                      Modo Fantasma
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400 font-sans">
                    Configuração de autodestruição automática
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEphemeralMenu(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toggle Switch Card */}
            <div className="p-3.5 rounded-2xl bg-[#161a24] border border-[#2a3346] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Status do Modo Temporário:</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isEphemeralActive
                        ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {isEphemeralActive ? 'ATIVADO' : 'DESATIVADO'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-sans">
                  {isEphemeralActive
                    ? `Novas mensagens somem em ${formatDuration(ephemeralDuration)}.`
                    : 'Mensagens permanecem normais no chat.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEphemeralActive(!isEphemeralActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isEphemeralActive ? 'bg-[#39ff14]' : 'bg-[#2a3346]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    isEphemeralActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold">Tempo de Duração:</span>
                <span className="text-[#39ff14] font-black text-sm">
                  {formatDuration(ephemeralDuration)}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { label: '⚡ 1s', val: 1 },
                  { label: '⚡ 2s', val: 2 },
                  { label: '⚡ 3s', val: 3 },
                  { label: '⚡ 5s', val: 5 },
                  { label: '10s', val: 10 },
                  { label: '30s', val: 30 },
                  { label: '1 min', val: 60 },
                  { label: '5 min', val: 300 },
                  { label: '15 min', val: 900 },
                  { label: '1 hora', val: 3600 },
                  { label: '24 horas', val: 86400 },
                  { label: '7 dias', val: 604800 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setEphemeralDuration(opt.val);
                      setIsEphemeralActive(true);
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition text-center cursor-pointer ${
                      ephemeralDuration === opt.val && isEphemeralActive
                        ? 'border-[#39ff14] bg-[#39ff14]/20 text-[#39ff14] shadow-[0_0_12px_rgba(57,255,20,0.25)]'
                        : 'border-[#2a3346] bg-[#161a24] text-gray-300 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="p-3 bg-[#161a24] rounded-2xl border border-[#2a3346] flex items-center justify-between">
              <span className="text-xs text-gray-300">Tempo personalizado:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={ephemeralDuration}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEphemeralDuration(val);
                    setIsEphemeralActive(true);
                  }}
                  className="w-20 px-2.5 py-1.5 bg-[#0e1118] border border-[#2a3346] focus:border-[#39ff14] rounded-xl text-xs text-[#39ff14] font-bold text-center focus:outline-none"
                />
                <span className="text-xs text-gray-400">segundos</span>
              </div>
            </div>

            {/* Explanatory Protocol Note */}
            <p className="text-[11px] text-gray-400 leading-relaxed font-sans bg-black/20 p-2.5 rounded-xl border border-white/5">
              ℹ️ Quando ativado, cada mensagem enviada por você neste chat será agendada para autodestruição automática após o tempo escolhido.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2a3346]">
              {isEphemeralActive && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEphemeralActive(false);
                    setShowEphemeralMenu(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                >
                  Desativar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsEphemeralActive(true);
                  setShowEphemeralMenu(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs flex items-center gap-2 transition shadow-lg cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar & Ativar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Features Modal */}
      <AdvancedFeaturesModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        connectionId={connection.id}
        conversationId={conversation.id}
        recipientJid={conversation.jid}
        onSuccess={() => fetchHistory()}
      />

      {/* Zaptroll Flow Studio Modal */}
      <FlowStudioModal
        isOpen={showFlowStudioModal}
        onClose={() => setShowFlowStudioModal(false)}
        activeConnectionId={connection.id}
      />

      {/* Revoke Confirmation Modal */}
      {revokeModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#161922] rounded-3xl p-6 max-w-sm w-full border border-[#2a3346] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-mono">Apagar para todos?</h4>
                <p className="text-xs text-gray-400">Revogação real via protocolo WhatsApp</p>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] rounded-xl text-xs text-gray-300 italic border border-[#2a3346]">
              "{revokeModalMsg.content}"
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
              Esta ação enviará uma instrução de revogação para os servidores do WhatsApp, solicitando a eliminação da mensagem no aparelho de todos os participantes.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRevokeModalMsg(null)}
                className="px-4 py-2 text-xs font-mono font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRevokeMessage}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold rounded-xl shadow-md transition"
              >
                Apagar para Todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Media Lightbox Modal */}
      {selectedMediaPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedMediaPreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <div className="absolute -top-12 right-0 flex items-center gap-2">
              <a
                href={selectedMediaPreview}
                download="midia_whatsapp.jpg"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition flex items-center gap-1.5 text-xs font-mono border border-white/10"
                title="Baixar arquivo para o computador"
              >
                <Download className="w-4 h-4 text-[#39ff14]" />
                <span>Baixar</span>
              </a>
              <button
                onClick={() => setSelectedMediaPreview(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/10"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={selectedMediaPreview}
              alt="Mídia expandida"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* User Profile & Real Photo Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        connectionId={connection.id}
        conversation={conversation}
        onOpenDevTools={onOpenDevTools}
        onProfileUpdated={(prof) => {
          if (prof.profilePicUrl) {
            setContactProfilePic(prof.profilePicUrl);
            if (onConversationUpdated) {
              onConversationUpdated({
                id: conversation.id,
                profilePicUrl: prof.profilePicUrl,
                name: prof.name || conversation.name,
              });
            }
          }
        }}
      />

      {/* Post Group Status Modal */}
      {isGroup && (
        <PostGroupStatusModal
          isOpen={showGroupStatusModal}
          onClose={() => setShowGroupStatusModal(false)}
          connectionId={connection.id}
          groupJid={conversation.jid}
          groupName={conversation.name || conversation.jid}
          groupPicUrl={contactProfilePic || conversation.profilePicUrl}
        />
      )}
    </div>
  );
};
