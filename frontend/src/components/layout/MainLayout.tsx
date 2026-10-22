import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Smartphone,
  Plus,
  LogOut,
  Users,
  ShieldCheck,
  CheckCheck,
  Sparkles,
  ChevronDown,
  UserCheck,
  Laugh,
  Flame,
  Terminal,
  Bell,
  RefreshCw,
  CheckCircle2,
  CheckSquare,
  Square,
  RotateCcw,
  Lock,
  X,
  Check,
  Phone,
  Radio,
  Swords,
} from 'lucide-react';
import api from '../../services/api.js';
import { Conversation, WhatsAppConnection, Contact, Group } from '../../types/index.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { useSocket } from '../../contexts/SocketContext.js';
import { BottomTabBar, TabType } from './BottomTabBar.js';
import { ChatView } from '../chat/ChatView.js';
import { ConnectionsView } from '../connections/ConnectionsView.js';
import { ContactsView } from '../contacts/ContactsView.js';
import { GroupsView } from '../groups/GroupsView.js';
import { AdminView } from '../admin/AdminView.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';
import { TrollfaceSvg } from '../memes/memeVectors.js';
import { TrollModeBadge } from '../memes/TrollModeBadge.js';
import { EmptyConversationState } from '../memes/EmptyConversationState.js';
import { MemeGalleryModal } from '../memes/MemeGalleryModal.js';
import { TrollNotificationToast, TrollNotification, playTrollSound } from '../notifications/TrollNotificationToast.js';
import { DevToolsModal } from '../dev/DevToolsModal.js';
import { RpgAdminModal } from '../rpg/RpgAdminModal.js';
import { FlowStudioModal } from '../flow-studio/FlowStudioModal.js';
import { FlowsListView } from '../flows/FlowsListView.js';

