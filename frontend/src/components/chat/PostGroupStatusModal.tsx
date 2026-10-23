import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Radio,
  Image as ImageIcon,
  Video,
  Upload,
  Ghost,
  Check,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  FileVideo,
} from 'lucide-react';
import api from '../../services/api.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';

interface PostGroupStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  groupJid: string;
  groupName: string;
  groupPicUrl?: string | null;
  onSuccess?: () => void;
}

export const PostGroupStatusModal: React.FC<PostGroupStatusModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  groupJid,
  groupName,
  groupPicUrl,
  onSuccess,
}) => {
  const [caption, setCaption] = useState('');
  const [mentionAll, setMentionAll] = useState(true);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoFileSize, setVideoFileSize] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean object URL on unmount or URL change
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Reset feedback when opening
  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      if (file.size > 16 * 1024 * 1024) {
        setFeedback({
          type: 'error',
          message: `O vídeo selecionado tem ${(file.size / (1024 * 1024)).toFixed(1)}MB. O WhatsApp permite até 16MB no status.`,
        });
        return;
      }

      setMediaType('video');
      setVideoFileSize(file.size);
      setVideoUrl('');
      setImageBase64(null);
      setImageUrl('');

      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      const objUrl = URL.createObjectURL(file);
      setVideoPreviewUrl(objUrl);

      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = objUrl;
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration);
      };

      const reader = new FileReader();
      reader.onload = () => {
        setVideoBase64(reader.result as string);
        setFeedback(null);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        setFeedback({
          type: 'error',
          message: `A imagem selecionada tem ${(file.size / (1024 * 1024)).toFixed(1)}MB. O limite é de 10MB.`,
        });
        return;
      }

      setMediaType('image');
      setImageUrl('');
      setVideoBase64(null);
      setVideoUrl('');
      setVideoFileSize(null);
      setVideoDuration(null);
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
        setVideoPreviewUrl(null);
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImageBase64(reader.result as string);
        setFeedback(null);
      };
      reader.readAsDataURL(file);
    } else {
      setFeedback({
        type: 'error',
        message: 'Formato não suportado. Selecione uma foto (PNG, JPG, WEBP) ou vídeo (MP4, MOV, WEBM).',
      });
    }
  };

  const handleRemoveMedia = () => {
    setImageBase64(null);
    setImageUrl('');
    setVideoBase64(null);
    setVideoUrl('');
    setVideoFileSize(null);
    setVideoDuration(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionId || !groupJid) {
      setFeedback({ type: 'error', message: 'Conexão ou JID do grupo não encontrados.' });
      return;
    }

    const isSendingVideo = mediaType === 'video' && Boolean(videoBase64 || videoUrl);

    setSending(true);
    setFeedback(null);

    try {
      await api.post('/advanced/group-status', {
        connectionId,
        groupJid,
        caption: caption.trim(),
        type: isSendingVideo ? 'video' : 'image',
        imageUrl: !isSendingVideo ? (imageUrl.trim() || undefined) : undefined,
        imageBase64: !isSendingVideo ? (imageBase64 || undefined) : undefined,
        videoUrl: isSendingVideo ? (videoUrl.trim() || undefined) : undefined,
        videoBase64: isSendingVideo ? (videoBase64 || undefined) : undefined,
        seconds: isSendingVideo && videoDuration ? Math.round(videoDuration) : undefined,
        mentionAll,
      });

      const mediaLabel = isSendingVideo ? 'Vídeo' : 'Status';
      setFeedback({
        type: 'success',
        message: `🟢 Sucesso! ${mediaLabel} publicado no Story do grupo "${groupName}"! O anel verde já está ativo no avatar do grupo.${
          mentionAll ? ' 👻 Todos os participantes foram notificados discretamente.' : ''
        }`,
      });

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Falha ao postar status no grupo.',
      });
    } finally {
      setSending(false);
    }
  };

  const presetCaptions = [
    '🔥 Novidade exclusiva aqui no grupo!',
    '📢 Comunicado oficial da moderação!',
    '👻 Olá galera! Passando para atualizar o status do grupo.',
    '⚡ Zaptroll Lab: Status ativo no grupo!',
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#11141d] border border-[#2a374f] rounded-3xl p-5 sm:p-6 shadow-2xl font-mono animate-in zoom-in-95 duration-200 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-[#252f44]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#39ff14] border-2 border-[#11141d] flex items-center justify-center text-black text-[9px] font-black">
                ★
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white font-sans">Postar Status no Grupo</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  Story Nativo
                </span>
              </div>
              <p className="text-xs text-gray-400 font-sans mt-0.5 truncate max-w-xs sm:max-w-sm">
                Destino: <span className="text-emerald-400 font-bold font-mono">{groupName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informações do Grupo */}
        <div className="p-3 rounded-2xl bg-[#161c28] border border-[#26334a] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#2e3e5c]">
            <MemeAvatar
              src={groupPicUrl}
              seed={groupJid}
              name={groupName}
              size="md"
              glow={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white truncate font-sans">{groupName}</span>
              <span className="text-[10px] text-gray-400 font-mono shrink-0">@g.us</span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono truncate">{groupJid}</p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-sans leading-relaxed border flex items-start gap-2.5 animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                : 'bg-red-950/70 border-red-500/60 text-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-mono text-[11px]">{feedback.message}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSendStatus} className="space-y-4">
          {/* Legenda / Caption */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-gray-300 flex items-center gap-1.5 font-sans">
                <span>Texto do Status / Legenda:</span>
                <span className="text-[10px] text-gray-400 font-normal">(opcional)</span>
              </label>
              <span className="text-[11px] text-gray-400">{caption.length}/1000</span>
            </div>

            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Digite o texto que aparecerá sobre a imagem ou vídeo do grupo..."
              className="w-full p-3 bg-[#0c0f16] border border-[#26334a] rounded-2xl text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none transition resize-none font-sans"
            />

            {/* Chips de Sugestão Rápida */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presetCaptions.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCaption(preset)}
                  className="px-2.5 py-1 rounded-xl bg-[#171d2b] hover:bg-[#20293d] border border-[#27354f] text-[10px] text-gray-300 hover:text-white transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de Tipo de Mídia (Foto ou Vídeo) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-gray-300 flex items-center gap-1.5 font-sans">
                {mediaType === 'video' ? (
                  <Video className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Mídia do Status (Foto ou Vídeo):</span>
              </label>

              {(imageBase64 || videoBase64 || videoPreviewUrl) && (
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  Remover {mediaType === 'video' ? 'Vídeo' : 'Foto'}
                </button>
              )}
            </div>

            {/* Toggle Abas: Foto vs Vídeo */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0c0f16] border border-[#252f44] rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setMediaType('image');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mediaType === 'image'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Foto / Banner</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaType('video');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Vídeo Nativo</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-200 uppercase font-mono">
                  16MB
                </span>
              </button>
            </div>

            {/* Mídia Selecionada: Foto */}
            {mediaType === 'image' && (
              imageBase64 ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-black max-h-52 flex items-center justify-center group">
                  <img
                    src={imageBase64}
                    alt="Pré-visualização do Status"
                    className="max-h-52 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveMedia}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-2xl border-2 border-dashed border-[#2b3a54] hover:border-emerald-500/60 bg-[#0e121a] hover:bg-[#131924] flex flex-col items-center justify-center text-center cursor-pointer transition group"
                  >
                    <Upload className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                    <p className="text-xs font-bold text-white font-sans">Clique para selecionar uma foto</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WEBP (até 10MB) • Proporção 9:16 recomendada</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Ou cole a URL direta de uma imagem na internet..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#0c0f16] border border-[#26334a] rounded-xl text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none font-sans"
                    />
                  </div>

                  {!imageUrl && !imageBase64 && (
                    <p className="text-[10px] text-gray-400 italic font-sans flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#39ff14] shrink-0" />
                      <span>Se não enviar foto nem vídeo, será utilizado o banner oficial de grupo do Zaptroll.</span>
                    </p>
                  )}
                </div>
              )
            )}

            {/* Mídia Selecionada: Vídeo */}
            {mediaType === 'video' && (
              (videoPreviewUrl || videoBase64) ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-black flex flex-col items-center justify-center">
                    <video
                      controls
                      playsInline
                      src={videoPreviewUrl || videoBase64 || undefined}
                      className="max-h-56 w-full rounded-2xl bg-black object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-white rounded-full transition cursor-pointer shadow-lg"
                      title="Remover vídeo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Informações do Vídeo */}
                  <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-[#0c0f16] border border-[#252f44] rounded-xl text-[11px] font-sans">
                    <div className="flex items-center gap-2 text-gray-300">
                      <FileVideo className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Tamanho:{' '}
                        <strong className="text-white font-mono">
                          {videoFileSize ? `${(videoFileSize / (1024 * 1024)).toFixed(1)} MB` : 'Vídeo carregado'}
                        </strong>
                      </span>
                    </div>

                    {videoDuration && (
                      <div className="flex items-center gap-1.5 text-gray-300 font-mono">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>{Math.round(videoDuration)}s</span>
                      </div>
                    )}
                  </div>

                  {videoDuration && videoDuration > 30 && (
                    <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] text-amber-300 font-sans flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>Dica: Vídeos com mais de 30 segundos podem ser cortados nativamente pelo WhatsApp nos stories.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-[#2b3a54] hover:border-emerald-500/60 bg-[#0e121a] hover:bg-[#131924] flex flex-col items-center justify-center text-center cursor-pointer transition group"
                  >
                    <Video className="w-7 h-7 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                    <p className="text-xs font-bold text-white font-sans">Clique para selecionar um vídeo</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">MP4, MOV, WEBM (até 16MB) • Até 30s de duração recomendada</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-sans border border-emerald-500/30">
                      <span>🎥 WhatsApp Story Nativo de Grupo</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Ou cole a URL direta de um vídeo MP4 na internet..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#0c0f16] border border-[#26334a] rounded-xl text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none font-sans"
                    />
                  </div>
                </div>
              )
            )}

            {/* Input de Arquivo Unificado (Aceita Foto e Vídeo) */}
            <input
              ref={fileInputRef}
              type="file"
              accept={
                mediaType === 'video'
                  ? 'video/mp4,video/quicktime,video/webm,video/3gpp,video/*'
                  : 'image/png,image/jpeg,image/webp,image/*,video/mp4,video/*'
              }
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Menção Fantasma a Todos os Membros */}
          <div className="p-3.5 rounded-2xl bg-[#161a25] border border-[#29364e] flex items-center justify-between">
            <div className="space-y-0.5 mr-3">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Ghost className="w-3.5 h-3.5 text-purple-400" />
                <span>Marcar Todos os Membros (Fantasma)</span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans">
                Notifica discretamente todos os membros do grupo para visualizarem o status, sem poluir a tela com @.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMentionAll(!mentionAll)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                mentionAll ? 'bg-purple-600' : 'bg-[#2a3346]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  mentionAll ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252f44]">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Publicando no WhatsApp...</span>
                </>
              ) : mediaType === 'video' ? (
                <>
                  <Video className="w-4 h-4" />
                  <span>Publicar Vídeo no Grupo</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Publicar Status no Grupo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
