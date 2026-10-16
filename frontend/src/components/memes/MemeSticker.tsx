import React from 'react';
import { getMemeById } from './memeData.js';

interface MemeStickerProps {
  memeId: string;
  label?: string;
  subtitle?: string;
  badge?: string;
  rotation?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'card';
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

export const MemeSticker: React.FC<MemeStickerProps> = ({
  memeId,
  label,
  subtitle,
  badge,
  rotation = '-rotate-3',
  size = 'card',
  className = '',
  glow = true,
  onClick,
}) => {
  const meme = getMemeById(memeId);
  const SvgComponent = meme.component;

  if (size === 'card' || size === 'xl') {
    return (
      <div
        onClick={onClick}
        style={{
          borderColor: `${meme.color}99`,
          boxShadow: glow
            ? `0 14px 45px -4px ${meme.color}40, 0 0 25px 2px ${meme.color}25`
            : undefined,
        }}
        className={`inline-flex items-center gap-4.5 rounded-3xl bg-[#131722]/95 backdrop-blur-2xl border-2 ${rotation} p-5 sm:p-6 select-none transition-all duration-300 hover:rotate-0 hover:scale-105 hover:border-white/60 min-w-[320px] max-w-md shadow-2xl ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        {/* Large Meme Icon Container */}
        <div
          style={{ borderColor: `${meme.color}50`, backgroundColor: '#0b0e14' }}
          className="w-20 h-20 shrink-0 rounded-2xl border-2 flex items-center justify-center p-3 shadow-inner"
        >
          <SvgComponent className="w-full h-full object-contain filter drop-shadow" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col min-w-0 pr-1">
          {badge && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                style={{ color: meme.color, borderColor: `${meme.color}60` }}
                className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/50 border leading-none"
              >
                {badge}
              </span>
            </div>
          )}

          <span className="font-black text-white font-mono text-base sm:text-lg tracking-tight leading-tight">
            {label || meme.quote}
          </span>

          <span className="text-xs sm:text-sm text-gray-300 font-mono mt-1.5 leading-snug">
            {subtitle || meme.name}
          </span>
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'p-1.5 gap-1.5 text-[10px]',
    md: 'p-2.5 gap-2.5 text-xs',
    lg: 'p-3.5 gap-3 text-sm',
  };

  const svgSizes = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  return (
    <div
      style={{
        borderColor: `${meme.color}66`,
        boxShadow: glow ? `0 4px 20px -2px ${meme.color}25` : undefined,
      }}
      className={`inline-flex items-center rounded-2xl bg-[#161922]/95 backdrop-blur-md border border-white/10 ${rotation} ${sizeClasses[size as 'sm' | 'md' | 'lg']} select-none transition-all duration-300 hover:rotate-0 hover:scale-105 hover:border-white/30 ${className}`}
    >
      <div
        className={`${svgSizes[size as 'sm' | 'md' | 'lg']} shrink-0 rounded-xl bg-black/40 flex items-center justify-center p-1 border border-white/5`}
      >
        <SvgComponent className="w-full h-full object-contain" />
      </div>
      {label && (
        <div className="flex flex-col pr-1">
          <span className="font-bold text-white font-mono tracking-tight leading-tight">
            {label}
          </span>
          <span className="text-[10px] text-gray-400 font-sans leading-none mt-0.5">
            {subtitle || meme.name}
          </span>
        </div>
      )}
    </div>
  );
};
