import React from 'react';

interface SpecialBannerProps {
  visible: boolean;
  characterName: string;
  avatarEmoji?: string;
  attackName: string;
  side: 'p1' | 'p2';
  phrase?: string;
}

export const SpecialBanner: React.FC<SpecialBannerProps> = ({
  visible,
  characterName,
  avatarEmoji = '⚡',
  attackName,
  side,
  phrase,
}) => {
  if (!visible) return null;

  const isP1 = side === 'p1';
  const gradient = isP1
    ? 'from-emerald-950/90 via-emerald-800/90 to-black/90'
    : 'from-purple-950/90 via-purple-800/90 to-black/90';
  const borderColor = isP1 ? 'border-emerald-400' : 'border-purple-400';
  const textColor = isP1 ? 'text-emerald-300' : 'text-purple-300';
  const accentGlow = isP1 ? 'shadow-[0_0_50px_rgba(16,185,129,0.8)]' : 'shadow-[0_0_50px_rgba(168,85,247,0.8)]';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden backdrop-blur-sm bg-black/40 animate-fadeIn">
      {/* Faixas pretas cinematográficas (letterbox) */}
      <div className="absolute top-0 inset-x-0 h-14 bg-black/80" />
      <div className="absolute bottom-0 inset-x-0 h-14 bg-black/80" />

      {/* Banner diagonal cortante */}
      <div
        className={`w-full py-6 md:py-8 bg-gradient-to-r ${gradient} border-y-4 ${borderColor} ${accentGlow} flex items-center justify-between px-6 md:px-16 transform -skew-y-2`}
      >
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-black/50 border-2 border-white/20 flex items-center justify-center text-5xl md:text-6xl shadow-2xl animate-pulse">
            {avatarEmoji}
          </div>
          <div>
            <div className="text-xs md:text-sm font-mono tracking-widest uppercase text-yellow-400 font-bold mb-1">
              ⭐ GOLPE SUPREMO
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight drop-shadow-lg">
              {attackName}
            </h1>
            <p className={`text-sm md:text-base font-semibold ${textColor}`}>
              {characterName} {phrase ? `— "${phrase}"` : ''}
            </p>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-end text-right">
          <span className="text-5xl font-black tracking-widest text-white/10 uppercase italic select-none">
            SPECIAL
          </span>
          <span className="text-xs font-mono text-yellow-300 font-bold tracking-widest uppercase">
            IMPACTO IMINENTE
          </span>
        </div>
      </div>
    </div>
  );
};
