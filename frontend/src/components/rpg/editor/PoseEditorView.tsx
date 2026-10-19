import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Save,
  Plus,
  Trash2,
  Crosshair,
  Sliders,
  Eye,
  Swords,
  Layers,
  ArrowRight,
  Shield,
  Zap,
} from 'lucide-react';
import {
  ActionName,
  CharacterManifest,
  DefaultRigConfig,
  JointName,
  RigPose,
  AnimationFrame,
} from '../animation/types.js';
import { StickFigure } from '../animation/StickFigure.js';
import { CharacterFighter } from '../animation/CharacterFighter.js';

const ALL_CHARACTERS = [
  { id: 'doutor_promessa', name: 'Doutor Promessa' },
  { id: 'dona_reforma', name: 'Dona Reforma' },
  { id: 'capitao_palanque', name: 'Capitão Palanque' },
  { id: 'lobista_sombrio', name: 'Lobista Sombrio' },
  { id: 'ex_tudo', name: 'O Ex-Tudo' },
  { id: 'militante_convicto', name: 'Militante Convicto' },
  { id: 'tecnocrata_frio', name: 'Tecnocrata Frio' },
];

const ALL_ACTIONS: ActionName[] = [
  'idle',
  'punch',
  'kick',
  'charge',
  'block',
  'dodge',
  'counter',
  'hit',
  'special',
  'summon',
  'ally_enter',
  'combo_punch',
  'buff',
  'debuff',
  'stunned',
  'taunt',
  'ko',
  'victory',
];

const ALL_JOINTS: JointName[] = [
  'head',
  'neck',
  'shoulder_l',
  'shoulder_r',
  'elbow_l',
  'elbow_r',
  'hand_l',
  'hand_r',
  'hip',
  'knee_l',
  'knee_r',
  'foot_l',
  'foot_r',
];

