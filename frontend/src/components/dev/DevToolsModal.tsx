import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Code2,
  Send,
  Link,
  CheckCircle2,
  AlertCircle,
  FileCode,
  MapPin,
  Globe,
  Activity,
  Wifi,
  Radio,
  Eye,
  AtSign,
  Sparkles,
  Phone,
  Server,
  MessageSquare,
  Clock,
  Layers,
  Smartphone,
  Bot,
  Vote,
  Building2,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Download,
  Sliders,
  FileText,
} from 'lucide-react';
import api from '../../services/api.js';
import { WhatsAppConnection } from '../../types/index.js';
import { ExportContactsModal } from '../profile/ExportContactsModal.js';
import { PostGroupStatusModal } from '../chat/PostGroupStatusModal.js';
import {
  downloadGroupContactsVcf,
  downloadGroupContactsWhaticketCsv,
  downloadGroupContactsTxt,
  extractCleanDigits,
} from '../../utils/contactExport.js';

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: WhatsAppConnection[];
  activeConnectionId?: string;
  initialQuery?: string;
  initialTab?: 'resolver' | 'location' | 'server_health' | 'ghost_mention' | 'status_stories' | 'groups' | 'generator' | 'community';
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  isOpen,
  onClose,
  connections,
  activeConnectionId,
  initialQuery,
  initialTab = 'resolver',
}) => {
  const [activeTab, setActiveTab] = useState<
    'resolver' | 'location' | 'server_health' | 'ghost_mention' | 'status_stories' | 'groups' | 'generator' | 'community'
  >(initialTab);
  const [selectedConnId, setSelectedConnId] = useState<string>(activeConnectionId || connections[0]?.id || '');

  // Tab 1: Resolver States
  const [queryInput, setQueryInput] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);
  const [resolvedResult, setResolvedResult] = useState<any>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Tab 2: Location & DDD Lookup States
  const [locationPhoneInput, setLocationPhoneInput] = useState<string>('');
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);
  const [locationResult, setLocationResult] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Tab 3: Official WhatsApp Server Health States
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false);
  const [healthResult, setHealthResult] = useState<any>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Tab 4: Ghost Mentions States
  const [ghostTargetJid, setGhostTargetJid] = useState<string>('');
  const [ghostText, setGhostText] = useState<string>('');
  const [ghostMentionAll, setGhostMentionAll] = useState<boolean>(true);
  const [ghostSpecificInput, setGhostSpecificInput] = useState<string>('');
  const [sendingGhost, setSendingGhost] = useState<boolean>(false);
  const [ghostFeedback, setGhostFeedback] = useState<string | null>(null);

  // Tab 5: Status & Stories States
  const [statusSubTab, setStatusSubTab] = useState<'view' | 'post'>('view');
  const [recentStories, setRecentStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState<boolean>(false);
  const [newStatusText, setNewStatusText] = useState<string>('');
  const [newStatusColor, setNewStatusColor] = useState<string>('#25D366');
  const [newStatusFont, setNewStatusFont] = useState<number>(0);
  const [newStatusImageUrl, setNewStatusImageUrl] = useState<string>('');
  const [newStatusImageBase64, setNewStatusImageBase64] = useState<string | null>(null);
  const [newStatusAlsoPersonal, setNewStatusAlsoPersonal] = useState<boolean>(false);
  const [newStatusTargetGroups, setNewStatusTargetGroups] = useState<string[]>([]);
  const [newStatusMentionAll, setNewStatusMentionAll] = useState<boolean>(true);
  const [postingStatus, setPostingStatus] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Tab 6: Groups Inspector States
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [participantSearch, setParticipantSearch] = useState<string>('');
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<any[]>([]);
  const [loadingGroupParticipants, setLoadingGroupParticipants] = useState<boolean>(false);
  const [showDevExportModal, setShowDevExportModal] = useState<boolean>(false);
  const [devExportFeedback, setDevExportFeedback] = useState<string | null>(null);
  const [showDevGroupStatusModal, setShowDevGroupStatusModal] = useState<boolean>(false);

  // Tab 7: Community & Protocol Reverse Engineering (Jobas Fernandes)
  const [communitySubTab, setCommunitySubTab] = useState<'ai' | 'banner' | 'group_status' | 'poll'>('ai');
  const [bannerJid, setBannerJid] = useState<string>('');
  const [bannerText, setBannerText] = useState<string>('Esta empresa agora usa um serviço seguro da Meta para gerenciar esta conversa.');
  const [sendingBanner, setSendingBanner] = useState<boolean>(false);
  const [bannerFeedback, setBannerFeedback] = useState<string | null>(null);

  const [aiJid, setAiJid] = useState<string>('');
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState<string>(
    'Você é o Meta AI integrado ao Zaptroll. Responda de forma sucinta e amigável, formatando código e tabelas perfeitamente.'
  );
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [aiSending, setAiSending] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const [groupStatusJid, setGroupStatusJid] = useState<string>('');
  const [groupStatusCaption, setGroupStatusCaption] = useState<string>(
    '🚀 ZapTroll — WhatsApp Developer Platform & RPG! https://github.com/Yran-Olv/zaptroll.git'
  );
  const [groupStatusImageUrl, setGroupStatusImageUrl] = useState<string>(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&q=80'
  );
  const [groupStatusImageBase64, setGroupStatusImageBase64] = useState<string | null>(null);
  const [groupStatusMentionAll, setGroupStatusMentionAll] = useState<boolean>(true);
  const [sendingGroupStatus, setSendingGroupStatus] = useState<boolean>(false);
  const [groupStatusFeedback, setGroupStatusFeedback] = useState<string | null>(null);

  const [pollJid, setPollJid] = useState<string>('');
  const [pollQuestion, setPollQuestion] = useState<string>(
    'Qual recurso do ZapTroll você achou mais inovador?'
  );
  const [pollOptions, setPollOptions] = useState<string[]>([
    '🤖 Meta AI (/ai) com Selo Nativo "IA"',
    '🏢 Banner "Meta hospedou este chat"',
    '🟢 Status em Grupos (groupStatusMessageV2)',
    '📊 Enquetes Nativas Interativas',
  ]);
  const [pollSelectableCount, setPollSelectableCount] = useState<number>(1);
  const [sendingPoll, setSendingPoll] = useState<boolean>(false);
  const [pollFeedback, setPollFeedback] = useState<string | null>(null);

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
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (initialQuery) {
        setQueryInput(initialQuery);
        setLocationPhoneInput(initialQuery.replace(/\D/g, ''));
        if (initialTab === 'location') {
          handleLocationLookup(initialQuery);
        } else if (initialTab === 'resolver') {
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
              .finally(() => setResolving(false));
          }
        }
      }
    }
  }, [isOpen, initialQuery, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'server_health' && selectedConnId) {
      fetchServerHealth();
    }
    if (isOpen && activeTab === 'status_stories' && selectedConnId) {
      fetchStatusStories();
      fetchGroups();
    }
    if (isOpen && (activeTab === 'groups' || activeTab === 'ghost_mention') && selectedConnId) {
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
      setResolveError(err.response?.data?.error || err.message || 'Erro ao consultar WhatsApp.');
    } finally {
      setResolving(false);
    }
  };

  const tabTrackRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabTrackRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabTrackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (tabTrackRef.current) {
      const activeEl = tabTrackRef.current.querySelector(`[data-tab-id="${activeTab}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const handleLocationLookup = async (phoneToLookup?: string) => {
    const raw = phoneToLookup || locationPhoneInput;
    if (!raw.trim()) return;

    setLoadingLocation(true);
    setLocationError(null);
    setLocationResult(null);

    try {
      const res = await api.get(
        `/advanced/phone-lookup/${encodeURIComponent(raw.trim())}?connectionId=${encodeURIComponent(selectedConnId || '')}`
      );
      setLocationResult(res.data);
      if (res.data.isResolvedFromLid && res.data.formattedNational) {
        setLocationPhoneInput(res.data.realPhoneNumber || res.data.cleaned);
      }
    } catch (err: any) {
      setLocationError(err.response?.data?.error || err.message || 'Erro ao localizar número.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchServerHealth = async () => {
    if (!selectedConnId) return;
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await api.get(`/advanced/server-health/${selectedConnId}`);
      setHealthResult(res.data);
    } catch (err: any) {
      setHealthError(err.response?.data?.error || err.message || 'Falha ao medir latência do servidor.');
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchStatusStories = async () => {
    if (!selectedConnId) return;
    setLoadingStories(true);
    try {
      const res = await api.get(`/advanced/status/${selectedConnId}`);
      setRecentStories(res.data.stories || []);
    } catch (err: any) {
      console.warn('Erro ao carregar stories:', err);
    } finally {
      setLoadingStories(false);
    }
  };

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim() && !newStatusImageBase64 && !newStatusImageUrl) return;
    if (!selectedConnId) return;

    setPostingStatus(true);
    setStatusFeedback(null);
    try {
      await api.post('/advanced/status/post', {
        connectionId: selectedConnId,
        type: newStatusImageBase64 || newStatusImageUrl ? 'image' : 'text',
        text: newStatusText.trim(),
        caption: newStatusText.trim(),
        backgroundColor: newStatusColor,
        font: newStatusFont,
        targetGroups: newStatusTargetGroups,
        mentionAll: newStatusMentionAll,
        imageBase64: newStatusImageBase64 || undefined,
        imageUrl: newStatusImageUrl.trim() || undefined,
        alsoPostToPersonal: newStatusAlsoPersonal,
      });
      const isGroup = newStatusTargetGroups.length > 0;
      const grpMsg = isGroup
        ? `🟢 Story de Grupo (groupStatusMessageV2) postado com sucesso em ${newStatusTargetGroups.length} grupo(s)${newStatusMentionAll ? ' com Menção Fantasma 👻' : ''}! O anel verde já aparece no avatar do grupo.`
        : '✅ Status pessoal publicado com sucesso no WhatsApp!';
      setStatusFeedback(grpMsg);
      setNewStatusText('');
      setNewStatusImageBase64(null);
      setNewStatusImageUrl('');
      setTimeout(() => setStatusFeedback(null), 6000);
      fetchStatusStories();
    } catch (err: any) {
      setStatusFeedback(`❌ Erro: ${err.response?.data?.error || err.message}`);
    } finally {
      setPostingStatus(false);
    }
  };

  const handleMarkStatusViewed = async (story: any) => {
    if (!selectedConnId || !story.id) return;
    try {
      await api.post('/advanced/status/view', {
        connectionId: selectedConnId,
        stanzaId: story.id,
        senderJid: story.senderJid,
      });
      setRecentStories((prev) =>
        prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s))
      );
    } catch (err) {
      console.warn('Erro ao marcar status como visto:', err);
    }
  };

  const handleSendGhostMention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnId || !ghostTargetJid || !ghostText.trim()) return;

    setSendingGhost(true);
    setGhostFeedback(null);
    try {
      const specificList = ghostSpecificInput
        ? ghostSpecificInput
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const res = await api.post('/advanced/ghost-mention', {
        connectionId: selectedConnId,
        targetJid: ghostTargetJid,
        text: ghostText.trim(),
        mentionAll: ghostMentionAll,
        specificMentions: specificList,
      });

      setGhostFeedback(`👻 Sucesso! Mensagem fantasma enviada. (${res.data.mentionedCount} pessoas marcadas)`);
      setGhostText('');
      setGhostSpecificInput('');
      setTimeout(() => setGhostFeedback(null), 5000);
    } catch (err: any) {
      setGhostFeedback(`❌ Falha: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingGhost(false);
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
        setSelectedGroup(list[0]);
      }
      if (list.length > 0 && !ghostTargetJid) {
        setGhostTargetJid(list[0].jid);
      }
    } catch (err: any) {
      console.error('Erro ao buscar grupos:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Carrega os participantes completos do grupo selecionado
  useEffect(() => {
    if (selectedGroup && selectedConnId) {
      if (selectedGroup.metadata?.participants && selectedGroup.metadata.participants.length > 0) {
        setSelectedGroupParticipants(selectedGroup.metadata.participants);
      } else {
        fetchGroupParticipants(selectedGroup.jid);
      }
    } else {
      setSelectedGroupParticipants([]);
    }
  }, [selectedGroup?.jid, selectedConnId]);

  const fetchGroupParticipants = async (groupJid: string) => {
    if (!selectedConnId || !groupJid) return;
    setLoadingGroupParticipants(true);
    try {
      const res = await api.get('/contacts/profile', {
        params: { connectionId: selectedConnId, jid: groupJid },
      });
      if (res.data?.groupDetails?.participants) {
        setSelectedGroupParticipants(res.data.groupDetails.participants);
      }
    } catch (err) {
      console.warn('Erro ao carregar participantes do grupo:', err);
    } finally {
      setLoadingGroupParticipants(false);
    }
  };

  const handleDevQuickDownloadVcf = () => {
    if (!selectedGroup || selectedGroupParticipants.length === 0) return;
    const count = downloadGroupContactsVcf(selectedGroupParticipants, {
      groupName: selectedGroup.name,
      prefix: selectedGroup.name,
    });
    setDevExportFeedback(`📱 ${count} contatos .VCF baixados para Celular!`);
    setTimeout(() => setDevExportFeedback(null), 3500);
  };

  const handleDevQuickDownloadWhaticket = () => {
    if (!selectedGroup || selectedGroupParticipants.length === 0) return;
    const count = downloadGroupContactsWhaticketCsv(selectedGroupParticipants, {
      groupName: selectedGroup.name,
      prefix: selectedGroup.name,
    });
    setDevExportFeedback(`💬 CSV com ${count} contatos para Whaticket baixado!`);
    setTimeout(() => setDevExportFeedback(null), 3500);
  };

  const handleDevQuickDownloadTxt = () => {
    if (!selectedGroup || selectedGroupParticipants.length === 0) return;
    const count = downloadGroupContactsTxt(selectedGroupParticipants, {
      groupName: selectedGroup.name,
    });
    setDevExportFeedback(`📄 TXT com ${count} telefones baixado!`);
    setTimeout(() => setDevExportFeedback(null), 3500);
  };

  const handleDevCopyPhones = () => {
    if (!selectedGroup || selectedGroupParticipants.length === 0) return;
    const phones = selectedGroupParticipants
      .map((p) => extractCleanDigits(p))
      .filter((n) => n.length >= 8)
      .join('\n');
    copyToClipboard(phones, 'group_phones');
  };

  // Community Feature Handlers (Jobas Fernandes)
  const handleSendBanner = async () => {
    if (!selectedConnId || !bannerJid) {
      setBannerFeedback('❌ Selecione a conexão e informe o JID do chat privado.');
      return;
    }
    setSendingBanner(true);
    setBannerFeedback(null);
    try {
      const res = await api.post('/advanced/meta-banner', {
        connectionId: selectedConnId,
        jid: bannerJid.trim(),
        messageText: bannerText.trim(),
      });
      setBannerFeedback(`🏢 Sucesso! Banner de privacidade da Meta ativado no chat (${res.data.messageId || 'OK'}).`);
      setTimeout(() => setBannerFeedback(null), 6000);
    } catch (err: any) {
      setBannerFeedback(`❌ Falha: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingBanner(false);
    }
  };

  const handleAskAi = async () => {
    if (!selectedConnId || !aiJid || !aiQuestion) {
      setAiFeedback('❌ Informe a conexão, o JID do chat e a pergunta para o Meta AI.');
      return;
    }
    setAiSending(true);
    setAiFeedback(null);
    setAiResult(null);
    try {
      const res = await api.post('/advanced/meta-ai', {
        connectionId: selectedConnId,
        jid: aiJid.trim(),
        question: aiQuestion.trim(),
        systemPrompt: aiSystemPrompt.trim(),
        imageBase64: aiImageBase64 || undefined,
      });
      setAiResult(res.data);
      if (res.data?.success) {
        setAiFeedback('🤖 Pergunta respondida com sucesso e carimbada com o selo nativo "IA"!');
      } else {
        setAiFeedback(`⚠️ Resposta recebida: ${res.data?.answerText || 'Sem texto'}`);
      }
    } catch (err: any) {
      setAiFeedback(`❌ Falha: ${err.response?.data?.error || err.message}`);
    } finally {
      setAiSending(false);
    }
  };

  const handleSendGroupStatus = async () => {
    if (!selectedConnId || !groupStatusJid) {
      setGroupStatusFeedback('❌ Selecione a conexão e o grupo (@g.us).');
      return;
    }
    setSendingGroupStatus(true);
    setGroupStatusFeedback(null);
    try {
      const res = await api.post('/advanced/group-status', {
        connectionId: selectedConnId,
        groupJid: groupStatusJid.trim(),
        caption: groupStatusCaption.trim(),
        imageUrl: groupStatusImageUrl.trim() || undefined,
        imageBase64: groupStatusImageBase64 || undefined,
        mentionAll: groupStatusMentionAll,
      });
      setGroupStatusFeedback(`🟢 Sucesso! Story publicado no grupo (${res.data.statusId || 'OK'}). Anel verde no avatar ativado!${groupStatusMentionAll ? ' 👻 Todos os membros foram marcados!' : ''}`);
      setTimeout(() => setGroupStatusFeedback(null), 6000);
    } catch (err: any) {
      setGroupStatusFeedback(`❌ Falha: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingGroupStatus(false);
    }
  };

  const handleSendPoll = async () => {
    if (!selectedConnId || !pollJid || !pollQuestion || pollOptions.length < 2) {
      setPollFeedback('❌ Informe o chat, a pergunta e pelo menos 2 opções para a enquete.');
      return;
    }
    setSendingPoll(true);
    setPollFeedback(null);
    try {
      const res = await api.post('/advanced/poll', {
        connectionId: selectedConnId,
        jid: pollJid.trim(),
        question: pollQuestion.trim(),
        options: pollOptions.filter(Boolean),
        selectableCount: pollSelectableCount,
      });
      setPollFeedback(`📊 Enquete disparada com sucesso! (${res.data.pollId || 'OK'})`);
      setTimeout(() => setPollFeedback(null), 6000);
    } catch (err: any) {
      setPollFeedback(`❌ Falha: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingPoll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0e121a] border border-[#232b3e] rounded-3xl w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232b3e] bg-[#121622]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#39ff14]/10 border border-[#39ff14]/30 flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.2)]">
              <Terminal className="w-5 h-5 text-[#39ff14]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white font-sans uppercase tracking-wider">
                  Dev Tools & WhatsApp Protocol
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 font-bold">
                  v2.5 PRO
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans">
                Localizador de DDD, Ping Oficial, Menções Fantasmas, Status/Stories & Gerador Interativo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header Bar: Session Selector and Mode Info */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2 bg-[#0d1017] border-b border-[#1f2637] gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-gray-300">
              PAINEL DO DESENVOLVEDOR // ZAPTROLL
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-mono">Sessão:</span>
            <select
              value={selectedConnId}
              onChange={(e) => setSelectedConnId(e.target.value)}
              className="bg-[#181d29] border border-[#2a3346] text-white text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:border-[#39ff14] cursor-pointer"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phoneNumber ? `(${c.phoneNumber})` : ''} - {c.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dedicated Responsive Scrollable Tabs Bar with Left/Right Chevrons */}
        <div className="relative bg-[#10141e] border-b border-[#232b3e] flex items-center px-1 sm:px-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0 hidden sm:flex"
            title="Rolar abas para a esquerda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={tabTrackRef}
            className="flex-1 flex items-center gap-1.5 py-2 px-2 overflow-x-auto scrollbar-none scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {[
              { id: 'resolver', label: 'Resolver JID / LID', icon: Search },
              { id: 'location', label: 'Localidade & DDD', icon: MapPin },
              { id: 'server_health', label: 'Ping & Quedas Meta', icon: Activity },
              { id: 'ghost_mention', label: 'Menção Fantasma', icon: AtSign },
              { id: 'status_stories', label: 'Status & Stories', icon: Radio },
              { id: 'groups', label: 'Grupos', icon: Users },
              { id: 'generator', label: 'PIX & Payloads', icon: FileCode },
              { id: 'community', label: '🚀 Comunidade Zapo', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isActive
                      ? tab.id === 'community'
                        ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.25)]'
                        : 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                      : tab.id === 'community'
                      ? 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10 border border-transparent'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0 hidden sm:flex"
            title="Rolar abas para a direita"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
              </form>

              {resolveError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* Resolved Data Display */}
              {resolvedResult && (
                <div className="bg-[#141924] border border-[#242e42] rounded-2xl p-5 space-y-5 animate-fadeIn">
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
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase font-bold">
                            {resolvedResult.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {resolvedResult.phoneNumber ? `+${resolvedResult.phoneNumber}` : resolvedResult.jid}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Identification Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-[#181f2f] rounded-xl border border-[#2b374e]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase text-gray-400">JID WhatsApp</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(resolvedResult.jid, 'jid')}
                          className="text-gray-400 hover:text-white"
                        >
                          {copiedKey === 'jid' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-cyan-300 break-all select-all">{resolvedResult.jid}</p>
                    </div>

                    {resolvedResult.lid && (
                      <div className="p-3 bg-[#181f2f] rounded-xl border border-[#2b374e]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono uppercase text-gray-400">LID Companion</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resolvedResult.lid, 'lid')}
                            className="text-gray-400 hover:text-white"
                          >
                            {copiedKey === 'lid' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-xs font-mono text-amber-300 break-all select-all">{resolvedResult.lid}</p>
                      </div>
                    )}
                  </div>

                  {resolvedResult.type !== 'group' && (
                    <button
                      type="button"
                      onClick={() => {
                        const numToUse =
                          resolvedResult.cleanNumber ||
                          (resolvedResult.phoneNumber ? resolvedResult.phoneNumber.replace(/\D/g, '') : '') ||
                          (resolvedResult.jid ? resolvedResult.jid.replace(/\D/g, '') : '');
                        setLocationPhoneInput(numToUse);
                        setActiveTab('location');
                        handleLocationLookup(numToUse);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/40 text-[#39ff14] text-xs font-bold font-mono flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-[#39ff14]" />
                      <span>📍 Consultar Localidade & Endereço Real ({resolvedResult.phoneNumber || 'DDD'})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCALIDADE & DDD LOOKUP */}
          {activeTab === 'location' && (
            <div className="space-y-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLocationLookup();
                }}
                className="space-y-3"
              >
                <label className="text-xs font-bold text-gray-300 block">
                  Buscar Localidade, Estado, Cidade e DDD pelo Número de Telefone:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={locationPhoneInput}
                      onChange={(e) => setLocationPhoneInput(e.target.value)}
                      placeholder="Ex: 553488895686, (34) 99198-782, 11987654321..."
                      className="w-full bg-[#181d29] border border-[#2a3346] text-white px-4 py-2.5 rounded-2xl text-xs font-mono placeholder:text-gray-500 focus:outline-none focus:border-[#39ff14] transition"
                    />
                    {locationPhoneInput && (
                      <button
                        type="button"
                        onClick={() => setLocationPhoneInput('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loadingLocation || !locationPhoneInput.trim()}
                    className="px-5 py-2.5 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs rounded-2xl transition flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(57,255,20,0.3)] disabled:opacity-50"
                  >
                    <MapPin className={`w-4 h-4 ${loadingLocation ? 'animate-spin' : ''}`} />
                    <span>{loadingLocation ? 'Buscando...' : 'Buscar Local'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="font-semibold text-gray-300">Testar DDDs:</span>
                  <button type="button" onClick={() => { setLocationPhoneInput('553488895686'); handleLocationLookup('553488895686'); }} className="underline hover:text-[#39ff14]">
                    34 (Uberlândia/Uberaba)
                  </button>
                  <span>•</span>
                  <button type="button" onClick={() => { setLocationPhoneInput('5531999998888'); handleLocationLookup('5531999998888'); }} className="underline hover:text-[#39ff14]">
                    31 (Belo Horizonte)
                  </button>
                  <span>•</span>
                  <button type="button" onClick={() => { setLocationPhoneInput('5511999998888'); handleLocationLookup('5511999998888'); }} className="underline hover:text-[#39ff14]">
                    11 (São Paulo)
                  </button>
                  <span>•</span>
                  <button type="button" onClick={() => { setLocationPhoneInput('5521999998888'); handleLocationLookup('5521999998888'); }} className="underline hover:text-[#39ff14]">
                    21 (Rio de Janeiro)
                  </button>
                </div>
              </form>

              {locationError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}

              {locationResult && (
                <div className="bg-[#141924] border border-[#242e42] rounded-3xl p-6 space-y-6 animate-fadeIn">
                  {/* LID Conversion Banner if applicable */}
                  {locationResult.isResolvedFromLid && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-emerald-950/40 border border-purple-500/40 shadow-lg flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-300 border border-purple-500/40">
                              LID CONVERTIDO COM SUCESSO
                            </span>
                            {locationResult.resolvedName && (
                              <span className="text-xs font-mono font-bold text-white">
                                {locationResult.resolvedName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-300 font-mono mt-1">
                            LID Original: <span className="text-amber-300 font-bold">{locationResult.originalLid || locationPhoneInput}</span> ➔ Número Real: <span className="text-[#39ff14] font-bold">{locationResult.formattedNational}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Header Card */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#192233] to-[#131b29] border border-[#2b374e]">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl p-2 bg-black/30 rounded-2xl border border-white/5">
                        {locationResult.country.flag}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-black text-white font-sans">
                            {locationResult.hubCity
                              ? `${locationResult.hubCity} (${locationResult.state?.code || 'BR'})`
                              : locationResult.state
                              ? `${locationResult.state.name} (${locationResult.state.code})`
                              : locationResult.country.name}
                          </h4>
                          {locationResult.ddd && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono text-xs font-bold">
                              DDD {locationResult.ddd}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 font-sans mt-0.5">
                          📍 {locationResult.approximateAddress || locationResult.regionName}
                        </p>
                        {locationResult.probableCarrier && (
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Operadoras: <strong className="text-gray-200">{locationResult.probableCarrier}</strong></span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={locationResult.waMeLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir wa.me</span>
                      </a>
                      {locationResult.coordinates && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            locationResult.approximateAddress || `${locationResult.hubCity || ''}, ${locationResult.state?.code || ''}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition flex items-center gap-1.5"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Interactive Map Embed */}
                  {locationResult.coordinates && (
                    <div className="rounded-2xl overflow-hidden border border-[#2a3346] shadow-xl bg-black/50">
                      <div className="px-4 py-2.5 bg-[#161a24] border-b border-[#2a3346] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-gray-300 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#39ff14]" />
                          <span>Localização Geográfica do Polo Regional: <strong>{locationResult.hubCity || locationResult.state?.name} ({locationResult.state?.code})</strong></span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          Lat: {locationResult.coordinates.lat.toFixed(4)}, Lng: {locationResult.coordinates.lng.toFixed(4)}
                        </span>
                      </div>
                      <iframe
                        title="Mapa de Localização Regional"
                        width="100%"
                        height="230"
                        className="border-0 opacity-90 hover:opacity-100 transition"
                        loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationResult.coordinates.lng - 0.25}%2C${locationResult.coordinates.lat - 0.2}%2C${locationResult.coordinates.lng + 0.25}%2C${locationResult.coordinates.lat + 0.2}&layer=mapnik&marker=${locationResult.coordinates.lat}%2C${locationResult.coordinates.lng}`}
                      />
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-[#181f2f] rounded-2xl border border-[#2b374e]">
                      <span className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Formato Nacional</span>
                      <p className="text-sm font-mono font-bold text-white select-all">
                        {locationResult.formattedNational || locationResult.cleaned}
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#181f2f] rounded-2xl border border-[#2b374e]">
                      <span className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Formato Internacional</span>
                      <p className="text-sm font-mono font-bold text-cyan-300 select-all">
                        {locationResult.formattedInternational || `+${locationResult.cleaned}`}
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#181f2f] rounded-2xl border border-[#2b374e]">
                      <span className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Tipo de Linha & Dígito</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-sans font-bold text-emerald-400">
                          {locationResult.carrierType === 'mobile' ? 'Telefone Celular (Móvel)' : 'Linha Fixa / Especial'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Main Cities List */}
                  {locationResult.mainCities && locationResult.mainCities.length > 0 && (
                    <div className="p-4 bg-[#181f2f] rounded-2xl border border-[#2b374e] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white font-sans flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span>Principais Cidades e Municípios da Região (DDD {locationResult.ddd}):</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {locationResult.allCities?.length || locationResult.mainCities.length} municípios mapeados
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(locationResult.allCities || locationResult.mainCities).map((city: string) => (
                          <span
                            key={city}
                            className="px-2.5 py-1 rounded-xl bg-black/40 border border-[#2c374d] text-gray-300 text-xs font-sans hover:border-[#39ff14] hover:text-white transition cursor-default"
                          >
                            {city}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SERVER HEALTH & PING CHECK */}
          {activeTab === 'server_health' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#141924] border border-[#242e42] rounded-2xl">
                <div>
                  <h4 className="text-sm font-bold text-white font-sans">
                    Monitor em Tempo Real dos Servidores Oficiais do WhatsApp (Meta)
                  </h4>
                  <p className="text-xs text-gray-400 font-sans">
                    Mede latência direta (Roundtrip TCP/WebSocket), Clock Skew do servidor e status de quedas globais
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchServerHealth}
                  disabled={loadingHealth}
                  className="px-4 py-2 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.3)] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                  <span>{loadingHealth ? 'Medindo Ping...' : 'Medir Ping Novamente'}</span>
                </button>
              </div>

              {healthError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{healthError}</span>
                </div>
              )}

              {healthResult && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                  {/* Ping Card */}
                  <div className="p-5 rounded-2xl bg-[#141924] border border-[#242e42] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-gray-400 uppercase">Latência / Ping Oficial</span>
                        <Wifi className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black font-mono ${healthResult.latencyMs < 100 ? 'text-[#39ff14]' : healthResult.latencyMs < 300 ? 'text-amber-400' : 'text-red-400'}`}>
                          {healthResult.latencyMs}
                        </span>
                        <span className="text-sm font-mono text-gray-400">ms</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-sans mt-3">
                      {healthResult.latencyMs < 100 ? '🟢 Excelente (Conexão instantânea)' : '🟡 Razoável'}
                    </span>
                  </div>

                  {/* Clock Skew Card */}
                  <div className="p-5 rounded-2xl bg-[#141924] border border-[#242e42] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-gray-400 uppercase">Clock Skew (Diferença)</span>
                        <Clock className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-cyan-300">
                          {healthResult.clockSkewMs ?? 0}
                        </span>
                        <span className="text-sm font-mono text-gray-400">ms</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-sans mt-3">
                      Sincronização de relógio perfeita com a Meta
                    </span>
                  </div>

                  {/* Outage Status Card */}
                  <div className="p-5 rounded-2xl bg-[#141924] border border-[#242e42] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-gray-400 uppercase">Status Meta / WhatsApp</span>
                        <ShieldCheck className="w-4 h-4 text-[#39ff14]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-black uppercase font-sans ${healthResult.metaStatus?.status === 'OPERATIONAL' ? 'text-[#39ff14]' : 'text-red-400'}`}>
                          {healthResult.metaStatus?.status === 'OPERATIONAL' ? '100% Operacional' : 'Queda / Instabilidade'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-sans mt-3">
                      {healthResult.metaStatus?.description || 'Nenhum incidente relatado nos servidores.'}
                    </span>
                  </div>
                </div>
              )}

              {healthResult && (
                <div className="p-5 bg-[#141924] border border-[#242e42] rounded-2xl space-y-3">
                  <h5 className="text-xs font-bold text-white font-sans uppercase">
                    Protocolo de Transporte & Detalhes da Conexão
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-[#181f2f] rounded-xl border border-[#2b374e]">
                      <span className="text-gray-400 block text-[10px]">Host do Gateway Oficial:</span>
                      <span className="text-white font-bold">{healthResult.serverHost}:{healthResult.serverPort}</span>
                    </div>
                    <div className="p-3 bg-[#181f2f] rounded-xl border border-[#2b374e]">
                      <span className="text-gray-400 block text-[10px]">Criptografia de Sessão:</span>
                      <span className="text-emerald-400 font-bold">{healthResult.transport}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MENÇÕES FANTASMAS (GHOST MENTION) */}
          {activeTab === 'ghost_mention' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex items-start gap-3">
                <AtSign className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-purple-300 font-sans">
                    Como funciona a Menção Fantasma (Invisible Tag):
                  </h4>
                  <p className="text-[11px] text-gray-300 font-sans mt-0.5">
                    O WhatsApp enviará notificação sonora e o badge de menção <strong>@</strong> para todos os participantes marcados, mas o texto do balão de mensagem fica 100% limpo, sem nenhuma lista de arrobas ou números visíveis!
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendGhostMention} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5">
                    Selecione o Grupo ou Chat de Destino:
                  </label>
                  <select
                    value={ghostTargetJid}
                    onChange={(e) => setGhostTargetJid(e.target.value)}
                    className="w-full bg-[#181d29] border border-[#2a3346] text-white px-3.5 py-2.5 rounded-2xl text-xs font-mono focus:outline-none focus:border-[#39ff14]"
                  >
                    {groups.map((g) => (
                      <option key={g.jid} value={g.jid}>
                        👥 {g.name} ({g.participantCount || 0} membros) - {g.jid}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 bg-[#181f2f] border border-[#2a3346] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      🚨 Marcar Todos os Participantes do Grupo Invisivelmente
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Puxa todos os membros e marca no contexto silencioso sem poluir a mensagem
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ghostMentionAll}
                    onChange={(e) => setGhostMentionAll(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#39ff14] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5">
                    Adicionar Telefones Específicos Adicionais (opcional, separados por vírgula):
                  </label>
                  <input
                    type="text"
                    value={ghostSpecificInput}
                    onChange={(e) => setGhostSpecificInput(e.target.value)}
                    placeholder="Ex: 553488895686, 553499198782..."
                    className="w-full bg-[#181d29] border border-[#2a3346] text-white px-3.5 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-[#39ff14]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5">
                    Texto da Mensagem:
                  </label>
                  <textarea
                    rows={4}
                    value={ghostText}
                    onChange={(e) => setGhostText(e.target.value)}
                    placeholder="Digite seu aviso, recado ou trollada aqui..."
                    className="w-full bg-[#181d29] border border-[#2a3346] text-white p-3.5 rounded-2xl text-xs font-sans focus:outline-none focus:border-[#39ff14]"
                  />
                </div>

                {ghostFeedback && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-sans flex items-center gap-2 ${
                      ghostFeedback.startsWith('👻') || ghostFeedback.startsWith('✅')
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}
                  >
                    <span>{ghostFeedback}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingGhost || !ghostText.trim() || !ghostTargetJid}
                  className="w-full py-3 bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] hover:from-[#7c3aed] hover:to-[#5b21b6] text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(139,92,246,0.3)] disabled:opacity-50"
                >
                  <AtSign className="w-4 h-4" />
                  <span>{sendingGhost ? 'Enviando Menção Fantasma...' : '👻 Enviar Menção Fantasma'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: STATUS & STORIES */}
          {activeTab === 'status_stories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#232b3e] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusSubTab('view')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      statusSubTab === 'view'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Status Recebidos ({recentStories.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusSubTab('post')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      statusSubTab === 'post'
                        ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Postar Novo Status</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={fetchStatusStories}
                  disabled={loadingStories}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                  title="Atualizar Status"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStories ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Sub-tab 1: Ver Status Recebidos */}
              {statusSubTab === 'view' && (
                <div className="space-y-4">
                  {recentStories.length === 0 ? (
                    <div className="text-center py-12 bg-[#141924] border border-[#242e42] rounded-3xl">
                      <Radio className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-300">Nenhum status capturado ainda</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Quando contatos da sua agenda postarem novos status no WhatsApp, eles aparecerão aqui automaticamente!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {recentStories.map((story) => (
                        <div
                          key={story.id}
                          className="p-4 rounded-2xl bg-[#141924] border border-[#242e42] flex flex-col justify-between space-y-3"
                          style={{
                            borderLeft: `4px solid ${story.backgroundColor || '#25D366'}`,
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-white font-sans truncate">
                                {story.senderName}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(story.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div
                              className="p-3 rounded-xl text-xs font-sans text-white min-h-[70px] flex items-center justify-center text-center shadow-inner"
                              style={{ backgroundColor: story.backgroundColor || '#1e2638' }}
                            >
                              <p className="line-clamp-3">{story.content || story.caption || 'Mídia / Foto'}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] text-gray-400 font-mono truncate">
                              +{story.senderPhone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkStatusViewed(story)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                                story.viewed
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{story.viewed ? 'Visto' : 'Marcar Visto'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Postar Novo Status */}
              {statusSubTab === 'post' && (
                <form onSubmit={handlePostStatus} className="space-y-4 max-w-xl mx-auto">
                  {/* Status Destination Banner */}
                  {newStatusTargetGroups.length > 0 ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full border-2 border-[#25D366] p-0.5 shrink-0 shadow-[0_0_12px_rgba(37,211,102,0.4)]">
                        <div className="w-full h-full rounded-full bg-[#1f2c34] flex items-center justify-center text-xs">
                          👥
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">Story Nativo de Grupo (groupStatusMessageV2)</span>
                        <span className="text-gray-300 text-[11px] leading-tight">
                          Será postado diretamente nos {newStatusTargetGroups.length} grupo(s) selecionados com o anel verde no avatar e botão "Responder ao grupo...".
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full border-2 border-blue-400 p-0.5 shrink-0">
                        <div className="w-full h-full rounded-full bg-[#1f2c34] flex items-center justify-center text-xs">
                          👤
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">Status Pessoal (status@broadcast)</span>
                        <span className="text-gray-300 text-[11px] leading-tight">
                          Postado na aba Atualizações do seu número WhatsApp para seus contatos.
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1.5">
                      Texto / Legenda do Status:
                    </label>
                    <textarea
                      rows={3}
                      value={newStatusText}
                      onChange={(e) => setNewStatusText(e.target.value)}
                      placeholder="Escreva a mensagem ou legenda do status..."
                      className="w-full bg-[#181d29] border border-[#2a3346] text-white p-3.5 rounded-2xl text-xs font-sans focus:outline-none focus:border-[#39ff14]"
                    />
                  </div>

                  {/* Image Upload / URL for Story */}
                  <div className="bg-[#181d29] p-3.5 rounded-2xl border border-[#2a3346] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="text-base">🖼️</span>
                        <span>Imagem do Story / Banner (Opcional):</span>
                      </label>
                      {newStatusImageBase64 && (
                        <button
                          type="button"
                          onClick={() => setNewStatusImageBase64(null)}
                          className="text-[10px] text-red-400 hover:text-red-300 underline"
                        >
                          Remover imagem
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-2 bg-[#1e2738] hover:bg-[#253248] rounded-xl border border-[#2b374e] text-xs text-gray-300 cursor-pointer flex items-center gap-2 transition shrink-0">
                        <span>📁</span>
                        <span>{newStatusImageBase64 ? 'Imagem Carregada' : 'Fazer Upload'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setNewStatusImageBase64(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      <input
                        type="text"
                        value={newStatusImageUrl}
                        onChange={(e) => setNewStatusImageUrl(e.target.value)}
                        placeholder="Ou cole a URL da imagem (https://...)"
                        className="flex-1 bg-[#121622] border border-[#2a3346] text-white px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-[#39ff14]"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {newStatusTargetGroups.length > 0 && !newStatusImageBase64 && !newStatusImageUrl
                        ? 'ℹ️ Se não enviar imagem, será usado o banner vertical padrão de alta definição com sua legenda.'
                        : 'Formatos recomendados: vertical 9:16 (1080x1920) para preencher a tela do WhatsApp.'}
                    </p>
                  </div>

                  {/* Color Picker (for personal status or fallback) */}
                  {!newStatusImageBase64 && !newStatusImageUrl && (
                    <div>
                      <label className="text-xs font-bold text-gray-300 block mb-1.5">
                        Cor de Fundo:
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {['#25D366', '#7C3AED', '#2563EB', '#DC2626', '#EA580C', '#0F172A', '#D97706'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewStatusColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition ${
                              newStatusColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Groups Selection */}
                  <div className="bg-[#181d29] p-4 rounded-2xl border border-[#2a3346] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Publicar como Story no Grupo (groupStatusMessageV2):</span>
                      </label>
                      {newStatusTargetGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewStatusTargetGroups([])}
                          className="text-[10px] text-gray-400 hover:text-white"
                        >
                          Desmarcar Grupos ({newStatusTargetGroups.length})
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {groups.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic">Nenhum grupo carregado. Carregando...</span>
                      ) : (
                        groups.map((grp) => {
                          const isSelected = newStatusTargetGroups.includes(grp.jid);
                          const isZapTroll = grp.name?.toLowerCase().includes('zaptroll');
                          return (
                            <button
                              key={grp.jid}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setNewStatusTargetGroups(newStatusTargetGroups.filter((j) => j !== grp.jid));
                                } else {
                                  setNewStatusTargetGroups([...newStatusTargetGroups, grp.jid]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14] shadow-sm'
                                  : isZapTroll
                                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-300 hover:bg-purple-900/50'
                                  : 'bg-[#121622] hover:bg-white/5 border-[#2a3346] text-gray-300'
                              }`}
                            >
                              <span>{grp.name || grp.jid}</span>
                              {isSelected && <Check className="w-3 h-3 text-[#39ff14]" />}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {newStatusTargetGroups.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-purple-300 font-mono font-bold flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newStatusMentionAll}
                              onChange={(e) => setNewStatusMentionAll(e.target.checked)}
                              className="rounded bg-[#121622] border-purple-500 text-purple-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>👻 Marcar Geral no Grupo (Menção Fantasma no Story)</span>
                          </label>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Notifica todos silenciosamente
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-gray-300 font-sans flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newStatusAlsoPersonal}
                              onChange={(e) => setNewStatusAlsoPersonal(e.target.checked)}
                              className="rounded bg-[#121622] border-gray-500 text-[#39ff14] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>Também postar no Status Pessoal (status@broadcast)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview Box Styled as WhatsApp Story */}
                  <div
                    className="p-5 rounded-2xl flex flex-col justify-between text-center shadow-lg transition min-h-[140px] relative overflow-hidden"
                    style={{ backgroundColor: newStatusColor }}
                  >
                    {/* Story Header */}
                    <div className="flex items-center justify-between text-[11px] text-white/90 pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                          {newStatusTargetGroups.length > 0 ? '👥' : '👤'}
                        </div>
                        <span className="font-bold">
                          {newStatusTargetGroups.length > 0 ? 'Story do Grupo' : 'Meu Status'}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/70">Agora</span>
                    </div>

                    {/* Story Content */}
                    <p className="text-sm font-bold text-white font-sans py-4 max-w-sm mx-auto">
                      {newStatusText || (newStatusImageBase64 ? '🖼️ [Imagem Carregada]' : 'Visualização do Story...')}
                    </p>

                    {/* Bottom bar if group story */}
                    {newStatusTargetGroups.length > 0 && (
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/80">
                        <span className="px-2 py-0.5 rounded-full bg-black/30">Responder ao grupo...</span>
                        <span>❤️</span>
                      </div>
                    )}
                  </div>

                  {statusFeedback && (
                    <div className="p-3.5 rounded-2xl text-xs font-sans bg-black/40 border border-white/10 text-white">
                      {statusFeedback}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={postingStatus || (!newStatusText.trim() && !newStatusImageBase64 && !newStatusImageUrl)}
                    className="w-full py-3 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(57,255,20,0.3)] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {postingStatus
                        ? 'Publicando Story...'
                        : newStatusTargetGroups.length > 0
                        ? `🚀 Publicar Story nos ${newStatusTargetGroups.length} Grupo(s)`
                        : '🚀 Publicar Status Pessoal'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 6: GRUPOS */}
          {activeTab === 'groups' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
              {/* Left Column: Groups List */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Filtrar grupos..."
                    className="w-full bg-[#181d29] border border-[#2a3346] text-white pl-9 pr-3 py-2 rounded-xl text-xs placeholder:text-gray-500 focus:outline-none focus:border-[#39ff14]"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                </div>

                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {groups
                    .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()) || g.jid.includes(groupSearch))
                    .map((g) => (
                      <div
                        key={g.jid}
                        onClick={() => setSelectedGroup(g)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                          selectedGroup?.jid === g.jid
                            ? 'bg-[#1e2738] border-[#39ff14]/50 shadow-[0_0_15px_rgba(57,255,20,0.1)]'
                            : 'bg-[#141924] border-[#242e42] hover:bg-[#1a2130]'
                        }`}
                      >
                        <Users className="w-5 h-5 text-[#39ff14] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-white truncate font-sans">{g.name}</h5>
                          <span className="text-[10px] text-gray-400 font-mono block truncate">
                            {g.participantCount} membros
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Column: Selected Group Details */}
              <div className="md:col-span-2 space-y-4">
                {selectedGroup ? (
                  <div className="bg-[#141924] border border-[#242e42] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div>
                        <h4 className="text-base font-bold text-white font-sans">{selectedGroup.name}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedGroup.jid}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedGroup.jid, 'group_jid')}
                        className="px-3 py-1.5 bg-[#1e2738] border border-[#2b374e] rounded-xl text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5"
                      >
                        {copiedKey === 'group_jid' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copiar JID</span>
                      </button>
                    </div>

                    {/* Barra de Ações Rápidas de Download & Exportação */}
                    <div className="p-3 bg-[#181f2f] border border-[#2a374f] rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-[#39ff14]" />
                          Exportar Contatos ({selectedGroupParticipants.length || selectedGroup.participantCount || 0})
                          {loadingGroupParticipants && (
                            <RefreshCw className="w-3 h-3 text-[#39ff14] animate-spin ml-1" />
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDevExportModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-[#1f293d] border border-[#354668] text-[10px] font-mono text-[#39ff14] hover:text-white flex items-center gap-1 transition"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Personalizar...</span>
                        </button>
                      </div>

                      {devExportFeedback && (
                        <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono animate-fadeIn">
                          {devExportFeedback}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDevQuickDownloadVcf}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                          title="Baixar arquivo .VCF para celular"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Baixar VCF (Celular)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDevQuickDownloadWhaticket}
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                          title="Baixar arquivo .CSV para Whaticket"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Baixar CSV (Whaticket)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDevQuickDownloadTxt}
                          className="px-2.5 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1f2738] border border-[#2b374e] text-gray-300 text-xs font-mono flex items-center gap-1.5 transition active:scale-95"
                          title="Baixar lista de números em TXT"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#39ff14]" />
                          <span>TXT</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowDevGroupStatusModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                          title="Postar Status / Story nativo do WhatsApp diretamente neste grupo"
                        >
                          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                          <span>Postar Status</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDevCopyPhones}
                          className="px-2.5 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1f2738] border border-[#2b374e] text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition active:scale-95"
                          title="Copiar lista de telefones"
                        >
                          {copiedKey === 'group_phones' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{copiedKey === 'group_phones' ? 'Copiados!' : 'Copiar Telefones'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-sans">
                        Membros ({selectedGroupParticipants.length || selectedGroup.participantCount || 0}):
                      </span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                      {(selectedGroupParticipants.length > 0 ? selectedGroupParticipants : (selectedGroup.metadata?.participants || [])).map((p: any, idx: number) => {
                        const num = extractCleanDigits(p);
                        return (
                          <div key={p.id || idx} className="p-2.5 bg-[#181f2f] rounded-xl border border-[#2a3346] flex items-center justify-between">
                            <span className="text-xs font-mono text-white">+{num || p.id?.split('@')[0]}</span>
                            {p.admin && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-full text-[10px] font-bold">
                                {p.admin}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-xs">
                    Selecione um grupo ao lado para inspecionar os detalhes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: GERADOR & PIX */}
          {activeTab === 'generator' && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-2xl flex items-center gap-3">
                <Code2 className="w-5 h-5 text-cyan-400 shrink-0" />
                <p className="text-xs text-cyan-300 font-sans">
                  Exemplos nativos de protocolo com <strong>zapo-js</strong>: Botões Rápidos, PIX Copia e Cola Nativo, Formulários A2UI e Catálogo!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PIX Copy Example */}
                <div className="p-4 bg-[#141924] border border-[#242e42] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">💳</span>
                    <h5 className="text-sm font-bold text-white font-sans">PIX Copia e Cola Nativo</h5>
                  </div>
                  <p className="text-xs text-gray-400 font-sans">
                    Envia botão nativo <code>cta_copy</code> que copia a chave Pix instantaneamente para a área de transferência do cliente.
                  </p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify({
                      interactiveMessage: {
                        body: { text: "Pagamento via PIX" },
                        nativeFlowMessage: {
                          buttons: [{ name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "Copiar Chave PIX", copy_code: "CHAVE_AQUI" }) }]
                        }
                      }
                    }, null, 2), 'code_pix')}
                    className="w-full py-2 bg-[#1e2738] border border-[#2b374e] rounded-xl text-xs font-mono text-cyan-300 hover:text-white flex items-center justify-center gap-2"
                  >
                    {copiedKey === 'code_pix' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Payload PIX</span>
                  </button>
                </div>

                {/* A2UI Form Example */}
                <div className="p-4 bg-[#141924] border border-[#242e42] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">📝</span>
                    <h5 className="text-sm font-bold text-white font-sans">Formulário A2UI Nativo</h5>
                  </div>
                  <p className="text-xs text-gray-400 font-sans">
                    Abre formulário interativo de pesquisa de satisfação ou captura de lead diretamente no WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify({
                      interactiveMessage: {
                        body: { text: "Pesquisa de Satisfação" },
                        nativeFlowMessage: {
                          buttons: [{ name: "form_message", buttonParamsJson: JSON.stringify({ title: "Responder", pages: [] }) }]
                        }
                      }
                    }, null, 2), 'code_form')}
                    className="w-full py-2 bg-[#1e2738] border border-[#2b374e] rounded-xl text-xs font-mono text-cyan-300 hover:text-white flex items-center justify-center gap-2"
                  >
                    {copiedKey === 'code_form' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Payload Form A2UI</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: Community Features & Reverse Engineering (Jobas Fernandes) */}
          {activeTab === 'community' && (
            <div className="space-y-6 animate-fadeIn pb-8">
              {/* Card Principal: Repositório Oficial ZapTroll (Nosso Repositório) */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-[#0b1f14] via-[#101b26] to-[#121622] border-2 border-[#39ff14]/30 shadow-[0_0_35px_rgba(57,255,20,0.12)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#39ff14]/10 border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14] text-2xl shadow-[0_0_20px_rgba(57,255,20,0.25)] shrink-0">
                      🚀
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#39ff14]/20 text-[#39ff14] font-bold border border-[#39ff14]/40">
                          Repositório Oficial
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          Yran-Olv / zaptroll
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                          v1.2.0 Open Source
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-white font-sans mt-0.5 flex items-center gap-2">
                        <span>ZapTroll — WhatsApp Developer Platform & RPG Arena</span>
                      </h4>
                    </div>
                  </div>

                  <a
                    href="https://github.com/Yran-Olv/zaptroll.git"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#39ff14] to-emerald-400 hover:from-[#32e011] hover:to-emerald-300 text-black font-black text-xs transition shadow-[0_0_20px_rgba(57,255,20,0.3)] shrink-0"
                  >
                    <span>Repositório GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5 text-black" />
                  </a>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed font-sans">
                  Plataforma completa de conexões WhatsApp, gerenciamento de instâncias, automações avançadas de protocolo, download permanente de mídias de visualização única e RPG de luta política interativo.
                </p>
              </div>

              {/* Créditos Compactos & Engenharia Reversa */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 font-bold border border-amber-400/30">
                      Créditos & Bibliotecas
                    </span>
                    <span className="text-xs text-gray-400 font-sans">
                      Tecnologias e implementações de ponta integradas ao projeto:
                    </span>
                  </div>

                  <a
                    href="https://github.com/jobasfernandes/zapo-interactive-examples"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 underline shrink-0 font-medium"
                  >
                    <span>zapo-interactive-examples (Jobas Fernandes)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="text-[11px] text-gray-400 leading-relaxed font-sans flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>• <strong className="text-gray-300">zapo-js 1.10+</strong> (Engine WhatsApp)</span>
                  <span>• <strong className="text-gray-300">zapo-interactive-examples</strong> por Jobas Fernandes (Exemplos de Banners Meta, Meta AI nativo, Status e Enquetes)</span>
                  <span>• <strong className="text-gray-300">Stack:</strong> React, Express, PostgreSQL, Docker, Socket.IO</span>
                </div>

                {/* Feature Tags Compactas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Banner Meta</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">Transição de atores para aviso nativo.</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Meta AI (/ai)</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">Selo oficial "IA" nativo e streaming.</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Status de Grupo</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">groupStatusMessageV2 no grupo.</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                      <Vote className="w-3.5 h-3.5" />
                      <span>Enquetes (/poll)</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">Votação nativa nos chats e grupos.</p>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs selector */}
              <div className="flex items-center gap-2 p-1.5 bg-[#121622] border border-[#232b3e] rounded-2xl overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCommunitySubTab('ai')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    communitySubTab === 'ai'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Meta AI (/ai)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommunitySubTab('banner')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    communitySubTab === 'banner'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Banner Meta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommunitySubTab('group_status')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    communitySubTab === 'group_status'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Status no Grupo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommunitySubTab('poll')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    communitySubTab === 'poll'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>Enquetes (/poll)</span>
                </button>
              </div>

              {/* SUBTAB 1: Meta AI (/ai) */}
              {communitySubTab === 'ai' && (
                <div className="space-y-4">
                  {/* WhatsApp native preview badge mockup */}
                  <div className="p-4 rounded-2xl bg-[#081f1b] border border-[#00a884]/40 flex items-start gap-3">
                    <span className="text-xl">🤖</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#00e676]">Selo Nativo WhatsApp "IA" (biz_bot: '1')</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-gray-300 font-mono">Chats Privados</span>
                      </div>
                      <p className="text-xs text-gray-300">
                        Quando você ou um usuário digita <code className="text-[#00e676]">/ai [pergunta]</code> (ou manda uma foto com legenda <code className="text-[#00e676]">/ai</code>), o Zaptroll dispara o placeholder <em>"Thinking…"</em> com o selo nativo de inteligência artificial da Meta, consulta o modelo oficial e edita automaticamente para a resposta com formatação de código e tabelas.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-[#121622] border border-[#232b3e] rounded-2xl space-y-4">
                    <h5 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span>Testar Meta AI (/ai) Direto pelo Painel</span>
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          JID do Destinatário (ex: 553499198782@s.whatsapp.net):
                        </label>
                        <input
                          type="text"
                          value={aiJid}
                          onChange={(e) => setAiJid(e.target.value)}
                          placeholder="553499198782@s.whatsapp.net"
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          Persona / Prompt de Sistema (opcional):
                        </label>
                        <input
                          type="text"
                          value={aiSystemPrompt}
                          onChange={(e) => setAiSystemPrompt(e.target.value)}
                          placeholder="Você é o assistente inteligente..."
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                        Pergunta para o Meta AI:
                      </label>
                      <textarea
                        rows={3}
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        placeholder="Ex: Crie uma tabela comparativa de planos de internet ou explique uma função em TypeScript..."
                        className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white transition">
                        <span className="p-1.5 bg-[#1e2738] rounded-lg border border-[#2b374e]">📷</span>
                        <span>{aiImageBase64 ? 'Foto anexada para análise' : 'Anexar imagem (opcional)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setAiImageBase64(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {aiImageBase64 && (
                        <button
                          type="button"
                          onClick={() => setAiImageBase64(null)}
                          className="text-[11px] text-red-400 hover:text-red-300 underline"
                        >
                          Remover foto
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleAskAi}
                        disabled={aiSending}
                        className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg"
                      >
                        {aiSending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Consultando Meta AI (Thinking...)</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Perguntar ao Meta AI</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiFeedback && (
                      <div className="p-3 bg-[#181d29] border border-[#2a3346] rounded-xl text-xs text-gray-200">
                        {aiFeedback}
                      </div>
                    )}

                    {aiResult && (
                      <div className="p-4 bg-[#0a0e17] border border-cyan-500/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs text-cyan-400 font-mono font-bold">
                          <span>RESPOSTA FORMATADA DO META AI:</span>
                          <span className="text-[10px] text-gray-400">
                            {aiResult.chunks ? `${aiResult.chunks} chunks recebidos` : ''}
                          </span>
                        </div>
                        <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono p-3 bg-black/50 rounded-lg overflow-x-auto border border-white/5">
                          {aiResult.answerText || aiResult.text || JSON.stringify(aiResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: Banner "Meta hospedou este chat" */}
              {communitySubTab === 'banner' && (
                <div className="space-y-4">
                  {/* WhatsApp native preview banner */}
                  <div className="p-4 rounded-2xl bg-[#0b141a] border border-[#1f2c34] space-y-3">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">
                      Aparência nativa no WhatsApp do destinatário:
                    </span>
                    <div className="p-3 rounded-xl bg-[#182229] border border-[#2a3942] text-center space-y-2 max-w-lg mx-auto shadow-inner">
                      <p className="text-xs text-[#53bdeb] leading-relaxed font-sans">
                        Esta empresa agora usa um serviço seguro da Meta para gerenciar esta conversa. Toque para saber mais.
                      </p>
                      <p className="text-[11px] text-gray-400 leading-normal font-sans">
                        A IA da Meta recebe as mensagens da conversa para gerar mensagens para esta empresa e pode usá-las para melhorar a qualidade da IA. <span className="text-[#53bdeb] underline cursor-pointer">Saiba mais</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-[#121622] border border-[#232b3e] rounded-2xl space-y-4">
                    <h5 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>Ativar Banner "Meta Hospedou este Chat"</span>
                    </h5>
                    <p className="text-xs text-gray-300 font-sans">
                      O WhatsApp armazena o status de privacidade por empresa. Para forçar a exibição do banner na tela do destinatário, a engenharia reversa do <strong>zapo-interactive-examples</strong> realiza a transição de atores (de <code>actual_actors="1"</code> para <code>actual_actors="2"</code> com <code>host_storage="2"</code>).
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          JID Privado do Destinatário (@s.whatsapp.net ou @lid):
                        </label>
                        <input
                          type="text"
                          value={bannerJid}
                          onChange={(e) => setBannerJid(e.target.value)}
                          placeholder="553499198782@s.whatsapp.net"
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          Mensagem de Confirmação com Carimbo da Meta:
                        </label>
                        <input
                          type="text"
                          value={bannerText}
                          onChange={(e) => setBannerText(e.target.value)}
                          placeholder="Esta empresa agora usa um serviço seguro da Meta..."
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-gray-400">
                          ⚠️ Válido para chats privados (o WhatsApp ignora nós biz em grupos).
                        </span>
                        <button
                          type="button"
                          onClick={handleSendBanner}
                          disabled={sendingBanner}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs flex items-center gap-2 transition shadow-lg"
                        >
                          {sendingBanner ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              <span>Aplicando Transição de Banner...</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="w-4 h-4 text-black" />
                              <span>Ativar Banner Meta</span>
                            </>
                          )}
                        </button>
                      </div>

                      {bannerFeedback && (
                        <div className="p-3 bg-[#181d29] border border-[#2a3346] rounded-xl text-xs text-gray-200">
                          {bannerFeedback}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: Status em Grupos (groupStatusMessageV2) */}
              {communitySubTab === 'group_status' && (
                <div className="space-y-4">
                  {/* WhatsApp native group story preview */}
                  <div className="p-4 rounded-2xl bg-[#0b141a] border border-[#1f2c34] flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-2 border-[#25D366] p-0.5 shadow-[0_0_15px_rgba(37,211,102,0.4)]">
                        <div className="w-full h-full rounded-full bg-[#1f2c34] flex items-center justify-center text-lg">
                          👥
                        </div>
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-[#25D366] text-black font-bold px-1 rounded-full">
                        Status
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Anel Verde no Avatar do Grupo</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 font-mono">
                          "Ver status"
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">
                        O WhatsApp agora permite postar stories exclusivos de grupo. No protocolo isso utiliza <code className="text-[#25D366]">groupStatusMessageV2</code> com o nó <code className="text-[#25D366]">&lt;meta is_group_status="true"/&gt;</code>.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-[#121622] border border-[#232b3e] rounded-2xl space-y-4">
                    <h5 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span>Publicar Status no Grupo (groupStatusMessageV2)</span>
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          Selecionar Grupo (@g.us):
                        </label>
                        <select
                          value={groupStatusJid}
                          onChange={(e) => setGroupStatusJid(e.target.value)}
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-sans"
                        >
                          <option value="">Selecione um grupo...</option>
                          {groups.map((g) => (
                            <option key={g.jid} value={g.jid}>
                              {g.name || g.jid} ({g.participantCount || 0} membros)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          URL da Imagem Vertical (1080x1920 recomendado):
                        </label>
                        <input
                          type="text"
                          value={groupStatusImageUrl}
                          onChange={(e) => setGroupStatusImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                        Legenda do Status do Grupo:
                      </label>
                      <textarea
                        rows={2}
                        value={groupStatusCaption}
                        onChange={(e) => setGroupStatusCaption(e.target.value)}
                        placeholder="Ex: Comunicado importante aos membros do grupo..."
                        className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-400 font-sans"
                      />
                    </div>
                    <div className="pt-2 border-t border-[#232b3e] flex items-center justify-between">
                      <label className="text-[11px] text-purple-300 font-mono font-bold flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={groupStatusMentionAll}
                          onChange={(e) => setGroupStatusMentionAll(e.target.checked)}
                          className="rounded bg-[#121622] border-purple-500 text-purple-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>👻 Marcar Geral no Grupo (Menção Fantasma no Status)</span>
                      </label>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Notifica todos silenciosamente
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white transition">
                        <span className="p-1.5 bg-[#1e2738] rounded-lg border border-[#2b374e]">🖼️</span>
                        <span>{groupStatusImageBase64 ? 'Imagem personalizada carregada' : 'Fazer upload de imagem'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setGroupStatusImageBase64(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {groupStatusImageBase64 && (
                        <button
                          type="button"
                          onClick={() => setGroupStatusImageBase64(null)}
                          className="text-[11px] text-red-400 hover:text-red-300 underline"
                        >
                          Usar URL padrão
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSendGroupStatus}
                        disabled={sendingGroupStatus}
                        className="ml-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg"
                      >
                        {sendingGroupStatus ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Fazendo upload e postando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Publicar Status no Grupo</span>
                          </>
                        )}
                      </button>
                    </div>

                    {groupStatusFeedback && (
                      <div className="p-3 bg-[#181d29] border border-[#2a3346] rounded-xl text-xs text-gray-200">
                        {groupStatusFeedback}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBTAB 4: Enquetes Nativas (/poll) */}
              {communitySubTab === 'poll' && (
                <div className="space-y-4">
                  <div className="p-5 bg-[#121622] border border-[#232b3e] rounded-2xl space-y-4">
                    <h5 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      <Vote className="w-4 h-4 text-purple-400" />
                      <span>Criar Enquete Nativa WhatsApp (/poll)</span>
                    </h5>
                    <p className="text-xs text-gray-300 font-sans">
                      Dispara uma enquete interativa diretamente pelo protocolo WhatsApp. Os votos podem ser monitorados e processados como comandos automatizados.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          Chat de Destino (Grupo ou Privado):
                        </label>
                        <input
                          type="text"
                          value={pollJid}
                          onChange={(e) => setPollJid(e.target.value)}
                          placeholder="JID do grupo (@g.us) ou privado (@s.whatsapp.net)"
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                          Quantidade de Opções Selecionáveis:
                        </label>
                        <select
                          value={pollSelectableCount}
                          onChange={(e) => setPollSelectableCount(Number(e.target.value))}
                          className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 font-sans"
                        >
                          <option value={1}>Voto Único (Apenas 1 opção)</option>
                          <option value={0}>Múltipla Escolha (Várias opções)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 font-sans">
                        Pergunta da Enquete:
                      </label>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="Ex: Qual o melhor horário para a reunião?"
                        className="w-full bg-[#181d29] border border-[#2a3346] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 font-sans"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-400 font-sans">
                          Opções da Enquete ({pollOptions.length}):
                        </label>
                        <button
                          type="button"
                          onClick={() => setPollOptions([...pollOptions, `Opção ${pollOptions.length + 1}`])}
                          className="text-xs text-purple-400 hover:text-purple-300 font-bold"
                        >
                          + Adicionar Opção
                        </button>
                      </div>

                      <div className="space-y-2">
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-6 text-center text-xs font-mono text-gray-500">{idx + 1}.</span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...pollOptions];
                                newOpts[idx] = e.target.value;
                                setPollOptions(newOpts);
                              }}
                              className="flex-1 bg-[#181d29] border border-[#2a3346] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-sans"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg"
                                title="Remover opção"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSendPoll}
                        disabled={sendingPoll}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg"
                      >
                        {sendingPoll ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Enviando Enquete...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Enviar Enquete Nativa</span>
                          </>
                        )}
                      </button>
                    </div>

                    {pollFeedback && (
                      <div className="p-3 bg-[#181d29] border border-[#2a3346] rounded-xl text-xs text-gray-200">
                        {pollFeedback}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Exportação Avançada para DevTools */}
      {selectedGroup && (
        <ExportContactsModal
          isOpen={showDevExportModal}
          onClose={() => setShowDevExportModal(false)}
          groupName={selectedGroup.name}
          participants={selectedGroupParticipants}
          groupMetadata={selectedGroup.metadata}
        />
      )}

      {/* Modal de Postar Status no Grupo Selecionado */}
      {selectedGroup && (
        <PostGroupStatusModal
          isOpen={showDevGroupStatusModal}
          onClose={() => setShowDevGroupStatusModal(false)}
          connectionId={selectedConnId}
          groupJid={selectedGroup.jid}
          groupName={selectedGroup.name}
          groupPicUrl={selectedGroup.pictureUrl}
        />
      )}
    </div>
  );
};
