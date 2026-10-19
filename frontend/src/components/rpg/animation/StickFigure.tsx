import React from 'react';
import { RigPose, JointName, Point2D } from './types.js';

interface StickFigureProps {
  pose: RigPose;
  color?: string;
  glowColor?: string;
  secondaryColor?: string;
  opacity?: number;
  thickness?: number;
  flipX?: boolean;
  impactJoint?: JointName;
  selectedJoint?: JointName | null;
  interactive?: boolean; // Se verdadeiro, exibe alças interativas para o editor de poses
  onJointMouseDown?: (joint: JointName, e: React.MouseEvent) => void;
  onJointTouchStart?: (joint: JointName, e: React.TouchEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Conexões ósseas do esqueleto
const BONE_CONNECTIONS: Array<[JointName, JointName, string]> = [
  // Coluna e tronco
  ['head', 'neck', 'cervical'],
  ['neck', 'hip', 'spine'],
  ['shoulder_l', 'shoulder_r', 'clavicle'],
  // Braço Esquerdo
  ['neck', 'shoulder_l', 'shoulder_l_connect'],
  ['shoulder_l', 'elbow_l', 'upper_arm_l'],
  ['elbow_l', 'hand_l', 'forearm_l'],
  // Braço Direito
  ['neck', 'shoulder_r', 'shoulder_r_connect'],
  ['shoulder_r', 'elbow_r', 'upper_arm_r'],
  ['elbow_r', 'hand_r', 'forearm_r'],
  // Perna Esquerda
  ['hip', 'knee_l', 'thigh_l'],
  ['knee_l', 'foot_l', 'shin_l'],
  // Perna Direita
  ['hip', 'knee_r', 'thigh_r'],
  ['knee_r', 'foot_r', 'shin_r'],
];

export const StickFigure: React.FC<StickFigureProps> = ({
  pose,
  color = '#39ff14',
  glowColor = 'rgba(57,255,20,0.6)',
  secondaryColor = '#ffffff',
  opacity = 1.0,
  thickness = 5.5,
  flipX = false,
  impactJoint,
  selectedJoint,
  interactive = false,
  onJointMouseDown,
  onJointTouchStart,
  className = '',
  style = {},
}) => {
  if (!pose || !pose.head) return null;

  const width = 140;
  const height = 220;

  // Renderizar cada osso
  const renderBones = () => {
    return BONE_CONNECTIONS.map(([startName, endName, id]) => {
      const p1: Point2D | undefined = pose[startName];
      const p2: Point2D | undefined = pose[endName];
      if (!p1 || !p2) return null;

      return (
        <line
          key={id}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      );
    });
  };

  // Renderizar juntas e extremidades
  const renderJoints = () => {
    const jointKeys = Object.keys(pose) as JointName[];

    return jointKeys.map((joint) => {
      const pt = pose[joint];
      if (!pt) return null;

      const isImpact = impactJoint === joint;
      const isSelected = selectedJoint === joint;
      const isTerminal = joint === 'hand_l' || joint === 'hand_r' || joint === 'foot_l' || joint === 'foot_r';
      const radius = isSelected ? 8 : isImpact ? 9 : isTerminal ? 6 : 4;

      return (
        <g key={joint} className={interactive ? 'cursor-grab active:cursor-grabbing' : ''}>
          {/* Efeito de impacto pulsante */}
          {isImpact && (
            <circle
              cx={pt.x}
              cy={pt.y}
              r={16}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
              className="animate-ping"
              opacity="0.8"
            />
          )}

          {/* Destaque de seleção no editor */}
          {isSelected && (
            <circle
              cx={pt.x}
              cy={pt.y}
              r={14}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="3 3"
              className="animate-spin"
            />
          )}

          {/* Círculo do joint */}
          <circle
            cx={pt.x}
            cy={pt.y}
            r={radius}
            fill={isSelected ? '#38bdf8' : isImpact ? '#f59e0b' : isTerminal ? secondaryColor : color}
            stroke="#000000"
            strokeWidth={1.5}
            style={{
              filter: isImpact
                ? 'drop-shadow(0 0 10px rgba(245,158,11,1))'
                : `drop-shadow(0 0 5px ${glowColor})`,
            }}
            onMouseDown={onJointMouseDown ? (e) => onJointMouseDown(joint, e) : undefined}
            onTouchStart={onJointTouchStart ? (e) => onJointTouchStart(joint, e) : undefined}
          />
        </g>
      );
    });
  };

  // Cabeça estilizada
  const head = pose.head || { x: 70, y: 40 };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`pointer-events-auto select-none overflow-visible ${className}`}
      style={{
        width: '100%',
        height: '100%',
        opacity,
        transform: flipX ? 'scaleX(-1)' : 'none',
        transformOrigin: 'center bottom',
        ...style,
      }}
    >
      <defs>
        <radialGradient id={`headGlow-${color.replace(/[^a-zA-Z0-9]/g, '')}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.9" />
          <stop offset="70%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </radialGradient>
      </defs>

      {/* 1. Ossos */}
      <g className="stick-bones">{renderBones()}</g>

      {/* 2. Cabeça */}
      <circle
        cx={head.x}
        cy={head.y}
        r={16}
        fill={`url(#headGlow-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
        stroke="#000000"
        strokeWidth={2}
        style={{
          filter: `drop-shadow(0 0 8px ${glowColor})`,
        }}
      />

      {/* Indicador de olhar (direção da cabeça) */}
      <circle cx={head.x + 6} cy={head.y - 2} r={3} fill="#000000" />
      <circle cx={head.x + 7} cy={head.y - 3} r={1} fill="#ffffff" />

      {/* 3. Juntas */}
      <g className="stick-joints">{renderJoints()}</g>
    </svg>
  );
};
