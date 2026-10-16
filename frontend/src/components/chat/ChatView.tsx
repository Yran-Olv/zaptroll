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
  Play,
  Volume2,
  Image as ImageIcon,
  X,
  Reply,
  CornerDownRight,
  CornerDownLeft,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import api from '../../services/api.js';
import { Conversation, Message, WhatsAppConnection, ContactProfile } from '../../types/index.js';
import { useSocket } from '../../contexts/SocketContext.js';
import { AdvancedFeaturesModal } from '../advanced-menu/AdvancedFeaturesModal.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';
import { MemeBackground } from '../memes/MemeBackground.js';
import { EmptyConversationState } from '../memes/EmptyConversationState.js';
import { UserProfileModal } from '../profile/UserProfileModal.js';

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
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  connection,
  onBack,
  onConversationUpdated,
}) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
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

  // Click outside to close ephemeral popover menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ephemeralMenuRef.current && !ephemeralMenuRef.current.contains(e.target as Node)) {
        setShowEphemeralMenu(false);
      }
    };
    if (showEphemeralMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/messages/history/${conversation.id}?limit=100`);
      setMessages(res.data.messages);
      setTimeout(scrollToBottom, 100);
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

    const textToSend = textInput.trim();
    const quoteStanza = replyingTo?.stanzaId;
    setTextInput('');
    setReplyingTo(null);
    setSending(true);

    try {
      if (isEphemeralActive) {
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
    <div className="flex-1 min-w-0 w-full max-w-full flex flex-col h-full bg-[#0d1117] relative overflow-hidden wa-lab-bg select-none">
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
              <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1 truncate">
                <span className="truncate max-w-[120px] sm:max-w-[200px]">{conversation.jid}</span>
                <span>•</span>
                <span className={`shrink-0 ${connection.status === 'connected' ? 'text-[#10b981]' : 'text-amber-400'}`}>
                  {connection.status === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Action: Zapo Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
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
                        className="mb-2 p-2 rounded-xl bg-black/40 hover:bg-black/60 cursor-pointer border-l-[3.5px] border-[#39ff14] transition select-none flex flex-col group/quote"
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
                      </div>
                    )}

                  {/* 2. Video Media */}
                  {(msg.messageType === 'video' || msg.mediaMimetype?.startsWith('video/')) && (
                    <div className="mb-2 overflow-hidden rounded-xl bg-black relative border border-white/10">
                      {msg.mediaUrl ? (
                        <video src={msg.mediaUrl} controls className="max-h-72 w-full rounded-xl" />
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
                    <div className="mb-2 p-1.5 bg-black/40 rounded-xl flex items-center gap-2 border border-white/10">
                      {msg.mediaUrl ? (
                        <audio src={msg.mediaUrl} controls className="w-full h-8" />
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
                    const displayContent =
                      msg.caption ||
                      (!isGenericFallback || !hasRenderedMedia ? msg.content : null);

                    if (!displayContent) return null;

                    return (
                      <div className="whitespace-pre-wrap break-words leading-relaxed font-sans text-[13px] mt-0.5">
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
        className="relative bg-[#131722]/95 backdrop-blur-xl border-t border-[#2a3346] px-2 sm:px-3 pt-2 pb-5 sm:pb-3 z-20 w-full max-w-full min-w-0 overflow-hidden"
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

          {/* Clock Icon Button for Quick Ephemeral Message Toggle & Config */}
          <div className="relative shrink-0" ref={ephemeralMenuRef}>
            <button
              type="button"
              onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition shadow-sm border cursor-pointer ${
                isEphemeralActive
                  ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14] shadow-[0_0_12px_rgba(57,255,20,0.35)]'
                  : 'bg-[#161922] hover:bg-[#1f2533] text-gray-400 hover:text-white border-[#2a3346] hover:border-gray-500'
              }`}
              title={
                isEphemeralActive
                  ? `Modo Fantasma Ativo (${formatDuration(ephemeralDuration)}). Clique para ajustar ou desativar.`
                  : 'Configurar Mensagens Temporárias Rápidas (Modo Fantasma)'
              }
            >
              <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isEphemeralActive ? 'text-[#39ff14]' : ''}`} />
              {isEphemeralActive && (
                <span className="absolute -top-1 -right-1 bg-[#39ff14] text-black font-black font-mono text-[8px] px-1 rounded-full shadow-sm leading-tight border border-black">
                  {formatShortDuration(ephemeralDuration)}
                </span>
              )}
            </button>

            {/* Quick Ephemeral Popover */}
            {showEphemeralMenu && (
              <div className="absolute bottom-full mb-2 left-0 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-[#12151c] border border-[#2a3346] rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 font-mono">
                {/* Header with Title and Toggle Switch */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#2a3346]">
                  <div className="flex items-center gap-1.5 text-white text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-[#39ff14]" />
                    <span>Mensagem Temporária</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEphemeralActive(!isEphemeralActive)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEphemeralActive ? 'bg-[#39ff14]' : 'bg-[#2a3346]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                        isEphemeralActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Duration Presets */}
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Tempo de expiração:</span>
                    <span className="text-[#39ff14] font-bold">{formatDuration(ephemeralDuration)}</span>
                  </div>

                  {/* Quick Seconds & Time Options */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '1s', val: 1 },
                      { label: '2s', val: 2 },
                      { label: '3s', val: 3 },
                      { label: '4s', val: 4 },
                      { label: '5s', val: 5 },
                      { label: '10s', val: 10 },
                      { label: '30s', val: 30 },
                      { label: '1m', val: 60 },
                      { label: '5m', val: 300 },
                      { label: '1h', val: 3600 },
                      { label: '24h', val: 86400 },
                      { label: '7d', val: 604800 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setEphemeralDuration(opt.val);
                          setIsEphemeralActive(true);
                        }}
                        className={`py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                          ephemeralDuration === opt.val && isEphemeralActive
                            ? 'border-[#39ff14] bg-[#39ff14]/25 text-[#39ff14]'
                            : 'border-[#2a3346] bg-[#161922] text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Seconds Input */}
                  <div className="pt-1 flex items-center justify-between bg-[#161922] p-2 rounded-xl border border-[#2a3346]">
                    <span className="text-[10px] text-gray-400">Personalizado:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={ephemeralDuration}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setEphemeralDuration(val);
                          setIsEphemeralActive(true);
                        }}
                        className="w-16 px-2 py-0.5 bg-[#0e1118] border border-[#2a3346] focus:border-[#39ff14] rounded-lg text-[11px] text-[#39ff14] font-bold text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">seg</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 pt-0.5 leading-tight">
                    {isEphemeralActive
                      ? '⚡ Ativo: mensagens enviadas se autodestruirão após o tempo configurado.'
                      : 'ℹ️ Ative o toggle para que todas as mensagens enviadas se apaguem automaticamente.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Text Input */}
          <div
            className={`flex-1 min-w-0 bg-[#161922] rounded-2xl flex items-center px-2.5 sm:px-3.5 py-1 border transition ${
              isEphemeralActive
                ? 'border-[#39ff14]/60 shadow-[0_0_8px_rgba(57,255,20,0.15)] focus-within:border-[#39ff14]'
                : 'border-[#2a3346] focus-within:border-[#39ff14]'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={
                isEphemeralActive
                  ? `Temporária (${formatShortDuration(ephemeralDuration)})...`
                  : 'Digite uma mensagem...'
              }
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full min-w-0 bg-transparent py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none font-sans"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!textInput.trim() || sending}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition shrink-0 cursor-pointer ${
              isEphemeralActive
                ? 'bg-[#39ff14] hover:bg-[#32e012] text-black shadow-[0_0_15px_rgba(57,255,20,0.5)]'
                : 'bg-[#39ff14] hover:bg-[#32e012] text-black shadow-[0_0_12px_rgba(57,255,20,0.3)]'
            } disabled:opacity-40`}
            title={isEphemeralActive ? `Enviar Mensagem Temporária (${formatShortDuration(ephemeralDuration)})` : 'Enviar'}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Advanced Features Modal */}
      <AdvancedFeaturesModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        connectionId={connection.id}
        conversationId={conversation.id}
        recipientJid={conversation.jid}
        onSuccess={() => fetchHistory()}
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
            <button
              onClick={() => setSelectedMediaPreview(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
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
    </div>
  );
};
