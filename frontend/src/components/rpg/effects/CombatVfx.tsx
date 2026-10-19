import React from 'react';
import { ImpactEffectType } from '../animation/types.js';

export interface HitEffectInstance {
  id: string;
  x: number;
  y: number;
  type: ImpactEffectType;
  createdAt: number;
}

export interface FloatingNumberInstance {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'damage' | 'crit' | 'heal' | 'block' | 'dodge';
  createdAt: number;
}

interface CombatVfxProps {
  hitEffects: HitEffectInstance[];
  floatingNumbers: FloatingNumberInstance[];
  shakeIntensity?: number; // 0 a 15
}

export const CombatVfx: React.FC<CombatVfxProps> = ({
  hitEffects,
  floatingNumbers,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
      {/* 1. Faíscas e Efeitos de Impacto */}
      {hitEffects.map((hit) => {
        const isShield = hit.type === 'hit_blocked';
        const isCrit = hit.type === 'hit_crit';
        const isSpecial = hit.type === 'special_blast';

        return (
          <div
            key={hit.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ left: `${hit.x}px`, top: `${hit.y}px` }}
          >
            {/* Efeito Escudo / Bloqueio */}
            {isShield && (
              <div className="relative animate-ping duration-300">
                <div className="w-28 h-28 rounded-full border-4 border-cyan-400 bg-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.9)] flex items-center justify-center">
                  <div className="text-3xl text-cyan-200 font-extrabold select-none">🛡️</div>
                </div>
              </div>
            )}

            {/* Efeito Crítico com Explosão Espinhosa */}
            {isCrit && (
              <div className="relative flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-red-600/40 animate-ping absolute" />
                <div className="w-24 h-24 rotate-45 bg-yellow-400 shadow-[0_0_40px_rgba(251,191,36,1)] animate-spin duration-700" />
                <div className="absolute text-4xl select-none animate-bounce">⚡💥</div>
              </div>
            )}

            {/* Efeito Especial / Supernova */}
            {isSpecial && (
              <div className="relative flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-purple-600/50 animate-ping absolute shadow-[0_0_60px_rgba(168,85,247,0.8)]" />
                <div className="w-36 h-36 rounded-full border-4 border-amber-300 bg-amber-400/30 animate-pulse" />
                <div className="absolute text-5xl select-none animate-spin">✨🌟🔥</div>
              </div>
            )}

            {/* Efeito de Golpe Pesado / Normal */}
            {!isShield && !isCrit && !isSpecial && (
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-amber-500/30 animate-ping absolute" />
                <div className="w-16 h-16 rounded-full border-2 border-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.9)] flex items-center justify-center">
                  <span className="text-2xl animate-pulse">💥</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 2. Números Flutuantes de Dano / Esquiva / Cura */}
      {floatingNumbers.map((fn) => {
        const isCrit = fn.type === 'crit';
        const isDodge = fn.type === 'dodge';
        const isBlock = fn.type === 'block';

        let textColor = 'text-red-400';
        let glowClass = 'drop-shadow-[0_2px_10px_rgba(239,68,68,0.8)]';

        if (isCrit) {
          textColor = 'text-yellow-300';
          glowClass = 'drop-shadow-[0_3px_15px_rgba(250,204,21,1)] text-2xl font-black';
        } else if (isDodge) {
          textColor = 'text-cyan-300';
          glowClass = 'drop-shadow-[0_2px_10px_rgba(34,211,238,0.8)]';
        } else if (isBlock) {
          textColor = 'text-blue-300';
          glowClass = 'drop-shadow-[0_2px_10px_rgba(96,165,250,0.8)]';
        }

        return (
          <div
            key={fn.id}
            className={`absolute font-black tracking-wider uppercase select-none pointer-events-none transform -translate-x-1/2 animate-bounce ${textColor} ${glowClass}`}
            style={{
              left: `${fn.x}px`,
              top: `${fn.y}px`,
              animation: 'floatUpAndFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {fn.text}
          </div>
        );
      })}
    </div>
  );
};
