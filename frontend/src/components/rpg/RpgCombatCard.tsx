import React, { useState } from 'react';
import {
  Zap,
  Swords,
  Shield,
  Sparkles,
  Flame,
  Clock,
  Maximize2,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export interface CombatCardData {
  id: string;
  name: string;
  description?: string;
  category: 'forca' | 'defesa' | 'estrategia' | 'utilidade';
  element?: string;
  energyCost: number;
  power: number;
  priority: number;
  emoji: string;
  isBluff?: boolean;
  hidden?: boolean;
  image?: string;
}

interface RpgCombatCardProps {
  card: CombatCardData;
  isSelected?: boolean;
  disabled?: boolean;
  canAfford?: boolean;
  isLocked?: boolean;
  onSelect?: () => void;
  onInspect?: (card: CombatCardData) => void;
}

const CATEGORY_STYLES: Record<
  string,
  {
    border: string;
    borderSelected: string;
    bg: string;
    text: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  forca: {
    border: 'border-red-600/50 hover:border-red-500',
    borderSelected: 'border-red-400 ring-2 ring-red-400',
    bg: 'from-red-950/80 via-[#180a0f]/90 to-[#0e0609]/95',
    text: 'text-red-400',
    glow: 'shadow-[0_0_22px_rgba(239,68,68,0.45)]',
    badgeBg: 'bg-red-950/90 border-red-500/40',
    badgeText: 'text-red-300',
    label: 'FORÇA',
    icon: Swords,
  },
  defesa: {
    border: 'border-blue-600/50 hover:border-blue-500',
    borderSelected: 'border-blue-400 ring-2 ring-blue-400',
    bg: 'from-blue-950/80 via-[#0a121f]/90 to-[#050912]/95',
    text: 'text-blue-400',
    glow: 'shadow-[0_0_22px_rgba(59,130,246,0.45)]',
    badgeBg: 'bg-blue-950/90 border-blue-500/40',
    badgeText: 'text-blue-300',
    label: 'DEFESA',
    icon: Shield,
  },
  estrategia: {
    border: 'border-purple-600/50 hover:border-purple-500',
    borderSelected: 'border-purple-400 ring-2 ring-purple-400',
    bg: 'from-purple-950/80 via-[#150a21]/90 to-[#0a0512]/95',
    text: 'text-purple-400',
    glow: 'shadow-[0_0_22px_rgba(168,85,247,0.45)]',
    badgeBg: 'bg-purple-950/90 border-purple-500/40',
    badgeText: 'text-purple-300',
    label: 'ESTRATÉGIA',
    icon: Sparkles,
  },
  utilidade: {
    border: 'border-amber-600/50 hover:border-amber-500',
    borderSelected: 'border-amber-400 ring-2 ring-amber-400',
    bg: 'from-amber-950/80 via-[#1d1206]/90 to-[#0d0802]/95',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_22px_rgba(245,158,11,0.45)]',
    badgeBg: 'bg-amber-950/90 border-amber-500/40',
    badgeText: 'text-amber-300',
    label: 'UTILIDADE',
    icon: Flame,
  },
};

