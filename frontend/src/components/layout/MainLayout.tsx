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

export const MainLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { socket, setActiveConnectionId } = useSocket();

  const [currentTab, setCurrentTab] = useState<TabType>('conversations');
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const selectedConversationRef = React.useRef(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  const [loadingChats, setLoadingChats] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TrollNotification | null>(null);
  const [syncingMailbox, setSyncingMailbox] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const selectedConnectionRef = React.useRef(selectedConnection);
  useEffect(() => {
    selectedConnectionRef.current = selectedConnection;
  }, [selectedConnection]);

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
      const conns: WhatsAppConnection[] = res.data.connections;
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

  // Fetch conversations whenever selected connection, search or filter changes
  const fetchConversations = async () => {
    if (!selectedConnection) return;
    setLoadingChats(true);
    try {
      const res = await api.get(
        `/conversations/connection/${selectedConnection.id}?search=${encodeURIComponent(
          searchQuery
        )}&filter=${filterType}`
      );
      setConversations(res.data.conversations);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [selectedConnection?.id, searchQuery, filterType]);

  // Manual trigger to sync mailbox from Zapo (WhatsApp Web style)
  const handleSyncMailbox = async () => {
    if (!selectedConnection || syncingMailbox) return;
    setSyncingMailbox(true);
    try {
      await api.post(`/conversations/sync/${selectedConnection.id}`);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error syncing mailbox:', err);
    } finally {
      setSyncingMailbox(false);
    }
  };

  // Real-time socket events for updating conversation list
  useEffect(() => {
    if (!socket || !selectedConnection) return;

    const handleNewMessage = (data: { connectionId: string; message: any; conversation: any }) => {
      const currentConn = selectedConnectionRef.current;
      if (currentConn && data.connectionId === currentConn.id) {
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
            };
            // Move to top
            const [item] = updated.splice(idx, 1);
            return [item, ...updated];
          }
          return [{ ...data.conversation, unreadCount: effectiveUnread }, ...prev];
        });

        if (isCurrentActive) {
          api.post(`/conversations/${data.conversation.id}/read`).catch(() => {});
        } else if (!data.message?.fromMe) {
          // 1. Play laboratory chime sound
          playTrollSound();

          // 2. Set tab title with notification
          const sender = data.conversation.name || 'Nova Mensagem';
          document.title = `(1) ${sender} — Zaptroll`;

          // 3. Trigger native browser/mobile OS notification
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

          // 4. In-app troll toast
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
      const currentConn = selectedConnectionRef.current;
      if (currentConn && data.connectionId === currentConn.id) {
        fetchConversations();
      }
    };

    socket.on('connect', fetchConnections);
    socket.on('new_message', handleNewMessage);
    socket.on('connection_status', handleConnectionStatus);
    socket.on('conversations_synced', handleConversationsSynced);

    return () => {
      socket.off('connect', fetchConnections);
      socket.off('new_message', handleNewMessage);
      socket.off('connection_status', handleConnectionStatus);
      socket.off('conversations_synced', handleConversationsSynced);
    };
  }, [socket, selectedConnection?.id]);

  const handleOpenConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    if (conv.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
      try {
        await api.post(`/conversations/${conv.id}/read`);
      } catch (err) {}
    }
  };

  const handleOpenConversationById = (conversationId: string) => {
    const target = conversations.find((c) => c.id === conversationId);
    if (target) {
      handleOpenConversation(target);
    }
    setActiveNotification(null);
  };

  const handleSelectConnection = (conn: WhatsAppConnection) => {
    setSelectedConnection(conn);
    setActiveConnectionId(conn.id);
    setSelectedConversation(null);
    setCurrentTab('conversations');
  };

  const handleStartChatWithContact = (contact: Contact) => {
    const jid = contact.jid;
    const existing = conversations.find((c) => c.jid === jid);
    if (existing) {
      handleOpenConversation(existing);
    } else {
      const mockConv: Conversation = {
        id: `temp_${Date.now()}`,
        connectionId: selectedConnection!.id,
        jid,
        chatType: 'direct',
        name: contact.name || contact.phoneNumber || jid.split('@')[0],
        unreadCount: 0,
        lastMessageText: null,
        lastMessageTimestamp: new Date().toISOString(),
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
      const mockConv: Conversation = {
        id: `temp_${Date.now()}`,
        connectionId: selectedConnection!.id,
        jid: group.jid,
        chatType: 'group',
        name: group.name,
        unreadCount: 0,
        lastMessageText: null,
        lastMessageTimestamp: new Date().toISOString(),
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
    <div className="h-full w-full max-w-full flex bg-[#0b0e14] overflow-hidden select-none text-white">
      {/* LEFT PANEL / SIDEBAR (Conversations, Navigation) */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] bg-[#131722] border-r border-[#2a3346] flex flex-col h-full shrink-0 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header */}
        <div className="lab-glass px-4 py-3 border-b border-[#2a3346] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Trollface Logo with Click Easter Egg */}
            <div
              onClick={triggerEasterEgg}
              className={`w-9 h-9 rounded-2xl bg-[#161922] border border-[#39ff14]/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(57,255,20,0.3)] cursor-pointer transition-transform ${
                easterEggActive ? 'rotate-[360deg] scale-125 duration-700' : 'hover:scale-105'
              }`}
              title="Clique para testar o Easter Egg do Trollface!"
            >
              <TrollfaceSvg className="w-full h-full object-contain filter drop-shadow" />
            </div>

            <div>
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

          <div className="flex items-center gap-1.5">
            {/* Meme Gallery Shortcut Button */}
            <button
              type="button"
              onClick={() => setShowGalleryModal(true)}
              className="p-1.5 text-gray-300 hover:text-[#39ff14] hover:bg-[#1a202c] rounded-xl transition border border-transparent hover:border-[#2a3346]"
              title="Abrir Galeria de Memes & Stickers"
            >
              <Laugh className="w-4 h-4" />
            </button>

            <div className="text-right mr-1 hidden sm:block">
              <div className="text-xs font-semibold text-gray-200 leading-none">{user?.name}</div>
              <div className="text-[9px] text-[#39ff14] font-mono capitalize mt-0.5">{user?.role}</div>
            </div>

            <button
              onClick={logout}
              title="Sair do Laboratório"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition"
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
                value={selectedConnection?.id || ''}
                onChange={(e) => {
                  const conn = connections.find((c) => c.id === e.target.value);
                  if (conn) handleSelectConnection(conn);
                }}
                className="w-full py-1.5 px-2.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs font-mono font-medium text-white shadow-sm focus:outline-none focus:border-[#39ff14]"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#161922] text-white">
                    {c.name} ({c.status === 'connected' ? `Conectado ${c.phoneNumber ? `+${c.phoneNumber}` : ''}` : c.status})
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

        {/* Tab Navigation Menu (Desktop Sidebar Tabs) */}
        <div className="hidden md:flex border-b border-[#2a3346] bg-[#10141e] px-2 py-1.5 gap-1 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCurrentTab('conversations')}
            className={`flex-1 py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
              currentTab === 'conversations'
                ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161922]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Conversas</span>
          </button>
          <button
            onClick={() => setCurrentTab('contacts')}
            className={`flex-1 py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
              currentTab === 'contacts'
                ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161922]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Contatos</span>
          </button>
          <button
            onClick={() => setCurrentTab('groups')}
            className={`flex-1 py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
              currentTab === 'groups'
                ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161922]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Grupos</span>
          </button>
          <button
            onClick={() => setCurrentTab('connections')}
            className={`flex-1 py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
              currentTab === 'connections'
                ? 'bg-[#1a202c] text-[#39ff14] border border-[#2a3346] shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161922]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Sessões</span>
          </button>
          <button
            onClick={() => setShowGalleryModal(true)}
            className="py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition text-purple-400 hover:text-purple-300 hover:bg-[#161922] border border-transparent hover:border-purple-500/30"
            title="Galeria de Memes"
          >
            <Laugh className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`py-1 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                currentTab === 'admin'
                  ? 'bg-purple-950/40 text-purple-300 border border-purple-500/40'
                  : 'text-gray-400 hover:text-white hover:bg-[#161922]'
              }`}
              title="Painel Administrativo"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher based on Tab */}
        {currentTab === 'connections' ? (
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
          /* Mobile memes tab triggers gallery view directly */
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
            {/* Search and Filters */}
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

                {selectedConnection && (
                  <button
                    type="button"
                    onClick={handleSyncMailbox}
                    disabled={syncingMailbox}
                    title="Sincronizar histórico e contatos do WhatsApp"
                    className="p-2 bg-[#161922] hover:bg-[#1f2737] border border-[#2a3346] hover:border-[#39ff14] rounded-xl text-gray-400 hover:text-[#39ff14] transition shrink-0 flex items-center justify-center shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingMailbox ? 'animate-spin text-[#39ff14]' : ''}`} />
                  </button>
                )}

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

              {/* Filter Pills */}
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
              </div>
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
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleOpenConversation(conv)}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition relative group ${
                        isSelected
                          ? 'bg-[#1e2535] border-l-4 border-l-[#39ff14]'
                          : 'hover:bg-[#161b26]'
                      }`}
                    >
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
                      </div>
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
        {selectedConversation && selectedConnection ? (
          <ChatView
            conversation={selectedConversation}
            connection={selectedConnection}
            onBack={() => setSelectedConversation(null)}
            onConversationUpdated={(updatedConv) => {
              setConversations((prev) =>
                prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
              );
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
            onOpenGallery={() => setShowGalleryModal(true)}
          />
        )}
      </div>

      {/* Meme Gallery Modal */}
      <MemeGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
      />

      {/* Cyber Trollface Realtime Notification Toast */}
      <TrollNotificationToast
        notification={activeNotification}
        onClose={() => setActiveNotification(null)}
        onOpenConversation={handleOpenConversationById}
      />
    </div>
  );
};
