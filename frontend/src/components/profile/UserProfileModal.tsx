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
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  conversation,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

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

  const handleCopyPhone = () => {
    const textToCopy = profile?.phoneNumber || profile?.phoneJid?.split('@')[0] || conversation.jid;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPhoto = async () => {
    if (!profile?.profilePicUrl) return;

    setDownloading(true);
    try {
      const token = localStorage.getItem('zaptroll_token') || '';
      const downloadUrl = `/api/contacts/download-picture?connectionId=${encodeURIComponent(
        connectionId
      )}&jid=${encodeURIComponent(conversation.jid)}&token=${encodeURIComponent(token)}`;

      // Cria um link temporário para iniciar o download do arquivo de imagem
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

  const displayName = profile?.name || conversation.name || conversation.jid;
  const displayPhone = profile?.phoneNumber || (conversation.jid.endsWith('@s.whatsapp.net') ? conversation.jid.split('@')[0] : null);
  const photoUrl = profile?.profilePicUrl || conversation.profilePicUrl || null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div
          className="relative w-full max-w-md bg-[#131722] border border-[#2a3346] rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3346] bg-[#161b26]">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#39ff14]" />
              <h3 className="text-sm font-bold text-white tracking-wide font-sans">
                Dados do Contato
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchProfile}
                disabled={loading}
                className="p-1.5 text-gray-400 hover:text-[#39ff14] hover:bg-[#1f2533] rounded-full transition"
                title="Recarregar Perfil"
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
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Foto de Perfil Grande */}
            <div className="flex flex-col items-center text-center">
              <div className="relative group mb-4">
                {photoUrl ? (
                  <div
                    onClick={() => setShowLightbox(true)}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-full p-1 border-2 border-[#39ff14]/70 shadow-[0_0_25px_rgba(57,255,20,0.25)] relative cursor-pointer overflow-hidden transition-transform duration-300 group-hover:scale-105"
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
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full p-1 border-2 border-[#2a3346] flex items-center justify-center bg-[#1a202c]">
                    <MemeAvatar
                      seed={conversation.jid}
                      name={conversation.name}
                      size="xl"
                      glow={false}
                    />
                  </div>
                )}

                {/* Badge indicador WhatsApp */}
                <div className="absolute bottom-2 right-2 bg-[#10b981] p-1.5 rounded-full border-2 border-[#131722] shadow-[0_0_10px_#10b981]">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              {/* Nome */}
              <h2 className="text-xl font-bold text-white font-sans tracking-tight">
                {displayName}
              </h2>

              {/* Número de Telefone */}
              {displayPhone && (
                <p className="text-sm font-mono text-gray-400 mt-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#39ff14]" />
                  <span>{displayPhone}</span>
                </p>
              )}

              {/* Botão de Download da Foto Real */}
              {photoUrl && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={handleDownloadPhoto}
                    disabled={downloading}
                    className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-xs rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
                    <span>{downloading ? 'Baixando Foto...' : 'Baixar Foto Real (HD)'}</span>
                  </button>
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="px-3 py-2 bg-[#1e2535] hover:bg-[#2a3346] text-gray-300 hover:text-white font-semibold text-xs rounded-xl border border-[#2a3346] flex items-center gap-1.5 transition cursor-pointer"
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
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Recado / Status do WhatsApp
              </span>
              <p className="text-xs text-gray-200 font-sans italic leading-relaxed">
                {profile?.about || 'Nenhum recado disponível ou perfil privado.'}
              </p>
            </div>

            {/* Informações Técnicas e Identificador */}
            <div className="bg-[#181d29] border border-[#2a3346] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Identificador JID:</span>
                <span className="font-mono text-gray-300 truncate max-w-[200px]" title={conversation.jid}>
                  {conversation.jid}
                </span>
              </div>

              {profile?.lid && profile.lid !== conversation.jid && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">WhatsApp LID:</span>
                  <span className="font-mono text-gray-300 truncate max-w-[200px]" title={profile.lid}>
                    {profile.lid}
                  </span>
                </div>
              )}

              {profile?.phoneJid && profile.phoneJid !== conversation.jid && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">JID Número:</span>
                  <span className="font-mono text-gray-300 truncate max-w-[200px]" title={profile.phoneJid}>
                    {profile.phoneJid}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2a3346]/60">
                <span className="text-gray-400 font-medium">Tipo de Chat:</span>
                <span className="font-mono text-[#39ff14] capitalize">
                  {conversation.chatType === 'group' ? 'Grupo' : 'Chat Individual'}
                </span>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopyPhone}
                className="flex-1 py-2.5 px-3 bg-[#1e2535] hover:bg-[#252f44] text-white border border-[#2a3346] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#39ff14]" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                <span>{copied ? 'Copiado!' : 'Copiar Número/JID'}</span>
              </button>

              <button
                onClick={onClose}
                className="py-2.5 px-4 bg-[#39ff14]/15 hover:bg-[#39ff14]/25 text-[#39ff14] border border-[#39ff14]/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Conversar</span>
              </button>
            </div>
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