export const PoseEditorView: React.FC = () => {
  const [selectedCharId, setSelectedCharId] = useState<string>('doutor_promessa');
  const [selectedAction, setSelectedAction] = useState<ActionName>('punch');
  const [defaultRig, setDefaultRig] = useState<DefaultRigConfig | null>(null);
  const [manifest, setManifest] = useState<CharacterManifest | null>(null);

  // Estado da timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);

  // Configurações visuais de edição
  const [skeletonOpacity, setSkeletonOpacity] = useState<number>(0.7);
  const [selectedJoint, setSelectedJoint] = useState<JointName | null>('hand_r');
  const [simulatingAttack, setSimulatingAttack] = useState<boolean>(false);
  const [simulatedDistance, setSimulatedDistance] = useState<number>(300);

  // Arraste de articulação
  const [isDraggingJoint, setIsDraggingJoint] = useState<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animationReqRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // 1. Carregar Rig Mestre e Manifesto do Personagem
  useEffect(() => {
    async function loadRigAndManifest() {
      try {
        const rigRes = await axios.get('/rpg/poses/default_rig.json');
        setDefaultRig(rigRes.data);

        const manifestRes = await axios.get(`/rpg/characters/${selectedCharId}/manifest.json`);
        setManifest(manifestRes.data);
      } catch (err) {
        console.error('Erro ao carregar dados do editor de poses:', err);
      }
    }
    loadRigAndManifest();
  }, [selectedCharId]);

  // Ação atual ativa
  const currentActionConfig =
    manifest?.actions?.[selectedAction] ||
    defaultRig?.actions?.[selectedAction] ||
    defaultRig?.actions?.['idle'];

  const frames: AnimationFrame[] = currentActionConfig?.frames || [];
  const currentFrame = frames[selectedFrameIndex] || frames[0];
  const currentPoseName = currentFrame?.pose || 'guard';
  const currentPose: RigPose = defaultRig?.poses?.[currentPoseName] || {
    head: { x: 70, y: 40 },
    neck: { x: 70, y: 60 },
    shoulder_l: { x: 50, y: 75 },
    shoulder_r: { x: 90, y: 75 },
    elbow_l: { x: 40, y: 105 },
    elbow_r: { x: 100, y: 105 },
    hand_l: { x: 45, y: 125 },
    hand_r: { x: 105, y: 125 },
    hip: { x: 70, y: 130 },
    knee_l: { x: 55, y: 170 },
    knee_r: { x: 85, y: 170 },
    foot_l: { x: 50, y: 210 },
    foot_r: { x: 90, y: 210 },
  };

  // Loop de Reprodução da Timeline (Play/Pause)
  useEffect(() => {
    if (!isPlaying) {
      if (animationReqRef.current) cancelAnimationFrame(animationReqRef.current);
      lastTimeRef.current = null;
      return;
    }

    const duration = frames.length > 0 ? frames[frames.length - 1].t : 1000;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) * playbackSpeed;
      lastTimeRef.current = timestamp;

      setCurrentTimeMs((prev) => {
        const nextTime = prev + delta;
        if (nextTime >= duration) {
          return 0; // Loop contínuo para avaliação
        }
        return nextTime;
      });

      animationReqRef.current = requestAnimationFrame(animate);
    };

    animationReqRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationReqRef.current) cancelAnimationFrame(animationReqRef.current);
    };
  }, [isPlaying, frames, playbackSpeed]);

  // Arrastar junta com o mouse
  const handleJointMouseDown = (joint: JointName, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedJoint(joint);
    setIsDraggingJoint(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingJoint || !selectedJoint || !canvasRef.current || !defaultRig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 140 / rect.width;
    const scaleY = 220 / rect.height;

    const mouseX = Math.round((e.clientX - rect.left) * scaleX);
    const mouseY = Math.round((e.clientY - rect.top) * scaleY);

    // Atualizar posição da junta no rig mestre em memória
    setDefaultRig((prev) => {
      if (!prev) return prev;
      const updatedPoses = { ...prev.poses };
      const poseToEdit = { ...updatedPoses[currentPoseName] };
      poseToEdit[selectedJoint] = { x: mouseX, y: mouseY };
      updatedPoses[currentPoseName] = poseToEdit;
      return { ...prev, poses: updatedPoses };
    });
  };

  const handleMouseUp = () => {
    setIsDraggingJoint(false);
  };

  // Alterar Ponto de Impacto
  const handleSetImpactPoint = (joint: JointName) => {
    if (!manifest) return;
    setManifest((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: {
          ...prev.actions,
          [selectedAction]: {
            ...prev.actions[selectedAction],
            impactPoint: joint,
          },
        },
      };
    });
  };

  // Exportar Manifest e Rig para Download
  const handleExportJson = () => {
    if (!manifest || !defaultRig) return;

    const manifestData = JSON.stringify(manifest, null, 2);
    const blob = new Blob([manifestData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manifest_${selectedCharId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportRig = () => {
    if (!defaultRig) return;
    const rigData = JSON.stringify(defaultRig, null, 2);
    const blob = new Blob([rigData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'default_rig.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans select-none overflow-x-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. BARRA SUPERIOR (HEADER & CONTROLES) */}
      <header className="h-16 px-6 bg-[#0e131f] border-b border-white/10 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-600 flex items-center justify-center shadow-lg">
            <Swords className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide uppercase flex items-center gap-2">
              Editor de Poses & Coreografia
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                ADMIN v2.0
              </span>
            </h1>
            <p className="text-xs text-gray-400">Alinhamento de PNG sobre Boneco de Palito (SVG)</p>
          </div>
        </div>

        {/* Seletores de Personagem e Ação */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-xs text-gray-400">Personagem:</span>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-emerald-400 outline-none cursor-pointer"
            >
              {ALL_CHARACTERS.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#121620] text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-xs text-gray-400">Ação:</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as ActionName)}
              className="bg-transparent text-sm font-semibold text-cyan-400 outline-none cursor-pointer"
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a} className="bg-[#121620] text-white">
                  {a.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold transition shadow-lg"
          >
            <Download className="w-4 h-4" /> Exportar Manifest
          </button>

          <button
            onClick={handleExportRig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold transition shadow-lg"
          >
            <Save className="w-4 h-4" /> Exportar Rig
          </button>
        </div>
      </header>

      {/* 2. ÁREA DE TRABALHO PRINCIPAL (SPLIT VIEW) */}
      <div className="flex-1 flex overflow-hidden">
        {/* PAINEL LATERAL ESQUERDO: CONTROLES DO PNG & ARTICULAÇÃO */}
        <aside className="w-80 bg-[#0c101a] border-r border-white/10 p-4 flex flex-col gap-5 overflow-y-auto">
          {/* Opacidade do Esqueleto */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" /> Opacidade do Palito:
              </span>
              <span className="font-mono text-emerald-400">{Math.round(skeletonOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={skeletonOpacity}
              onChange={(e) => setSkeletonOpacity(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Deslize para ver o PNG com o esqueleto sobreposto para alinhar articulações.
            </p>
          </div>

          {/* Articulação Selecionada */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-cyan-400" /> Articulação Ativa:
              </span>
              <span className="font-mono text-cyan-300 uppercase">{selectedJoint || 'NENHUMA'}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {ALL_JOINTS.map((joint) => (
                <button
                  key={joint}
                  onClick={() => setSelectedJoint(joint)}
                  className={`px-2 py-1 rounded text-[11px] font-mono text-left transition ${
                    selectedJoint === joint
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'bg-black/30 text-gray-400 hover:text-white'
                  }`}
                >
                  {joint}
                </button>
              ))}
            </div>

            {selectedJoint && currentPose[selectedJoint] && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-white/5 text-xs font-mono">
                <span className="text-gray-400">
                  X: <b className="text-white">{currentPose[selectedJoint].x}px</b>
                </span>
                <span className="text-gray-400">
                  Y: <b className="text-white">{currentPose[selectedJoint].y}px</b>
                </span>
                <span className="text-[10px] text-gray-500 ml-auto self-center">(Arraste no canvas)</span>
              </div>
            )}
          </div>

          {/* Ponto de Impacto */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-xs font-semibold mb-2 text-gray-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Ponto de Impacto do Golpe:
            </div>
            <select
              value={currentActionConfig?.impactPoint || 'hand_r'}
              onChange={(e) => handleSetImpactPoint(e.target.value as JointName)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs font-mono text-amber-400 outline-none cursor-pointer"
            >
              {ALL_JOINTS.map((j) => (
                <option key={j} value={j}>
                  {j} (articulação)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              É onde os efeitos visuais de faísca e impacto aparecerão.
            </p>
          </div>

          {/* Botão de Simulação de Ataque */}
          <button
            onClick={() => setSimulatingAttack(!simulatingAttack)}
            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg ${
              simulatingAttack
                ? 'bg-amber-600 text-white'
                : 'bg-white/10 hover:bg-white/15 text-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" /> {simulatingAttack ? 'Ocultar Oponente Alvo' : 'Simular Alvo Fictício'}
          </button>
        </aside>

        {/* CANVÁS CENTRAL: VISUALIZAÇÃO INTERATIVA COM GRADE */}
        <main className="flex-1 flex flex-col bg-[#07090e] relative overflow-hidden">
          {/* Grade de fundo (Grid Arena) */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Linha do chão da Arena */}
          <div className="absolute inset-x-0 bottom-24 border-b-2 border-emerald-500/30 pointer-events-none" />

          {/* PALCO DE LUTA / CANVÁS DO PERSONAGEM */}
          <div className="flex-1 flex items-center justify-center relative">
            {/* Lutador em Edição */}
            <div
              ref={canvasRef}
              className="relative w-[280px] h-[440px] border border-cyan-500/20 bg-black/30 rounded-3xl p-4 flex items-center justify-center shadow-2xl"
              style={{
                transform: 'scale(1.2)',
              }}
            >
              {defaultRig && (
                <CharacterFighter
                  side="p1"
                  characterId={selectedCharId}
                  characterName={manifest?.name || selectedCharId}
                  action={selectedAction}
                  actionTimeMs={isPlaying ? currentTimeMs : currentFrame?.t || 0}
                  manifest={manifest}
                  defaultRig={defaultRig}
                  skeletonOpacity={skeletonOpacity}
                  showDebugSkeleton={true}
                  className="w-full h-full"
                />
              )}

              {/* Camada interativa do boneco de palito para arrastar juntas */}
              <div className="absolute inset-0 p-4 pointer-events-none">
                <StickFigure
                  pose={currentPose}
                  color="#39ff14"
                  glowColor="rgba(57,255,20,0.6)"
                  opacity={skeletonOpacity}
                  selectedJoint={selectedJoint}
                  interactive={true}
                  onJointMouseDown={handleJointMouseDown}
                  className="w-full h-full pointer-events-auto"
                />
              </div>
            </div>

            {/* Oponente Fictício para teste de alcance */}
            {simulatingAttack && (
              <div
                className="absolute flex flex-col items-center opacity-85 transition-all"
                style={{
                  left: `calc(50% + ${simulatedDistance}px)`,
                }}
              >
                <div className="w-[140px] h-[220px] rounded-2xl border-2 border-dashed border-red-500/60 bg-red-950/20 flex flex-col items-center justify-center text-center p-3 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                  <span className="text-3xl mb-2">🎯</span>
                  <span className="text-xs font-mono font-bold text-red-400 uppercase">Alvo de Teste</span>
                  <span className="text-[10px] text-gray-400 mt-1">Distância: {simulatedDistance}px</span>
                </div>
                {/* Sombra do alvo */}
                <div className="w-24 h-4 rounded-full bg-black/60 blur-xs mt-2" />
              </div>
            )}
          </div>

          {/* 3. BARRA INFERIOR: TIMELINE E REPRODUÇÃO */}
          <div className="h-28 bg-[#0c101a] border-t border-white/10 px-6 flex flex-col justify-center gap-2 shadow-2xl z-20">
            {/* Controles de Play, Velocidade e Adicionar Frame */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition shadow-lg ${
                    isPlaying ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTimeMs(0);
                    setSelectedFrameIndex(0);
                  }}
                  className="p-2 rounded-lg bg-black/40 hover:bg-black/60 text-gray-300 border border-white/5"
                  title="Reiniciar timeline"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Seletor de Velocidade */}
                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                  {[0.25, 0.5, 1.0, 2.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-xs font-mono transition ${
                        playbackSpeed === spd ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <span className="text-xs font-mono text-gray-400 ml-2">
                  Tempo: <b className="text-white">{Math.round(currentTimeMs)}ms</b>
                </span>
              </div>

              {/* Botões de Manipulação de Quadros */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 mr-2">
                  Quadro {selectedFrameIndex + 1} de {frames.length || 1} ({currentPoseName})
                </span>
              </div>
            </div>

            {/* Marcadores de Quadros da Timeline */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {frames.map((frame, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedFrameIndex(idx);
                    setCurrentTimeMs(frame.t);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap transition flex items-center gap-1.5 ${
                    selectedFrameIndex === idx
                      ? 'bg-emerald-600 border-emerald-400 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : frame.impact
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                      : 'bg-black/50 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>{frame.t}ms</span>
                  <span className="text-[10px] opacity-75">({frame.pose})</span>
                  {frame.impact && <span className="text-amber-400 text-xs">💥</span>}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
