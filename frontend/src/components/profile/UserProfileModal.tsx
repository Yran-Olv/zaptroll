import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Phone,
  User as UserIcon,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  RefreshCw,
  Info,
  ShieldCheck,
  MessageCircle,
  Terminal,
  Users,
  Code2,
  Share2,
  Hash,
  Shield,
  Search,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import api from '../../services/api.js';
import { ContactProfile, Conversation } from '../../types/index.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  conversation: Conversation;
  onProfileUpdated?: (profile: ContactProfile) => void;
  onOpenDevTools?: (initialQuery?: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  conversation,
  onProfileUpdated,
  onOpenDevTools,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'devtools'>('profile');
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [participantSearch, setParticipantSearch] = useState<string>('');

  useEffect(() => {
    if (isOpen && conversation?.jid) {
      fetchProfile();
    }
  }, [isOpen, conversation?.jid, connectionId]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/contacts/profile', {
        params: {
          connectionId,
          jid: conversation.jid,
          conversationId: conversation.id,
        },
      });

      if (response.data) {
        setProfile(response.data);
        if (onProfileUpdated) {
          onProfileUpdated(response.data);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar perfil:', err);
      setError('Não foi possível carregar os dados mais recentes do perfil.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadPhoto = async () => {
    if (!profile?.profilePicUrl) return;

    setDownloading(true);
    try {
      const token = localStorage.getItem('zaptroll_token') || '';
      const downloadUrl = `/api/contacts/download-picture?connectionId=${encodeURIComponent(
        connectionId
      )}&jid=${encodeURIComponent(conversation.jid)}&token=${encodeURIComponent(token)}`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `perfil_${(profile.name || conversation.name || 'foto').replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Erro no download:', err);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  if (!isOpen) return null;

  const isGroup = conversation.chatType === 'group' || conversation.jid.endsWith('@g.us');
  const displayName = profile?.name || conversation.name || conversation.jid;
  const displayPhone = profile?.phoneNumber || (conversation.jid.endsWith('@s.whatsapp.net') ? conversation.jid.split('@')[0] : null);
  const photoUrl = profile?.profilePicUrl || conversation.profilePicUrl || null;
  const rawGroupId = isGroup ? conversation.jid.split('@')[0] : null;
  const cleanNumber = profile?.cleanNumber || (!isGroup ? conversation.jid.split('@')[0].replace(/\D/g, '') : null);
  const waMeLink = profile?.waMeLink || (cleanNumber ? `https://wa.me/${cleanNumber}` : null);

  // Participants list for groups
  const participants = profile?.groupDetails?.participants || [];
  const filteredParticipants = participants.filter((p) => {
    if (!participantSearch) return true;
    const term = participantSearch.toLowerCase();
    return (
      (p.id && p.id.toLowerCase().includes(term)) ||
      (p.lid && p.lid.toLowerCase().includes(term)) ||
      (p.phoneNumber && p.phoneNumber.toLowerCase().includes(term)) ||
      (p.cleanNumber && p.cleanNumber.includes(term))
    );
  });

  const handleCopyAllJids = () => {
    if (participants.length === 0) return;
    const jids = participants.map((p) => p.id).join('\n');
    copyToClipboard(jids, 'all_jids');
  };

  const handleCopyAllLids = () => {
    const lids = participants.map((p) => p.lid).filter(Boolean).join('\n');
    if (!lids) return;
    copyToClipboard(lids, 'all_lids');
  };

  const handleCopyAllPhones = () => {
    const phones = participants
      .map((p) => p.cleanNumber || p.id.split('@')[0].split(':')[0].replace(/\D/g, ''))
      .filter((n) => n.length >= 8)
      .join('\n');
    if (!phones) return;
    copyToClipboard(phones, 'all_phones');
  };

  const handleCopyJson = () => {
    const dataToExport = {
      conversationId: conversation.id,
      connectionId,
      name: displayName,
      jid: conversation.jid,
      chatType: conversation.chatType,
      profile,
    };
    copyToClipboard(JSON.stringify(dataToExport, null, 2), 'json_dev');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div
          className={`relative w-full ${
            activeTab === 'devtools' ? 'max-w-2xl' : 'max-w-md'
          } bg-[#131722] border border-[#2a3346] rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header com Navegação em Abas */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a3346] bg-[#161b26]">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0f1219] rounded-2xl border border-[#232b3b]">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-[#1e2535] text-[#39ff14] shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Perfil & Foto</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('devtools')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'devtools'
                    ? 'bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/30 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-[#39ff14]" />
                <span>Dev Tools</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-[#39ff14]/20 text-[#39ff14] font-mono">
                  PRO
                </span>
              </button>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchProfile}
                disabled={loading}
                className="p-1.5 text-gray-400 hover:text-[#39ff14] hover:bg-[#1f2533] rounded-full transition"
                title="Recarregar Perfil / Metadados"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#39ff14]' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: PERFIL & FOTO */}
            {activeTab === 'profile' && (
              <>
                {/* Foto de Perfil Grande */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative group mb-3">
                    {photoUrl ? (
                      <div
                        onClick={() => setShowLightbox(true)}
                        className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1 border-2 border-[#39ff14]/70 shadow-[0_0_25px_rgba(57,255,20,0.25)] relative cursor-pointer overflow-hidden transition-transform duration-300 group-hover:scale-105"
                        title="Clique para ver foto inteira"
                      >
                        <img
                          src={photoUrl}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover bg-[#1a202c]"
                        />
                        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-1.5 text-white text-xs font-semibold backdrop-blur-xs">
                          <Maximize2 className="w-5 h-5 text-[#39ff14]" />
                          <span>Ampliar</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1 border-2 border-[#2a3346] flex items-center justify-center bg-[#1a202c]">
                        <MemeAvatar
                          seed={conversation.jid}
                          name={conversation.name}
                          size="xl"
                          glow={false}
                        />
                      </div>
                    )}

                    {/* Badge indicador */}
                    <div className="absolute bottom-1 right-1 bg-[#10b981] p-1.5 rounded-full border-2 border-[#131722] shadow-[0_0_10px_#10b981]">
                      {isGroup ? <Users className="w-3.5 h-3.5 text-white" /> : <ShieldCheck className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>

                  {/* Nome */}
                  <h2 className="text-xl font-bold text-white font-sans tracking-tight">
                    {displayName}
                  </h2>

                  {/* Número de Telefone ou Tipo */}
                  {displayPhone ? (
                    <p className="text-sm font-mono text-gray-400 mt-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#39ff14]" />
                      <span>{displayPhone}</span>
                    </p>
                  ) : isGroup ? (
                    <p className="text-xs font-mono text-[#39ff14] mt-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Grupo do WhatsApp • {profile?.groupDetails?.participantCount || 'Vários'} membros</span>
                    </p>
                  ) : null}

                  {/* Botões de Ação da Foto */}
                  {photoUrl && (
                    <div className="mt-3.5 flex items-center gap-2">
                      <button
                        onClick={handleDownloadPhoto}
                        disabled={downloading}
                        className="px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-xs rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
                        <span>{downloading ? 'Baixando Foto...' : 'Baixar Foto Real (HD)'}</span>
                      </button>
                      <button
                        onClick={() => setShowLightbox(true)}
                        className="px-3 py-1.5 bg-[#1e2535] hover:bg-[#2a3346] text-gray-300 hover:text-white font-semibold text-xs rounded-xl border border-[#2a3346] flex items-center gap-1.5 transition cursor-pointer"
                        title="Ver em tela cheia"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Visualizar</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Recado / Status do WhatsApp (About) */}
                <div className="bg-[#181d29] border border-[#2a3346] rounded-2xl p-3.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Recado / Status do WhatsApp
                  </span>
                  <p className="text-xs text-gray-200 font-sans italic leading-relaxed">
                    {profile?.about || (isGroup ? (profile?.groupDetails?.description || 'Sem descrição definida no grupo.') : 'Nenhum recado disponível ou perfil privado.')}
                  </p>
                </div>

                {/* Identificadores Rápidos (1-clique para copiar) */}
                <div className="bg-[#181d29] border border-[#2a3346] rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[#2a3346]/60">
                    <span className="text-[11px] font-bold text-[#39ff14] font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Identificadores Rápidos
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('devtools')}
                      className="text-[10px] text-[#39ff14] hover:underline font-mono flex items-center gap-1"
                    >
                      <span>Ver Mais Ferramentas</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* JID Principal */}
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-400 font-medium shrink-0">Identificador JID:</span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-gray-300 truncate max-w-[180px]" title={conversation.jid}>
                        {conversation.jid}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(conversation.jid, 'jid_quick')}
                        className="p-1 rounded bg-[#202738] hover:bg-[#2c364c] text-gray-300 hover:text-[#39ff14] transition shrink-0"
                        title="Copiar JID"
                      >
                        {copiedKey === 'jid_quick' ? <Check className="w-3 h-3 text-[#39ff14]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* ID do Grupo (Se for Grupo) */}
                  {isGroup && rawGroupId && (
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-400 font-medium shrink-0">ID Puro do Grupo:</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-amber-400 font-bold truncate max-w-[180px]" title={rawGroupId}>
                          {rawGroupId}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(rawGroupId, 'group_id_quick')}
                          className="p-1 rounded bg-[#202738] hover:bg-[#2c364c] text-gray-300 hover:text-amber-400 transition shrink-0"
                          title="Copiar ID Numérico do Grupo"
                        >
                          {copiedKey === 'group_id_quick' ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LID (Se existir) */}
                  {profile?.lid && profile.lid !== conversation.jid && (
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-400 font-medium shrink-0">WhatsApp LID:</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-cyan-400 truncate max-w-[180px]" title={profile.lid}>
                          {profile.lid}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(profile.lid!, 'lid_quick')}
                          className="p-1 rounded bg-[#202738] hover:bg-[#2c364c] text-gray-300 hover:text-cyan-400 transition shrink-0"
                          title="Copiar LID"
                        >
                          {copiedKey === 'lid_quick' ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Número Limpo (se individual) */}
                  {!isGroup && cleanNumber && (
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-400 font-medium shrink-0">Número Limpo (E.164):</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-emerald-400 font-bold truncate max-w-[180px]" title={cleanNumber}>
                          {cleanNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cleanNumber, 'clean_phone_quick')}
                          className="p-1 rounded bg-[#202738] hover:bg-[#2c364c] text-gray-300 hover:text-emerald-400 transition shrink-0"
                          title="Copiar Número Limpo"
                        >
                          {copiedKey === 'clean_phone_quick' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2a3346]/60">
                    <span className="text-gray-400 font-medium">Tipo de Chat:</span>
                    <span className="font-mono text-[#39ff14] capitalize font-bold">
                      {isGroup ? 'Grupo WhatsApp' : 'Chat Individual'}
                    </span>
                  </div>
                </div>

                {/* Ações Rápidas Inferiores */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCopyJson}
                    className="flex-1 py-2.5 px-3 bg-[#1e2535] hover:bg-[#252f44] text-white border border-[#2a3346] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedKey === 'json_dev' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Code2 className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{copiedKey === 'json_dev' ? 'JSON Copiado!' : 'Copiar JSON Dev'}</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="py-2.5 px-4 bg-[#39ff14]/15 hover:bg-[#39ff14]/25 text-[#39ff14] border border-[#39ff14]/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Conversar</span>
                  </button>
                </div>
              </>
            )}

            {/* TAB 2: DEV TOOLS (INSPETOR COMPLETO) */}
            {activeTab === 'devtools' && (
              <div className="space-y-4">
                {/* Banner de Identificação */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#181d29] to-[#121622] border border-[#39ff14]/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#39ff14]" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        {isGroup ? 'Inspetor de Metadados do Grupo' : 'Inspetor de Contato & Identificadores'}
                      </h4>
                    </div>
                    {onOpenDevTools && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDevTools(conversation.jid);
                        }}
                        className="text-[10px] font-mono text-[#39ff14] hover:underline flex items-center gap-1"
                      >
                        <span>Abrir na Central Dev</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Grid de Propriedades */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* JID */}
                    <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                      <div className="text-[10px] text-gray-400 font-mono">JID Completo:</div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-gray-200 truncate select-all">{conversation.jid}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(conversation.jid, 'dev_jid')}
                          className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-[#39ff14] shrink-0"
                          title="Copiar JID"
                        >
                          {copiedKey === 'dev_jid' ? <Check className="w-3 h-3 text-[#39ff14]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* ID do Grupo ou LID */}
                    {isGroup ? (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-amber-400 font-mono">ID Puro do Grupo (Sem @g.us):</div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-amber-400 font-bold truncate select-all">{rawGroupId}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(rawGroupId || '', 'dev_groupid')}
                            className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-amber-400 shrink-0"
                            title="Copiar ID Numérico"
                          >
                            {copiedKey === 'dev_groupid' ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-cyan-400 font-mono">WhatsApp LID:</div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-cyan-300 truncate select-all">{profile?.lid || 'Não mapeado'}</span>
                          {profile?.lid && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(profile.lid!, 'dev_lid')}
                              className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-cyan-400 shrink-0"
                              title="Copiar LID"
                            >
                              {copiedKey === 'dev_lid' ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dono / Criador do Grupo ou Número Limpo */}
                    {isGroup ? (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-purple-400 font-mono">Criador / Owner:</div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-gray-300 truncate select-all">
                            {profile?.groupDetails?.owner || 'Desconhecido'}
                          </span>
                          {profile?.groupDetails?.owner && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(profile.groupDetails!.owner!, 'dev_owner')}
                              className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-purple-400 shrink-0"
                              title="Copiar Criador"
                            >
                              {copiedKey === 'dev_owner' ? <Check className="w-3 h-3 text-purple-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-emerald-400 font-mono">Número Limpo (E.164):</div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-emerald-400 font-bold truncate select-all">
                            {cleanNumber || 'Desconhecido'}
                          </span>
                          {cleanNumber && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(cleanNumber, 'dev_clean_num')}
                              className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-emerald-400 shrink-0"
                              title="Copiar Número"
                            >
                              {copiedKey === 'dev_clean_num' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Data de Criação ou Link wa.me */}
                    {isGroup ? (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-gray-400 font-mono">Criado em:</div>
                        <div className="font-mono text-gray-300 truncate">
                          {profile?.groupDetails?.creationDate
                            ? new Date(profile.groupDetails.creationDate).toLocaleString('pt-BR')
                            : 'Data não informada'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#0d1017] border border-[#232b3b] space-y-1">
                        <div className="text-[10px] text-blue-400 font-mono">Link Direto WhatsApp:</div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-blue-300 truncate select-all">{waMeLink || 'N/A'}</span>
                          {waMeLink && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(waMeLink, 'dev_wame')}
                                className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-blue-400 shrink-0"
                                title="Copiar Link wa.me"
                              >
                                {copiedKey === 'dev_wame' ? <Check className="w-3 h-3 text-blue-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <a
                                href={waMeLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-[#1e2535] hover:bg-[#2b354c] text-gray-300 hover:text-blue-400 shrink-0"
                                title="Abrir no WhatsApp Web"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AÇÕES DE DESENVOLVEDOR EM LOTE (SE FOR GRUPO) */}
                {isGroup && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyAllJids}
                        className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#1a202c] hover:bg-[#242c3d] border border-[#2a3346] text-xs font-mono font-semibold text-white flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        {copiedKey === 'all_jids' ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5 text-[#39ff14]" />}
                        <span>{copiedKey === 'all_jids' ? 'JIDs Copiados!' : 'Copiar Todos os JIDs'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAllLids}
                        className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#1a202c] hover:bg-[#242c3d] border border-[#2a3346] text-xs font-mono font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        {copiedKey === 'all_lids' ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                        <span>{copiedKey === 'all_lids' ? 'LIDs Copiados!' : 'Copiar Todos os LIDs'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAllPhones}
                        className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#1a202c] hover:bg-[#242c3d] border border-[#2a3346] text-xs font-mono font-semibold text-emerald-300 flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        {copiedKey === 'all_phones' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{copiedKey === 'all_phones' ? 'Telefones Copiados!' : 'Copiar Telefones'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyJson}
                        className="px-3 py-2 rounded-xl bg-[#1a202c] hover:bg-[#242c3d] border border-[#2a3346] text-xs font-mono font-semibold text-purple-300 flex items-center justify-center gap-1.5 transition active:scale-95"
                        title="Exportar JSON do Grupo"
                      >
                        {copiedKey === 'json_dev' ? <Check className="w-3.5 h-3.5 text-purple-400" /> : <FileCode className="w-3.5 h-3.5 text-purple-400" />}
                        <span>JSON</span>
                      </button>
                    </div>

                    {/* Lista e Busca de Participantes */}
                    <div className="bg-[#181d29] border border-[#2a3346] rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#39ff14]" />
                          <h5 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                            Participantes do Grupo ({participants.length})
                          </h5>
                        </div>

                        {/* Campo de Filtro */}
                        <div className="relative w-44 sm:w-56">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Buscar JID, LID, tel..."
                            value={participantSearch}
                            onChange={(e) => setParticipantSearch(e.target.value)}
                            className="w-full bg-[#11141c] border border-[#232b3b] rounded-xl pl-8 pr-2.5 py-1 text-xs text-white placeholder-gray-500 font-mono focus:border-[#39ff14]/60 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Tabela de Membros */}
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {filteredParticipants.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-500 font-mono">
                            {participants.length === 0
                              ? 'Nenhum participante sincronizado no momento.'
                              : 'Nenhum membro encontrado com este filtro.'}
                          </div>
                        ) : (
                          filteredParticipants.map((p, idx) => (
                            <div
                              key={p.id || idx}
                              className="p-2 rounded-xl bg-[#11141c] hover:bg-[#151a24] border border-[#202738] flex items-center justify-between gap-2 text-xs transition"
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#1e2535] flex items-center justify-center font-mono text-[10px] text-gray-300 shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-mono text-gray-200 font-medium truncate">
                                      {p.phoneNumber || p.cleanNumber || p.id}
                                    </span>
                                    {p.admin && (
                                      <span
                                        className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                                          p.admin === 'superadmin'
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                            : 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                                        }`}
                                      >
                                        {p.admin}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono truncate">
                                    <span className="truncate" title={p.id}>
                                      JID: {p.id}
                                    </span>
                                    {p.lid && (
                                      <span className="text-cyan-400 truncate" title={p.lid}>
                                        LID: {p.lid}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(p.id, `p_jid_${idx}`)}
                                  className="px-2 py-1 rounded bg-[#1e2535] hover:bg-[#293348] text-gray-300 hover:text-[#39ff14] text-[10px] font-mono transition"
                                  title="Copiar JID"
                                >
                                  {copiedKey === `p_jid_${idx}` ? <Check className="w-3 h-3 text-[#39ff14]" /> : 'JID'}
                                </button>
                                {p.lid && (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(p.lid!, `p_lid_${idx}`)}
                                    className="px-2 py-1 rounded bg-[#1e2535] hover:bg-[#293348] text-gray-300 hover:text-cyan-400 text-[10px] font-mono transition"
                                    title="Copiar LID"
                                  >
                                    {copiedKey === `p_lid_${idx}` ? <Check className="w-3 h-3 text-cyan-400" /> : 'LID'}
                                  </button>
                                )}
                                {p.cleanNumber && (
                                  <a
                                    href={`https://wa.me/${p.cleanNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded bg-[#1e2535] hover:bg-[#293348] text-gray-300 hover:text-emerald-400 transition"
                                    title="Abrir no wa.me"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SNIPPET CURL PARA DESENVOLVEDOR */}
                <div className="p-3.5 rounded-2xl bg-[#0d1017] border border-[#232b3b] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-400 font-bold flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-[#39ff14]" />
                      Exemplo cURL (Disparo API Zaptroll)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = localStorage.getItem('zaptroll_token') || 'SEU_TOKEN_AQUI';
                        const curlCmd = `curl -X POST https://zaptroll.multivus.com.br/api/messages/send \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connectionId": "${connectionId}",
    "recipient": "${conversation.jid}",
    "message": "Mensagem de teste Zaptroll Dev"
  }'`;
                        copyToClipboard(curlCmd, 'curl_cmd');
                      }}
                      className="text-[11px] font-mono text-[#39ff14] hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'curl_cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'curl_cmd' ? 'Comando Copiado!' : 'Copiar cURL'}</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-gray-300 bg-[#090b10] p-2.5 rounded-xl overflow-x-auto border border-[#1b2230] leading-relaxed">
{`curl -X POST /api/messages/send \\
  -d '{"connectionId": "${connectionId}", "recipient": "${conversation.jid}", "message": "Olá!"}'`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom da Foto de Perfil */}
      {showLightbox && photoUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowLightbox(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPhoto();
              }}
              className="p-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-full shadow-lg transition flex items-center gap-1.5 text-xs font-bold px-4"
              title="Baixar Foto"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Foto (HD)</span>
            </button>
            <button
              onClick={() => setShowLightbox(false)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="max-w-2xl max-h-[80vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[75vh] rounded-3xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.9)] border-2 border-[#2a3346]"
            />
            <p className="text-gray-300 text-sm font-bold mt-4 font-sans tracking-wide">
              {displayName}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
