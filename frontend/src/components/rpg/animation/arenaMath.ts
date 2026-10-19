import { RigPose, JointName, ActionConfig, AnimationFrame, Point2D } from './types.js';

// Funções de Easing (Suavização matemática)
export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutBack: (t: number, s = 1.70158) => {
    const t1 = t - 1;
    return t1 * t1 * ((s + 1) * t1 + s) + 1;
  },
  easeInBack: (t: number, s = 1.70158) => {
    return t * t * ((s + 1) * t - s);
  },
};

/**
 * Interpola suavemente duas poses articulação por articulação
 */
export function interpolatePoses(poseA: RigPose, poseB: RigPose, alpha: number): RigPose {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const result = {} as RigPose;

  const jointKeys = Object.keys(poseA) as JointName[];
  for (const joint of jointKeys) {
    const ptA = poseA[joint] || { x: 70, y: 110 };
    const ptB = poseB[joint] || ptA;

    result[joint] = {
      x: ptA.x + (ptB.x - ptA.x) * clampedAlpha,
      y: ptA.y + (ptB.y - ptA.y) * clampedAlpha,
    };
  }

  return result;
}

export interface SolvedFrameState {
  pose: RigPose;
  png?: string;
  move: Point2D;
  scale: number;
  rotation: number;
  opacity: number;
  isImpact: boolean;
  impactPoint?: JointName;
  impactEffect?: string;
  isFinished: boolean;
}

/**
 * Resolve o estado visual de pose, deslocamento e impacto para um determinado instante de tempo (ms)
 */
export function solveActionFrame(
  actionConfig: ActionConfig,
  rigPoses: Record<string, RigPose>,
  timeMs: number
): SolvedFrameState {
  const frames = actionConfig.frames || [];
  if (frames.length === 0) {
    const fallbackPose = rigPoses['guard'] || Object.values(rigPoses)[0];
    return {
      pose: fallbackPose,
      png: actionConfig.png,
      move: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      opacity: 1,
      isImpact: false,
      isFinished: true,
    };
  }

  const duration = frames[frames.length - 1].t;
  let effectiveTime = timeMs;

  if (actionConfig.loop && duration > 0) {
    effectiveTime = timeMs % duration;
  }

  const isFinished = !actionConfig.loop && timeMs >= duration;

  // Encontrar quadro anterior e próximo
  let prevFrame: AnimationFrame = frames[0];
  let nextFrame: AnimationFrame = frames[frames.length - 1];

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t <= effectiveTime) {
      prevFrame = frames[i];
    }
    if (frames[i].t >= effectiveTime) {
      nextFrame = frames[i];
      break;
    }
  }

  const prevPose = rigPoses[prevFrame.pose] || rigPoses['guard'] || Object.values(rigPoses)[0];
  const nextPose = rigPoses[nextFrame.pose] || prevPose;

  const segmentDuration = nextFrame.t - prevFrame.t;
  const segmentProgress = segmentDuration > 0 ? (effectiveTime - prevFrame.t) / segmentDuration : 1;
  const easedAlpha = Easing.easeInOutQuad(segmentProgress);

  const pose = interpolatePoses(prevPose, nextPose, easedAlpha);

  // Deslocamento da arena (movimento x, y)
  const prevMoveX = prevFrame.move?.x || 0;
  const prevMoveY = prevFrame.move?.y || 0;
  const nextMoveX = nextFrame.move?.x || prevMoveX;
  const nextMoveY = nextFrame.move?.y || prevMoveY;

  const move: Point2D = {
    x: prevMoveX + (nextMoveX - prevMoveX) * easedAlpha,
    y: prevMoveY + (nextMoveY - prevMoveY) * easedAlpha,
  };

  const scale = (prevFrame.scale || 1) + ((nextFrame.scale || 1) - (prevFrame.scale || 1)) * easedAlpha;
  const rotation = (prevFrame.rotation || 0) + ((nextFrame.rotation || 0) - (prevFrame.rotation || 0)) * easedAlpha;
  const opacity = (prevFrame.opacity ?? 1) + ((nextFrame.opacity ?? 1) - (prevFrame.opacity ?? 1)) * easedAlpha;

  // Impacto ocorre na janela próxima ao frame marcado
  const isImpact = Boolean(nextFrame.impact && Math.abs(effectiveTime - nextFrame.t) < 45);

  return {
    pose,
    png: nextFrame.png || prevFrame.png || actionConfig.png,
    move,
    scale,
    rotation,
    opacity,
    isImpact,
    impactPoint: nextFrame.impactPoint || actionConfig.impactPoint,
    impactEffect: actionConfig.impactEffect,
    isFinished,
  };
}

/**
 * Converte coordenadas lógicas da arena (1000x500) para coordenadas de tela responsivas
 */
export function arenaToScreen(
  logicalX: number,
  logicalY: number,
  containerWidth: number,
  containerHeight: number
): { left: number; top: number; scale: number } {
  const ARENA_WIDTH = 1000;
  const ARENA_HEIGHT = 500;

  const scale = Math.min(containerWidth / ARENA_WIDTH, containerHeight / ARENA_HEIGHT);
  const offsetX = (containerWidth - ARENA_WIDTH * scale) / 2;
  const offsetY = (containerHeight - ARENA_HEIGHT * scale) / 2;

  return {
    left: offsetX + logicalX * scale,
    top: offsetY + logicalY * scale,
    scale,
  };
}