export const RpgCombatCard: React.FC<RpgCombatCardProps> = ({
  card,
  isSelected = false,
  disabled = false,
  canAfford = true,
  isLocked = false,
  onSelect,
  onInspect,
}) => {
  const [imgError, setImgError] = useState(false);
  const col = CATEGORY_STYLES[card.category] || CATEGORY_STYLES.forca;
  const CategoryIcon = col.icon;
  const cardImage = card.image || `/rpg/cards/${card.id}.webp`;

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInspect) {
      onInspect(card);
    }
  };

  return (
    <div
      onClick={!disabled && canAfford && !isLocked ? onSelect : undefined}
      className={`group relative rounded-2xl border bg-gradient-to-b ${col.bg} p-2 text-left transition-all duration-300 flex flex-col justify-between overflow-hidden select-none ${
        isSelected
          ? `${col.borderSelected} ${col.glow} -translate-y-2 scale-[1.03]`
          : `${col.border} hover:scale-[1.01] hover:-translate-y-0.5`
      } ${
        !canAfford || disabled || isLocked
          ? 'cursor-not-allowed opacity-50 grayscale-[40%]'
          : 'cursor-pointer'
      }`}
    >
      {/* Shimmer de Carta Selecionada */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      )}

      {/* Selo Flutuante de Seleção / Trava */}
      {isSelected && !isLocked && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-emerald-500/90 border border-white/50 text-[9px] font-black tracking-widest text-white uppercase shadow-lg flex items-center gap-1 animate-pulse">
          <CheckCircle2 className="w-3 h-3 text-white" /> PRONTA
        </div>
      )}

      {isLocked && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-cyan-600/90 border border-white/40 text-[9px] font-black tracking-widest text-white uppercase shadow-lg flex items-center gap-1">
          <Lock className="w-3 h-3 text-cyan-200" /> TRAVADA
        </div>
      )}

      {/* Top Header: Custo de Energia + Categoria + Botão de Inspecionar */}
      <div className="flex items-center justify-between gap-1 mb-1.5 z-10">
        {/* Cristal de Energia */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-cyan-950/90 border border-cyan-400/60 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
          <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
          <span className="font-mono font-black text-xs text-cyan-200 leading-none">
            {card.energyCost}
          </span>
        </div>

        {/* Badge de Categoria */}
        <div className="flex items-center gap-1">
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-mono font-bold tracking-wider ${col.badgeBg} ${col.badgeText}`}
          >
            <CategoryIcon className="w-2.5 h-2.5" />
            <span className="hidden xs:inline">{col.label}</span>
          </span>

          {/* Botão de Zoom/Inspecionar */}
          {onInspect && (
            <button
              type="button"
              onClick={handleInspect}
              title="Ver Arte em Alta Definição"
              className="p-1 rounded-lg bg-black/40 hover:bg-black/70 border border-white/10 hover:border-white/30 text-gray-300 hover:text-white transition"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Janela de Ilustração da Carta */}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-inner group-hover:border-white/20 transition mb-2 flex items-center justify-center">
        {!imgError ? (
          <img
            src={cardImage}
            alt={card.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2">
            <span className="text-3xl filter drop-shadow-md">{card.emoji}</span>
          </div>
        )}

        {/* Gradiente sutil nas bordas da janela */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Elemento / Tag no rodapé da arte */}
        <div className="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-white/10 text-[8px] font-mono font-semibold text-gray-300">
          {card.element || card.category}
        </div>

        {card.isBluff && (
          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-[8px] font-mono font-bold text-amber-300">
            🃏 BLEFE
          </div>
        )}
      </div>

      {/* Título da Carta */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-black text-xs text-white leading-tight line-clamp-1 tracking-tight drop-shadow">
            {card.name}
          </h4>
          {card.description && (
            <p className="text-[10px] text-gray-300 mt-1 line-clamp-2 leading-tight">
              {card.description}
            </p>
          )}
        </div>

        {/* Barra de Status Inferior: Poder e Prioridade */}
        <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1 text-red-300 font-bold">
            <Swords className="w-3 h-3 text-red-400" />
            <span>{card.power > 0 ? card.power : '—'}</span>
          </div>

          <div className="flex items-center gap-1 text-sky-300 font-bold">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>P{card.priority}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CardInspectionModalProps {
  card: CombatCardData | null;
  onClose: () => void;
  onSelectAndLock?: (card: CombatCardData) => void;
  canSelect?: boolean;
}

export const CardInspectionModal: React.FC<CardInspectionModalProps> = ({
  card,
  onClose,
  onSelectAndLock,
  canSelect = false,
}) => {
  if (!card) return null;
  const col = CATEGORY_STYLES[card.category] || CATEGORY_STYLES.forca;
  const CategoryIcon = col.icon;
  const cardImage = card.image || `/rpg/cards/${card.id}.webp`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-3xl border-2 ${col.border} bg-[#0c1017] p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-white space-y-4 max-h-[92vh] overflow-y-auto`}
      >
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950 border border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.4)]">
            <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
            <span className="font-mono font-black text-sm text-cyan-200">{card.energyCost} Energia</span>
          </div>
          <span
            className={`flex items-center gap-1 px-3 py-1 rounded-xl border text-xs font-mono font-bold ${col.badgeBg} ${col.badgeText}`}
          >
            <CategoryIcon className="w-3.5 h-3.5" />
            {col.label}
          </span>
        </div>

        {/* Grande Ilustração */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-white/20 bg-black shadow-2xl flex items-center justify-center">
          <img
            src={cardImage}
            alt={card.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 text-2xl filter drop-shadow">
            {card.emoji}
          </div>
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 backdrop-blur-sm border border-white/20 text-[10px] font-mono text-gray-200 uppercase">
            Elemento: {card.element || card.category}
          </div>
        </div>

        {/* Título & Detalhes */}
        <div>
          <h2 className="text-xl font-black text-white leading-tight drop-shadow">
            {card.name}
          </h2>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            {card.description}
          </p>
        </div>

        {/* Grade de Estatísticas */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1">
              <Swords className="w-3.5 h-3.5 text-red-400" /> Poder
            </span>
            <span className="font-bold text-red-300">{card.power > 0 ? card.power : '—'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-400" /> Prioridade
            </span>
            <span className="font-bold text-sky-300">{card.priority}</span>
          </div>
        </div>

        {/* Ação rápida de seleção no modal */}
        {canSelect && onSelectAndLock && (
          <button
            onClick={() => {
              onSelectAndLock(card);
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm tracking-wide shadow-lg transition flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4" /> Escolher Esta Carta
          </button>
        )}
      </div>
    </div>
  );
};