export const MainLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { socket, setActiveConnectionId } = useSocket();

  const [currentTab, setCurrentTab] = useState<TabType>('conversations');
  const [selectedFlowStudioId, setSelectedFlowStudioId] = useState<string | null>(null);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null);
  const [selectedConnectionFilterId, setSelectedConnectionFilterId] = useState<string>('all');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const selectedConversationRef = React.useRef(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'direct' | 'closed'>('all');
  const [loadingChats, setLoadingChats] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showDevToolsModal, setShowDevToolsModal] = useState(false);
  const [showRpgModal, setShowRpgModal] = useState(false);
  const [showFlowStudioModal, setShowFlowStudioModal] = useState(false);
  const [devToolsInitialQuery, setDevToolsInitialQuery] = useState('');
  const [devToolsInitialTab, setDevToolsInitialTab] = useState<
    'resolver' | 'location' | 'server_health' | 'ghost_mention' | 'status_stories' | 'groups' | 'generator'
  >('resolver');
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TrollNotification | null>(null);
  const [syncingMailbox, setSyncingMailbox] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Bulk ticket selection & close modal states
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [showCloseAllModal, setShowCloseAllModal] = useState<boolean>(false);
  const [showReopenAllModal, setShowReopenAllModal] = useState<boolean>(false);
  const [closingBulk, setClosingBulk] = useState<boolean>(false);

  const selectedConnectionRef = React.useRef(selectedConnection);
  useEffect(() => {
    selectedConnectionRef.current = selectedConnection;
  }, [selectedConnection]);

  const selectedConnectionFilterIdRef = React.useRef(selectedConnectionFilterId);
  useEffect(() => {
    selectedConnectionFilterIdRef.current = selectedConnectionFilterId;
  }, [selectedConnectionFilterId]);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch {}
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
        .then((p) => setNotificationPermission(p))
        .catch(() => {});
    }
  }, []);

  // Reset tab title on window focus
  useEffect(() => {
    const handleFocus = () => {
      document.title = 'Zaptroll — WhatsApp Meme & Troll Lab';
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Fetch user connections
  const fetchConnections = async () => {
    try {
      const res = await api.get('/connections');
      const conns: WhatsAppConnection[] = res.data.connections || [];
      setConnections(conns);

      // Default to first connected or first connection, or update current
      if (conns.length > 0) {
        if (!selectedConnectionRef.current) {
          const connected = conns.find((c) => c.status === 'connected') || conns[0];
          setSelectedConnection(connected);
          setActiveConnectionId(connected.id);
        } else {
          const updated = conns.find((c) => c.id === selectedConnectionRef.current?.id);
          if (updated) {
            setSelectedConnection(updated);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  // Fetch conversations whenever selected connection filter, search or filter changes
  const fetchConversations = async () => {
    setLoadingChats(true);
    try {
      const targetConnId = selectedConnectionFilterId || 'all';
      const res = await api.get(
        `/conversations/connection/${targetConnId}?search=${encodeURIComponent(
          searchQuery
        )}&filter=${filterType}`
      );
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [selectedConnectionFilterId, searchQuery, filterType]);

  // Manual trigger to sync mailbox from Zapo (WhatsApp Web style)
  const handleSyncMailbox = async () => {
    if (syncingMailbox) return;
    setSyncingMailbox(true);
    try {
      if (selectedConnectionFilterId === 'all') {
        for (const c of connections) {
          await api.post(`/conversations/sync/${c.id}`).catch(() => {});
        }
      } else if (selectedConnection) {
        await api.post(`/conversations/sync/${selectedConnection.id}`);
      }
      await fetchConversations();
    } catch (err: any) {
      console.error('Error syncing mailbox:', err);
    } finally {
      setSyncingMailbox(false);
    }
  };

  // Close / Reopen single conversation
  const handleCloseConversation = async (convId: string) => {
    try {
      await api.put(`/conversations/${convId}/close`);
      setConversations((prev) => {
        if (filterType !== 'closed') {
          return prev.filter((c) => c.id !== convId);
        }
        return prev.map((c) => (c.id === convId ? { ...c, status: 'closed' } : c));
      });
      if (selectedConversation?.id === convId) {
        setSelectedConversation((prev) => (prev ? { ...prev, status: 'closed' } : null));
      }
    } catch (err: any) {
      console.error('Error closing conversation:', err);
    }
  };

  const handleReopenConversation = async (convId: string) => {
    try {
      await api.put(`/conversations/${convId}/reopen`);
      setConversations((prev) => {
        if (filterType === 'closed') {
          return prev.filter((c) => c.id !== convId);
        }
        return prev.map((c) => (c.id === convId ? { ...c, status: 'open' } : c));
      });
      if (selectedConversation?.id === convId) {
        setSelectedConversation((prev) => (prev ? { ...prev, status: 'open' } : null));
      }
    } catch (err: any) {
      console.error('Error reopening conversation:', err);
    }
  };

  // Bulk actions: Close all / Reopen all / Close selected
  const handleCloseAll = async () => {
    setClosingBulk(true);
    try {
      await api.post('/conversations/close-all', {
        connectionId: selectedConnectionFilterId,
      });
      setShowCloseAllModal(false);
      setIsSelectMode(false);
      setSelectedConvIds([]);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error closing all conversations:', err);
    } finally {
      setClosingBulk(false);
    }
  };

  const handleReopenAll = async () => {
    setClosingBulk(true);
    try {
      await api.post('/conversations/reopen-all', {
        connectionId: selectedConnectionFilterId,
      });
      setShowReopenAllModal(false);
      setIsSelectMode(false);
      setSelectedConvIds([]);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error reopening all conversations:', err);
    } finally {
      setClosingBulk(false);
    }
  };

  const handleCloseSelected = async () => {
    if (selectedConvIds.length === 0) return;
    setClosingBulk(true);
    try {
      await api.post('/conversations/close-selected', {
        conversationIds: selectedConvIds,
      });
      setIsSelectMode(false);
      setSelectedConvIds([]);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error closing selected conversations:', err);
    } finally {
      setClosingBulk(false);
    }
  };

  const handleReopenSelected = async () => {
    if (selectedConvIds.length === 0) return;
    setClosingBulk(true);
    try {
      for (const id of selectedConvIds) {
        await api.put(`/conversations/${id}/reopen`).catch(() => {});
      }
      setIsSelectMode(false);
      setSelectedConvIds([]);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error reopening selected conversations:', err);
    } finally {
      setClosingBulk(false);
    }
  };

  const toggleSelectConv = (id: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedConvIds.length === conversations.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(conversations.map((c) => c.id));
    }
  };

  // Real-time socket events for updating conversation list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { connectionId: string; message: any; conversation: any }) => {
      const currentFilter = selectedConnectionFilterIdRef.current;
      if (currentFilter === 'all' || currentFilter === data.connectionId) {
        const isCurrentActive =
          selectedConversationRef.current?.id === data.conversation.id ||
          selectedConversationRef.current?.jid === data.conversation.jid ||
          (data.message?.remoteJid && selectedConversationRef.current?.jid === data.message.remoteJid);

        const effectiveUnread = isCurrentActive ? 0 : data.conversation.unreadCount;

        setConversations((prev) => {
          const idx = prev.findIndex(
            (c) => c.jid === data.conversation.jid || c.id === data.conversation.id
          );
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              name: data.conversation.name || updated[idx].name,
              lastMessageText: data.conversation.lastMessageText || data.message?.content,
              lastMessageTimestamp: data.conversation.lastMessageTimestamp || new Date().toISOString(),
              unreadCount: effectiveUnread,
              status: 'open',
              connection: data.conversation.connection || updated[idx].connection,
            };
            const [item] = updated.splice(idx, 1);
            if (filterType === 'closed') {
              return updated;
            }
            return [item, ...updated];
          }
          if (filterType !== 'closed') {
            return [{ ...data.conversation, status: 'open', unreadCount: effectiveUnread }, ...prev];
          }
          return prev;
        });

        if (isCurrentActive) {
          api.post(`/conversations/${data.conversation.id}/read`).catch(() => {});
        } else if (!data.message?.fromMe) {
          playTrollSound();
          const sender = data.conversation.name || 'Nova Mensagem';
          document.title = `(1) ${sender} — Zaptroll`;

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(sender, {
                body: data.message?.content || data.conversation.lastMessageText || 'Nova mensagem recebida no WhatsApp',
                icon: '/icons/icon-192.png',
                tag: data.conversation.id,
              });
              notif.onclick = () => {
                window.focus();
                handleOpenConversationById(data.conversation.id);
              };
            } catch (err) {}
          }

          setActiveNotification({
            id: data.message?.id || String(Date.now()),
            senderName: data.conversation.name || 'Contato WhatsApp',
            senderJid: data.conversation.jid,
            conversationId: data.conversation.id,
            messageText: data.message?.content || data.conversation.lastMessageText || 'Nova mensagem recebida',
            timestamp: new Date(),
          });
        }
      }
    };

    const handleConnectionStatus = (data: { connectionId: string; status: any; phoneNumber?: string }) => {
      setConnections((prev) =>
        prev.map((c) => (c.id === data.connectionId ? { ...c, status: data.status, phoneNumber: data.phoneNumber || c.phoneNumber } : c))
      );
      if (selectedConnectionRef.current?.id === data.connectionId) {
        setSelectedConnection((prev) =>
          prev ? { ...prev, status: data.status, phoneNumber: data.phoneNumber || prev.phoneNumber } : null
        );
      }
    };

    const handleConversationsSynced = (data: { connectionId: string; count: number }) => {
      fetchConversations();
    };

    const handleConversationUpdated = (data: any) => {
      setConversations((prev) => {
        if (filterType !== 'closed' && data.status === 'closed') {
          return prev.filter((c) => c.id !== data.id);
        }
        if (filterType === 'closed' && data.status === 'open') {
          return prev.filter((c) => c.id !== data.id);
        }
        return prev.map((c) => (c.id === data.id ? { ...c, ...data } : c));
      });
      setSelectedConversation((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
    };

    const handleBulkClosed = () => {
      fetchConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('connection_status', handleConnectionStatus);
    socket.on('conversations_synced', handleConversationsSynced);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('conversations_bulk_closed', handleBulkClosed);
    socket.on('conversations_bulk_reopened', handleBulkClosed);
    socket.on('connect', fetchConnections);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('connection_status', handleConnectionStatus);
      socket.off('conversations_synced', handleConversationsSynced);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('conversations_bulk_closed', handleBulkClosed);
      socket.off('conversations_bulk_reopened', handleBulkClosed);
      socket.off('connect', fetchConnections);
    };
  }, [socket, filterType]);

  const handleSelectConnection = (conn: WhatsAppConnection) => {
    setSelectedConnection(conn);
    setActiveConnectionId(conn.id);
    setSelectedConversation(null);
  };

  const handleOpenConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    if (conv.connection) {
      const matched = connections.find((c) => c.id === conv.connectionId);
      if (matched) setSelectedConnection(matched);
    }
    if (conv.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
      api.post(`/conversations/${conv.id}/read`).catch(() => {});
    }
  };

  const handleOpenConversationById = async (convId: string) => {
    try {
      const res = await api.get(`/conversations/${convId}`);
      if (res.data?.conversation) {
        handleOpenConversation(res.data.conversation);
        setCurrentTab('conversations');
      }
    } catch {}
  };

  const handleStartChatWithContact = (contact: Contact) => {
    const jid = contact.jid || `${contact.phoneNumber}@s.whatsapp.net`;
    const existing = conversations.find((c) => c.jid === jid);
    if (existing) {
      handleOpenConversation(existing);
    } else {
      const activeConn = selectedConnection || connections[0];
      const mockConv: Conversation = {
        id: `temp_${Date.now()}`,
        connectionId: activeConn?.id || '',
        jid,
        chatType: 'direct',
        name: contact.name || contact.phoneNumber || jid.split('@')[0],
        unreadCount: 0,
        lastMessageText: null,
        lastMessageTimestamp: new Date().toISOString(),
        status: 'open',
        connection: activeConn ? {
          id: activeConn.id,
          name: activeConn.name,
          phoneNumber: activeConn.phoneNumber,
        } : undefined,
      };
      setSelectedConversation(mockConv);
    }
    setCurrentTab('conversations');
  };

  const handleStartChatWithGroup = (group: Group) => {
    const existing = conversations.find((c) => c.jid === group.jid);
    if (existing) {
      handleOpenConversation(existing);
    } else {
      const activeConn = selectedConnection || connections[0];
      const mockConv: Conversation = {
        id: `temp_${Date.now()}`,
        connectionId: activeConn?.id || '',
        jid: group.jid,
        chatType: 'group',
        name: group.name,
        unreadCount: 0,
        lastMessageText: null,
        lastMessageTimestamp: new Date().toISOString(),
        status: 'open',
        connection: activeConn ? {
          id: activeConn.id,
          name: activeConn.name,
          phoneNumber: activeConn.phoneNumber,
        } : undefined,
      };
      setSelectedConversation(mockConv);
    }
    setCurrentTab('conversations');
  };

  const formatListTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const triggerEasterEgg = () => {
    setEasterEggActive(true);
    setTimeout(() => setEasterEggActive(false), 1200);
  };

  return (
    <div className="h-full w-full max-w-full flex bg-[#0b0e14] overflow-hidden text-white">
      {/* LEFT PANEL / SIDEBAR (Conversations, Navigation) */}
      <div
        className={`w-full md:w-[440px] lg:w-[460px] xl:w-[490px] bg-[#131722] border-r border-[#2a3346] flex flex-col h-full shrink-0 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header */}
        <div className="lab-glass px-3.5 py-2.5 border-b border-[#2a3346] flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Trollface Logo with Click Easter Egg */}
            <div
              onClick={triggerEasterEgg}
              className={`w-9 h-9 rounded-2xl bg-[#161922] border border-[#39ff14]/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(57,255,20,0.3)] cursor-pointer transition-transform shrink-0 ${
                easterEggActive ? 'rotate-[360deg] scale-125 duration-700' : 'hover:scale-105'
              }`}
              title="Clique para testar o Easter Egg do Trollface!"
            >
              <TrollfaceSvg className="w-full h-full object-contain filter drop-shadow" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black font-mono tracking-tight text-white leading-none">
                  ZAPTROLL
                </h1>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#a855f7]/25 text-[#a855f7] border border-[#a855f7]/40">
                  LAB
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrollModeBadge />
              </div>
            </div>
          </div>

          {/* Right Header Area: User profile & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#161922] border border-[#2a3346] shadow-sm">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-[#39ff14] border border-[#39ff14]/30 flex items-center justify-center text-xs font-mono font-black shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden sm:block max-w-[85px] lg:max-w-[120px] min-w-0">
                <div className="text-xs font-semibold text-gray-200 truncate leading-none" title={user?.name}>
                  {user?.name}
                </div>
                <div className="text-[9px] text-[#39ff14] font-mono capitalize leading-none mt-0.5">
                  {user?.role}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sair do Laboratório"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition border border-transparent hover:border-red-500/30 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Connection Widget */}
        <div className="px-3 py-2 bg-[#0e121a] border-b border-[#2a3346] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedConnection?.status === 'connected'
                    ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]'
                    : 'bg-amber-400'
                }`}
              />
              Sessão WhatsApp:
            </span>
            <button
              onClick={() => setCurrentTab('connections')}
              className="text-[10px] text-[#39ff14] font-mono font-bold hover:underline"
            >
              Gerenciar
            </button>
          </div>

          <div>
            {connections.length > 0 ? (
              <select
                value={selectedConnectionFilterId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedConnectionFilterId(val);
                  if (val === 'all') {
                    if (connections.length > 0 && !selectedConnection) {
                      setSelectedConnection(connections[0]);
                    }
                  } else {
                    const conn = connections.find((c) => c.id === val);
                    if (conn) handleSelectConnection(conn);
                  }
                }}
                className="w-full py-1.5 px-2.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs font-mono font-medium text-white shadow-sm focus:outline-none focus:border-[#39ff14]"
              >
                <option value="all" className="bg-[#161922] text-[#39ff14] font-bold">
                  🌐 Todas as Sessões ({connections.length} números)
                </option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#161922] text-white">
                    📱 {c.name} ({c.status === 'connected' ? `Conectado ${c.phoneNumber ? `+${c.phoneNumber}` : ''}` : c.status})
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setCurrentTab('connections')}
                className="w-full py-1.5 px-3 bg-[#161922] border border-dashed border-[#2a3346] hover:border-[#39ff14] rounded-xl text-xs text-gray-400 hover:text-[#39ff14] font-mono transition text-center flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Conexão WhatsApp</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Tools & Modals Bar (Dev Tools, Status, Memes, RPG, Flows) */}
        <div className="px-3 py-1.5 bg-[#0c1017] border-b border-[#2a3346] shrink-0">
          <div className="grid grid-cols-5 gap-1.5">
            {/* Dev Tools */}
            <button
              type="button"
              onClick={() => {
                setDevToolsInitialQuery('');
                setShowDevToolsModal(true);
              }}
              className="py-1 px-1 bg-[#141824] hover:bg-[#1e2535] text-gray-300 hover:text-[#39ff14] border border-[#2a3346] hover:border-[#39ff14]/50 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm group"
              title="Ferramentas de Desenvolvedor (JID, LID, Resolver, Grupos)"
            >
              <Terminal className="w-3.5 h-3.5 text-[#39ff14] group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Dev</span>
            </button>

            {/* Status & Stories */}
            <button
              type="button"
              onClick={() => {
                setDevToolsInitialTab('status_stories');
                setShowDevToolsModal(true);
              }}
              className="py-1 px-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm group"
              title="Abrir Status & Stories do WhatsApp (Ver e Postar)"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Status</span>
            </button>

            {/* Meme Gallery */}
            <button
              type="button"
              onClick={() => setShowGalleryModal(true)}
              className="py-1 px-1 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-purple-200 border border-purple-500/40 hover:border-purple-500/70 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm group"
              title="Abrir Galeria de Memes & Stickers"
            >
              <Laugh className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Memes</span>
            </button>

            {/* RPG Arena */}
            <button
              type="button"
              onClick={() => setShowRpgModal(true)}
              className="py-1 px-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-500/70 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm group"
              title="Abrir Painel do RPG Parlamentar (Arquétipos, Flags e Lutas)"
            >
              <Swords className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">RPG</span>
            </button>

            {/* Flow Studio */}
            <button
              type="button"
              onClick={() => {
                setSelectedFlowStudioId(null);
                setShowFlowStudioModal(true);
              }}
              className="py-1 px-1.5 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 hover:text-blue-200 border border-blue-500/40 hover:border-blue-500/70 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition shadow-sm group"
              title="Abrir Zaptroll Flow Studio (Construtor Visual de Automações WhatsApp)"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Criar Fluxo</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu (Primary Sidebar Views) */}
        <div className="hidden md:block border-b border-[#2a3346] bg-[#10141e] p-1.5 shrink-0">
          <div className={`grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} gap-1 bg-[#0b0e14] p-1 rounded-2xl border border-[#2a3346]`}>
            {/* 1. Conversas */}
            <button
              type="button"
              onClick={() => setCurrentTab('conversations')}
              className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                currentTab === 'conversations'
                  ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#161922]'
              }`}
              title="Ver Conversas Abertas"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Conversas</span>
            </button>

            {/* 2. Fluxos (Flow Studio & Bot Automations) */}
            <button
              type="button"
              onClick={() => setCurrentTab('flows')}
              className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                currentTab === 'flows'
                  ? 'bg-blue-950/60 text-blue-400 border border-blue-500/50 shadow-sm font-bold'
                  : 'text-gray-400 hover:text-blue-300 hover:bg-[#161922]'
              }`}
              title="Gerenciador de Fluxos e Automações WhatsApp"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Fluxos</span>
            </button>

            {/* 3. Contatos */}
            <button
              type="button"
              onClick={() => setCurrentTab('contacts')}
              className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                currentTab === 'contacts'
                  ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#161922]'
              }`}
              title="Lista de Contatos"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Contatos</span>
            </button>

            {/* 4. Grupos */}
            <button
              type="button"
              onClick={() => setCurrentTab('groups')}
              className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                currentTab === 'groups'
                  ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#161922]'
              }`}
              title="Lista de Grupos"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Grupos</span>
            </button>

            {/* 5. Sessões */}
            <button
              type="button"
              onClick={() => setCurrentTab('connections')}
              className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                currentTab === 'connections'
                  ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#161922]'
              }`}
              title="Gerenciar Sessões e Conexões WhatsApp"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Sessões</span>
            </button>

            {/* 6. Admin (se admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCurrentTab('admin')}
                className={`py-1.5 px-0.5 rounded-xl text-[11px] lg:text-xs font-semibold flex items-center justify-center gap-1 transition tracking-tight ${
                  currentTab === 'admin'
                    ? 'bg-purple-950/60 text-purple-300 border border-purple-500/50 shadow-sm font-bold'
                    : 'text-purple-400 hover:text-purple-200 hover:bg-[#161922]'
                }`}
                title="Painel Administrativo do Zaptroll"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* View Switcher based on Tab */}
        {currentTab === 'flows' ? (
          <FlowsListView
            onOpenFlowStudio={(flowId) => {
              setSelectedFlowStudioId(flowId || null);
              setShowFlowStudioModal(true);
            }}
            connections={connections}
          />
        ) : currentTab === 'connections' ? (
          <ConnectionsView
            onSelectConnection={handleSelectConnection}
            selectedConnectionId={selectedConnection?.id}
          />
        ) : currentTab === 'contacts' ? (
          <ContactsView
            connection={selectedConnection}
            onSelectContact={handleStartChatWithContact}
          />
        ) : currentTab === 'groups' ? (
          <GroupsView
            connection={selectedConnection}
            onSelectGroup={handleStartChatWithGroup}
          />
        ) : currentTab === 'admin' ? (
          <AdminView />
        ) : currentTab === 'memes' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a202c] border border-[#2a3346] flex items-center justify-center p-2 mb-3">
              <TrollfaceSvg className="w-full h-full object-contain" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Galeria de Memes & Stickers</h3>
            <button
              type="button"
              onClick={() => setShowGalleryModal(true)}
              className="px-4 py-2 bg-[#39ff14] text-black font-bold text-xs rounded-xl shadow-lg"
            >
              Abrir Galeria Completa
            </button>
          </div>
        ) : (
          /* CONVERSATIONS TAB */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Search and Sync Controls */}
            <div className="p-3 border-b border-[#2a3346] space-y-2 shrink-0 bg-[#0e121a]">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar conversas no laboratório..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSyncMailbox}
                  disabled={syncingMailbox}
                  title="Sincronizar histórico do WhatsApp"
                  className="p-2 bg-[#161922] hover:bg-[#1f2737] border border-[#2a3346] hover:border-[#39ff14] rounded-xl text-gray-400 hover:text-[#39ff14] transition shrink-0 flex items-center justify-center shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingMailbox ? 'animate-spin text-[#39ff14]' : ''}`} />
                </button>

                {notificationPermission === 'default' && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    title="Ativar Notificações no Navegador"
                    className="p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 hover:text-amber-300 transition shrink-0 flex items-center justify-center"
                  >
                    <Bell className="w-3.5 h-3.5 animate-pulse" />
                  </button>
                )}
              </div>

              {/* Filter Pills with Fechados beside Individuais */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterType === 'all'
                      ? 'bg-[#39ff14] text-black font-bold shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                      : 'bg-[#161922] text-gray-400 hover:text-white border border-[#2a3346]'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterType('unread')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterType === 'unread'
                      ? 'bg-[#39ff14] text-black font-bold shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                      : 'bg-[#161922] text-gray-400 hover:text-white border border-[#2a3346]'
                  }`}
                >
                  Não lidas
                </button>
                <button
                  onClick={() => setFilterType('groups')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterType === 'groups'
                      ? 'bg-[#39ff14] text-black font-bold shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                      : 'bg-[#161922] text-gray-400 hover:text-white border border-[#2a3346]'
                  }`}
                >
                  Grupos
                </button>
                <button
                  onClick={() => setFilterType('direct')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterType === 'direct'
                      ? 'bg-[#39ff14] text-black font-bold shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                      : 'bg-[#161922] text-gray-400 hover:text-white border border-[#2a3346]'
                  }`}
                >
                  Individuais
                </button>
                <button
                  onClick={() => setFilterType('closed')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterType === 'closed'
                      ? 'bg-red-500 text-white font-bold shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                      : 'bg-[#161922] text-gray-400 hover:text-red-400 border border-[#2a3346]'
                  }`}
                >
                  Fechados
                </button>
              </div>
            </div>

            {/* Quick Action Bar for Closing & Multi-Selecting Tickets */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#10141e] border-b border-[#2a3346]/60 text-[11px] font-mono shrink-0">
              {!isSelectMode ? (
                <>
                  <span className="text-gray-400 text-[10px]">
                    {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        setIsSelectMode(true);
                        setSelectedConvIds([]);
                      }}
                      className="text-gray-400 hover:text-white text-[10px] flex items-center gap-1 transition"
                      title="Selecionar múltiplas conversas"
                    >
                      <CheckSquare className="w-3 h-3 text-[#39ff14]" />
                      <span>Selecionar</span>
                    </button>

                    {filterType === 'closed' ? (
                      <button
                        onClick={() => setShowReopenAllModal(true)}
                        disabled={conversations.length === 0}
                        className="text-emerald-400 hover:text-emerald-300 font-bold text-[10px] flex items-center gap-1 transition disabled:opacity-40"
                        title="Reabrir todas as conversas fechadas"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reabrir Todas</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCloseAllModal(true)}
                        disabled={conversations.length === 0}
                        className="text-red-400 hover:text-red-300 font-bold text-[10px] flex items-center gap-1 transition disabled:opacity-40"
                        title="Fechar todas as conversas abertas"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Fechar Todas</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAllVisible}
                      className="text-[#39ff14] hover:underline text-[10px] font-semibold"
                    >
                      {selectedConvIds.length === conversations.length ? 'Desmarcar' : 'Marcar Todas'}
                    </button>
                    <span className="text-gray-400 text-[10px]">({selectedConvIds.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {filterType === 'closed' ? (
                      <button
                        onClick={handleReopenSelected}
                        disabled={selectedConvIds.length === 0 || closingBulk}
                        className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold text-[10px] hover:bg-emerald-500/30 disabled:opacity-40 transition flex items-center gap-1"
                      >
                        {closingBulk && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                        <span>Reabrir ({selectedConvIds.length})</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseSelected}
                        disabled={selectedConvIds.length === 0 || closingBulk}
                        className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-bold text-[10px] hover:bg-red-500/30 disabled:opacity-40 transition flex items-center gap-1"
                      >
                        {closingBulk && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                        <span>Fechar ({selectedConvIds.length})</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedConvIds([]);
                      }}
                      className="px-2 py-0.5 text-gray-400 hover:text-white text-[10px] transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#2a3346]/40 pb-16 md:pb-0">
              {loadingChats ? (
                <div className="text-center py-12 text-xs text-gray-400 font-mono">
                  Sincronizando conversas do laboratório...
                </div>
              ) : conversations.length === 0 ? (
                <EmptyConversationState type="no_results" />
              ) : (
                conversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  const isChecked = selectedConvIds.includes(conv.id);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (isSelectMode) {
                          toggleSelectConv(conv.id);
                        } else {
                          handleOpenConversation(conv);
                        }
                      }}
                      className={`flex items-center gap-2.5 p-3 cursor-pointer transition relative group ${
                        isSelected
                          ? 'bg-[#1e2535] border-l-4 border-l-[#39ff14]'
                          : 'hover:bg-[#161b26]'
                      }`}
                    >
                      {/* Checkbox in selection mode */}
                      {isSelectMode && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectConv(conv.id);
                          }}
                          className="p-1 cursor-pointer shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#39ff14]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                          )}
                        </div>
                      )}

                      {/* Meme Avatar with Deterministic Fallback */}
                      <MemeAvatar
                        src={conv.profilePicUrl}
                        seed={conv.jid || conv.name || 'zaptroll'}
                        name={conv.name}
                        size="md"
                        glow={isSelected}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-bold text-white truncate font-sans">
                            {conv.name || conv.jid}
                          </h4>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">
                            {formatListTime(conv.lastMessageTimestamp)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-gray-400 truncate pr-2 font-mono">
                            {conv.lastMessageText || 'Toque para testar mensagens'}
                          </p>

                          {conv.unreadCount > 0 && (
                            <span className="w-4 h-4 bg-[#39ff14] text-black text-[10px] font-black font-mono rounded-full flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(57,255,20,0.5)]">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Connection & Status Badges */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {conv.phoneNumber && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/50 border border-emerald-500/30 text-[9px] font-mono text-emerald-400" title="Telefone do contato">
                              <Phone className="w-2.5 h-2.5 text-emerald-400" />
                              +{conv.phoneNumber.replace(/\D/g, '')}
                            </span>
                          )}
                          {conv.connection && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#162033] border border-[#2a3f66] text-[9px] font-mono text-cyan-300" title={`Canal de envio: ${conv.connection.name}`}>
                              <Smartphone className="w-2.5 h-2.5 text-cyan-400" />
                              <span className="text-gray-400 text-[8px] uppercase tracking-wider">Canal:</span>
                              <span className="font-semibold text-cyan-200">{conv.connection.name}</span>
                            </span>
                          )}

                          {conv.status === 'closed' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-[9px] font-mono text-red-400 font-bold">
                              <Lock className="w-2.5 h-2.5" />
                              Fechado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick close/reopen action button on card hover */}
                      {!isSelectMode && (
                        <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition ml-1">
                          {conv.status === 'closed' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReopenConversation(conv.id);
                              }}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition shadow-sm"
                              title="Reabrir conversa"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseConversation(conv.id);
                              }}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition shadow-sm"
                              title="Fechar conversa"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Mobile Bottom Bar */}
        <BottomTabBar
          currentTab={currentTab}
          onChangeTab={(tab) => {
            if (tab === 'memes') {
              setShowGalleryModal(true);
            } else {
              setCurrentTab(tab);
              setSelectedConversation(null);
            }
          }}
          unreadCount={conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
        />
      </div>

      {/* RIGHT PANEL / CHAT VIEW (Desktop or Mobile Slide) */}
      <div
        className={`flex-1 min-w-0 w-full max-w-full h-full flex flex-col bg-[#0d1117] overflow-hidden ${
          selectedConversation ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            connection={
              connections.find((c) => c.id === selectedConversation.connectionId) ||
              selectedConnection ||
              connections[0]
            }
            onBack={() => setSelectedConversation(null)}
            onOpenDevTools={(initialQuery, initialTab) => {
              setDevToolsInitialQuery(initialQuery || '');
              if (initialTab) setDevToolsInitialTab(initialTab);
              setShowDevToolsModal(true);
            }}
            onConversationUpdated={(updatedConv) => {
              setConversations((prev) => {
                if (filterType !== 'closed' && updatedConv.status === 'closed') {
                  return prev.filter((c) => c.id !== updatedConv.id);
                }
                if (filterType === 'closed' && updatedConv.status === 'open') {
                  return prev.filter((c) => c.id !== updatedConv.id);
                }
                return prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c));
              });
              setSelectedConversation((prev) =>
                prev && prev.id === updatedConv.id ? { ...prev, ...updatedConv } : prev
              );
            }}
          />
        ) : (
          /* Lab Splash Screen */
          <EmptyConversationState
            type="no_selection"
            onOpenTools={() => setCurrentTab('connections')}
          />
        )}
      </div>

      {/* Meme & Troll Gallery Modal */}
      <MemeGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
      />

      {/* Developer Tools Modal */}
      <DevToolsModal
        isOpen={showDevToolsModal}
        onClose={() => setShowDevToolsModal(false)}
        connections={connections}
        activeConnectionId={selectedConversation?.connectionId || selectedConnection?.id}
        initialQuery={devToolsInitialQuery}
        initialTab={devToolsInitialTab}
      />

      {/* Zaptroll RPG Admin Modal */}
      <RpgAdminModal
        isOpen={showRpgModal}
        onClose={() => setShowRpgModal(false)}
      />

      {/* Zaptroll Flow Studio Modal */}
      <FlowStudioModal
        isOpen={showFlowStudioModal}
        onClose={() => setShowFlowStudioModal(false)}
        connections={connections}
        activeConnectionId={selectedConversation?.connectionId || selectedConnection?.id}
        initialFlowId={selectedFlowStudioId}
      />

      {/* Modal: Confirm Close All Conversations */}
      {showCloseAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131722] border border-red-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Fechar Todas as Conversas?</h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  {conversations.length} conversas serão movidas para "Fechados".
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              As conversas não serão apagadas. Elas ficarão na aba <strong>Fechados</strong> e serão reabertas automaticamente caso o contato envie uma nova mensagem.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseAllModal(false)}
                className="px-3 py-1.5 rounded-xl bg-[#1a202c] hover:bg-[#252d3d] text-gray-300 text-xs font-mono font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseAll}
                disabled={closingBulk}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono transition shadow-lg flex items-center gap-1.5"
              >
                {closingBulk && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Sim, Fechar Todas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reopen All Conversations */}
      {showReopenAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131722] border border-emerald-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Reabrir Todas as Conversas?</h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  Todas as conversas fechadas voltarão para as abas ativas.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenAllModal(false)}
                className="px-3 py-1.5 rounded-xl bg-[#1a202c] hover:bg-[#252d3d] text-gray-300 text-xs font-mono font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReopenAll}
                disabled={closingBulk}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono transition shadow-lg flex items-center gap-1.5"
              >
                {closingBulk && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Sim, Reabrir Todas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Troll Notification Toast */}
      {activeNotification && (
        <TrollNotificationToast
          notification={activeNotification}
          onClose={() => setActiveNotification(null)}
          onOpenConversation={(convId: string) => {
            handleOpenConversationById(convId);
            setActiveNotification(null);
          }}
        />
      )}
    </div>
  );
};
