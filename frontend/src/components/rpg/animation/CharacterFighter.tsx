import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActionName,
  CharacterManifest,
  DefaultRigConfig,
  JointName,
  RigPose,
} from './types.js';
import { StickFigure } from './StickFigure.js';
import { solveActionFrame, SolvedFrameState } from './arenaMath.js';

interface CharacterFighterProps {
  side: 'p1' | 'p2';
  characterId: string;
  characterName: string;
  action: ActionName;
  actionTimeMs: number;
  manifest?: CharacterManifest | null;
  defaultRig: DefaultRigConfig;
  skeletonOpacity?: number; // 0 a 1 (para o modo debug ou fallback)
  showDebugSkeleton?: boolean;
  flipX?: boolean;
  scale?: number;
  isHit?: boolean;
  isGuarding?: boolean;
  knockbackX?: number;
  auraEffect?: string | null;
  speechBubble?: { text: string } | null;
  onImpact?: (impactPoint?: JointName, effect?: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const CharacterFighter: React.FC<CharacterFighterProps> = ({
  side,
  characterId,
  characterName,
  action,
  actionTimeMs,
  manifest,
  defaultRig,
  skeletonOpacity = 0.6,
  showDebugSkeleton = false,
  flipX = false,
  scale = 1.0,
  isHit = false,
  isGuarding = false,
  knockbackX = 0,
  auraEffect,
  speechBubble,
  onImpact,
  className = '',
  style = {},
}) => {
  const [pngLoadError, setPngLoadError] = useState<Record<string, boolean>>({});
  const [idlePngAvailable, setIdlePngAvailable] = useState<boolean | null>(null);
  const impactTriggeredRef = useRef<boolean>(false);
  const lastActionRef = useRef<ActionName>(action);

  // Resetar flag de impacto quando a ação muda
  if (lastActionRef.current !== action) {
    lastActionRef.current = action;
    impactTriggeredRef.current = false;
  }

  // 1. Obter configuração da ação do manifesto ou fallback do rig
  const actionConfig = useMemo(() => {
    const fromManifest = manifest?.actions?.[action];
    const fromRig = defaultRig.actions?.[action] || defaultRig.actions?.['idle'];

    if (!fromManifest) return fromRig;

    // Mesclar quadros do rig padrão se o manifesto não customizou frames
    return {
      ...fromRig,
      ...fromManifest,
      frames: fromManifest.frames && fromManifest.frames.length > 0 ? fromManifest.frames : fromRig.frames,
      impactPoint: fromManifest.impactPoint || fromRig.impactPoint,
      impactEffect: fromManifest.impactEffect || fromRig.impactEffect,
      shake: fromManifest.shake ?? fromRig.shake,
      hitstopMs: fromManifest.hitstopMs ?? fromRig.hitstopMs,
    };
  }, [manifest, defaultRig, action]);

  // 2. Resolver o frame atual matematicamente
  const solvedFrame: SolvedFrameState = useMemo(() => {
    return solveActionFrame(actionConfig, defaultRig.poses, actionTimeMs);
  }, [actionConfig, defaultRig.poses, actionTimeMs]);

  // 3. Notificar impacto exatamente no instante em que o frame é de impacto
  useEffect(() => {
    if (solvedFrame.isImpact && !impactTriggeredRef.current) {
      impactTriggeredRef.current = true;
      if (onImpact) {
        onImpact(solvedFrame.impactPoint, solvedFrame.impactEffect);
      }
    }
  }, [solvedFrame.isImpact, solvedFrame.impactPoint, solvedFrame.impactEffect, onImpact]);

  // 4. Determinar PNG do frame atual
  const actionPngFileName = solvedFrame.png || `${action}.png`;
  const primaryPngPath = `/rpg/characters/${characterId}/${actionPngFileName}`;
  const idlePngPath = `/rpg/characters/${characterId}/idle.png`;

  const primaryPngFailed = pngLoadError[primaryPngPath];

  // Testar se idle.png está acessível para fallbackMode "png_transform"
  useEffect(() => {
    if (idlePngAvailable === null && manifest?.fallbackMode === 'png_transform') {
      const img = new Image();
      img.src = idlePngPath;
      img.onload = () => setIdlePngAvailable(true);
      img.onerror = () => setIdlePngAvailable(false);
    }
  }, [idlePngPath, manifest?.fallbackMode, idlePngAvailable]);

  // 5. Estratégia de exibição da imagem vs palito
  const canUsePngTransform =
    manifest?.fallbackMode === 'png_transform' &&
    primaryPngFailed &&
    idlePngAvailable === true;

  const currentDisplayPng = !primaryPngFailed
    ? primaryPngPath
    : canUsePngTransform
    ? idlePngPath
    : null;

  const hasPng = Boolean(currentDisplayPng);

  // Se não tem PNG, o esqueleto de palito é obrigatório (opacidade 1.0)
  // Se tem PNG, o esqueleto só aparece se showDebugSkeleton estiver ativo
  const effectiveSkeletonOpacity = !hasPng ? 1.0 : showDebugSkeleton ? skeletonOpacity : 0;

  // Offset configurado no manifesto para esta ação
  const actionOffset = manifest?.offsets?.[action] || { x: 0, y: 0, scale: 1.0 };
  const totalScale = scale * (manifest?.scale || 1.0) * (actionOffset.scale || 1.0) * solvedFrame.scale;

  // Deslocamento de knockback se estiver sendo atingido
  const totalMoveX = solvedFrame.move.x + knockbackX + (actionOffset.x || 0);
  const totalMoveY = solvedFrame.move.y + (actionOffset.y || 0);

  // Cores do lutador (Jogador A = Neon Green, Jogador B = Neon Purple)
  const neonColor = side === 'p1' ? '#39ff14' : '#c084fc';
  const glowColor = side === 'p1' ? 'rgba(57,255,20,0.5)' : 'rgba(192,132,252,0.5)';

  return (
    <div
      className={`relative select-none pointer-events-none transition-transform duration-75 ${className}`}
      style={{
        transform: `translate3d(${totalMoveX}px, ${totalMoveY}px, 0) scale(${totalScale})`,
        transformOrigin: `${(manifest?.anchor?.x ?? 0.5) * 100}% ${(manifest?.anchor?.y ?? 0.95) * 100}%`,
        ...style,
      }}
    >
      {/* ==========================================
          CAMADA 2: SOMBRA NO CHÃO (acompanha o lutador)
          ========================================== */}
      <div
        className="absolute left-1/2 -bottom-2 -translate-x-1/2 pointer-events-none"
        style={{
          width: '100px',
          height: '24px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 75%)',
          transform: `scale(${Math.max(0.4, 1 - Math.abs(totalMoveY) * 0.005)})`,
          opacity: Math.max(0.2, 1 - Math.abs(totalMoveY) * 0.01),
          zIndex: 1,
        }}
      />

      {/* ==========================================
          AURA DE STATUS (se houver buff, debuff, fúria)
          ========================================== */}
      {auraEffect && (
        <div
          className="absolute inset-0 -m-6 rounded-full pointer-events-none animate-pulse"
          style={{
            background:
              auraEffect === 'fire'
                ? 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)'
                : auraEffect === 'poison'
                ? 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)'
                : auraEffect === 'shield'
                ? 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(234,179,8,0.4) 0%, transparent 70%)',
            filter: 'blur(10px)',
            zIndex: 2,
          }}
        />
      )}

      {/* Flash de dano (efeito piscada branca/vermelha ao ser atingido) */}
      {isHit && (
        <div
          className="absolute inset-0 rounded-2xl bg-red-500/40 mix-blend-overlay animate-ping pointer-events-none"
          style={{ zIndex: 6 }}
        />
      )}

      {/* ==========================================
          CAMADA 3: ARTE PNG DO PERSONAGEM
          ========================================== */}
      {hasPng && currentDisplayPng && (
        <div
          className="relative pointer-events-auto overflow-visible"
          style={{
            width: '140px',
            height: '220px',
            transform: `${flipX ? 'scaleX(-1)' : 'none'} rotate(${solvedFrame.rotation}deg)`,
            transformOrigin: 'center bottom',
            zIndex: 3,
            filter: isHit ? 'brightness(1.8) contrast(1.3) drop-shadow(0 0 15px rgba(239,68,68,0.8))' : 'none',
          }}
        >
          <img
            src={currentDisplayPng}
            alt={`${characterName} - ${action}`}
            draggable={false}
            onError={() => {
              setPngLoadError((prev) => ({ ...prev, [currentDisplayPng]: true }));
            }}
            className="w-full h-full object-contain pointer-events-none"
            style={{
              opacity: solvedFrame.opacity,
              filter: `drop-shadow(0 10px 15px rgba(0,0,0,0.5))`,
            }}
          />
        </div>
      )}

      {/* ==========================================
          CAMADA 4: ESQUELETO (BONECO DE PALITO SVG)
          - Aparece como Fallback 100% funcional se PNG faltar
          - Aparece semitransparente em cima do PNG se ?debug=skeleton estiver ativo
          ========================================== */}
      {effectiveSkeletonOpacity > 0 && (
        <div
          className="pointer-events-none"
          style={{
            position: hasPng ? 'absolute' : 'relative',
            left: 0,
            top: 0,
            width: '140px',
            height: '220px',
            opacity: effectiveSkeletonOpacity,
            zIndex: 4,
          }}
        >
          <StickFigure
            pose={solvedFrame.pose}
            color={neonColor}
            glowColor={glowColor}
            flipX={flipX}
            impactJoint={solvedFrame.isImpact ? solvedFrame.impactPoint : undefined}
          />
        </div>
      )}

      {/* Balão de Fala / Provocação / Taunt */}
      {speechBubble && speechBubble.text && (
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-black/85 border border-yellow-400 text-yellow-300 font-bold text-xs whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-bounce pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {speechBubble.text}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/85 border-r border-b border-yellow-400 rotate-45" />
        </div>
      )}
    </div>
  );
};
