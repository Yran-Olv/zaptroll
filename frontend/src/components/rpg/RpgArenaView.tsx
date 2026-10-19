import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import {
  Shield,
  Zap,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Users,
  Flame,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { rpgAudio } from '../../utils/rpgAudio.js';

interface CardData {
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
}

interface ParticipantData {
  id: string;
  name: string;
  phone?: string;
  isBot: boolean;
  characterId: string;
  characterName: string;
  characterTitle?: string;
  characterClass?: string;
  affinity?: string;
  weakness?: string;
  resistance?: string;
  avatarEmoji: string;
  passiveName?: string;
  passiveDescription?: string;
  maxHp: number;
  currentHp: number;
  maxEnergy: number;
  currentEnergy: number;
  popularity: number;
  rage: number;
  cardLocked: boolean;
  selectedCardId?: string | null;
  activeStatuses: any[];
  handCount: number;
  hand: CardData[];
}

interface BattleData {
  id: string;
  mode: string;
  status: string;
  arena: string;
  currentTurn: number;
  maxTurns: number;
  turnDeadline: string;
  winnerPlayerId: string | null;
}

interface RpgArenaProps {
  battleId: string;
  token: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  forca: { bg: 'bg-red-950/70', border: 'border-red-500', text: 'text-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]' },
  defesa: { bg: 'bg-blue-950/70', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]' },
  estrategia: { bg: 'bg-purple-950/70', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]' },
  utilidade: { bg: 'bg-amber-950/70', border: 'border-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]' },
};

export const RpgArenaView: React.FC<RpgArenaProps> = ({ battleId, token }) => {
  const [battle, setBattle] = useState<BattleData | null>(null);
  const [p1, setP1] = useState<ParticipantData | null>(null);
  const [p2, setP2] = useState<ParticipantData | null>(null);
  const [viewerRole, setViewerRole] = useState<'fighter' | 'spectator'>('spectator');
  const [myPhone, setMyPhone] = useState<string | null>(null);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [floatingDamage, setFloatingDamage] = useState<{ id: number; text: string; target: 'p1' | 'p2'; isCrit?: boolean }[]>([]);

  const socketRef = useRef<Socket | null>(null);

  // Toggle Som
  const toggleAudio = () => {
    rpgAudio.enabled = !rpgAudio.enabled;
    setAudioMuted(!rpgAudio.enabled);
  };

  // Carregar dados da batalha
  const fetchBattle = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/rpg/batalha/${battleId}`, {
        params: { t: token },
      });

      const data = res.data;
      setBattle(data.battle);
      setViewerRole(data.viewer?.role || 'spectator');
      setMyPhone(data.viewer?.phone || null);

      if (data.participants && data.participants.length >= 2) {
        setP1(data.participants[0]);
        setP2(data.participants[1]);
      }

      if (data.recentTurns && data.recentTurns.length > 0) {
        const summaries: string[] = [];
        data.recentTurns.forEach((t: any) => {
          if (t.logSummary && t.logSummary.length) {
            summaries.push(`--- Turno ${t.turnNumber} ---`);
            summaries.push(...t.logSummary);
          }
        });
        setCombatLogs(summaries);
      }
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar arena de combate.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBattle();

    // Conectar ao Socket.IO da batalha
    const s = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log('⚡ Conectado ao servidor da arena.');
    });

    s.on('battle:card_locked', (payload: any) => {
      rpgAudio.playCardSelect();
      setP1((prev) => (prev && prev.id === payload.participantId ? { ...prev, cardLocked: true } : prev));
      setP2((prev) => (prev && prev.id === payload.participantId ? { ...prev, cardLocked: true } : prev));
    });

    s.on('battle:turn_resolved', (payload: any) => {
      // Tocar sons de impacto
      rpgAudio.playGavel();
      setTimeout(() => rpgAudio.playHit(), 300);

      // Atualizar logs
      if (payload.logSummary) {
        setCombatLogs((prev) => [...prev, `--- Turno ${payload.currentTurn} ---`, ...payload.logSummary]);
      }

      // Adicionar número flutuante de dano animado
      if (payload.events) {
        payload.events.forEach((ev: any, idx: number) => {
          if (ev.damage > 0) {
            setTimeout(() => {
              if (ev.isCrit) rpgAudio.playCrit();
              setFloatingDamage((fd) => [
                ...fd,
                {
                  id: Date.now() + idx,
                  text: `${ev.isCrit ? '💥 CRÍTICO! ' : ''}-${ev.damage} HP`,
                  target: ev.targetFighterId === payload.p1.id ? 'p1' : 'p2',
                  isCrit: ev.isCrit,
                },
              ]);
            }, idx * 400);
          }
        });
      }

      // Atualizar participantes
      setP1((prev) => (prev ? { ...prev, ...payload.p1, cardLocked: false } : null));
      setP2((prev) => (prev ? { ...prev, ...payload.p2, cardLocked: false } : null));
      setSelectedCardId(null);

      // Atualizar batalha
      setBattle((b) => (b ? { ...b, currentTurn: payload.currentTurn, status: payload.status } : null));

      if (payload.winner && payload.winner !== 'none') {
        setTimeout(() => rpgAudio.playVictory(), 1000);
      }
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
    };
  }, [battleId, token]);

  // Limpar danos flutuantes após animação
  useEffect(() => {
    if (floatingDamage.length > 0) {
      const timer = setTimeout(() => {
        setFloatingDamage((prev) => prev.slice(1));
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [floatingDamage]);

  // Jogar / Travar carta selecionada
  const handleLockCard = async () => {
    if (!selectedCardId || isLocking || !battle) return;

    try {
      setIsLocking(true);
      rpgAudio.playCardSelect();
      const res = await axios.post(
        `/api/rpg/batalha/${battleId}/jogar`,
        { cardId: selectedCardId },
        { params: { t: token } }
      );

      if (res.data.success) {
        // Atualizar estado local
        if (p1 && myPhone === p1.phone) {
          setP1({ ...p1, cardLocked: true });
        } else if (p2 && myPhone === p2.phone) {
          setP2({ ...p2, cardLocked: true });
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao travar carta.');
    } finally {
      setIsLocking(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#07090e] text-white font-sans p-6">
        <div className="w-16 h-16 rounded-2xl bg-[#121620] border-2 border-emerald-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce mb-4">
          <Swords className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-sm font-mono tracking-widest text-emerald-400 uppercase">Entrando na Arena Parlamentar...</p>
      </div>
    );
  }

  if (error || !battle || !p1 || !p2) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#07090e] text-white p-6 text-center">
        <AlertTriangle className="w-14 h-14 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Acesso Não Autorizado</h2>
        <p className="text-sm text-gray-400 max-w-sm mb-6">{error || 'Batalha não encontrada.'}</p>
        <button
          onClick={fetchBattle}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition shadow-lg"
        >
          <RotateCcw className="w-4 h-4" /> Tentar Novamente
        </button>
      </div>
    );
  }

  // Identificar qual participante é o usuário atual
  const myParticipant = myPhone === p1.phone ? p1 : myPhone === p2.phone ? p2 : null;
  const isMyTurnLocked = myParticipant?.cardLocked || false;

  return (
    <div className="min-h-screen w-screen bg-[#07090e] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* 1. TOPO: HEADER DA ARENA & CONTROLES */}
      <header className="w-full bg-[#0d111a]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs tracking-wider text-emerald-400 uppercase">
                Zaptroll RPG // Arena Oficial
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-gray-300">
                Turno {battle.currentTurn} / {battle.maxTurns}
              </span>
            </div>
            <h1 className="text-sm font-bold text-gray-200 truncate max-w-xs md:max-w-md">
              {p1.name} <span className="text-emerald-400">vs</span> {p2.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewerRole === 'spectator' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-[11px] text-purple-300">
              <Users className="w-3 h-3" /> Espectador
            </span>
          )}

          <button
            onClick={toggleAudio}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
            title="Alternar Áudio"
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-gray-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* 2. RINGUE / PALCO 2.5D COM OS DOIS LUTADORES */}
      <main className="flex-1 relative flex flex-col justify-between p-4 md:p-8 overflow-hidden">
        {/* Fundo do Ringue com Grid Isométrico & Iluminação */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600 via-transparent to-transparent" />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Efeitos Flutuantes de Dano */}
        {floatingDamage.map((d) => (
          <div
            key={d.id}
            className={`absolute z-30 font-black text-2xl md:text-3xl animate-bounce drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${
              d.target === 'p1' ? 'left-1/4 top-1/3' : 'right-1/4 top-1/3'
            } ${d.isCrit ? 'text-amber-400 scale-125' : 'text-red-500'}`}
          >
            {d.text}
          </div>
        ))}

        {/* ÁREA DOS LUTADORES (P1 à esquerda, P2 à direita) */}
        <div className="relative z-10 grid grid-cols-2 gap-4 md:gap-12 w-full max-w-5xl mx-auto my-auto items-center">
          {/* LUTADOR 1 (ESQUERDA) */}
          <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur shadow-2xl relative">
            {p1.cardLocked && (
              <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-xs font-bold animate-pulse">
                🔒 Carta Pronta
              </span>
            )}

            <div className="relative mb-3">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-tr from-[#141b26] to-[#1f2a3a] border-2 border-emerald-500/50 flex items-center justify-center text-5xl md:text-6xl shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-pulse">
                {p1.avatarEmoji}
              </div>
              <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] uppercase font-bold shadow">
                {p1.affinity || 'Retórica'}
              </span>
            </div>

            <h2 className="font-extrabold text-base md:text-lg text-white truncate max-w-full">{p1.name}</h2>
            <p className="text-xs text-emerald-400/90 font-medium">{p1.characterName}</p>

            {/* Barra de Vida (HP) */}
            <div className="w-full mt-3">
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> HP
                </span>
                <span className="font-bold text-emerald-300">
                  {p1.currentHp} / {p1.maxHp}
                </span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    p1.currentHp / p1.maxHp < 0.25
                      ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
                      : p1.currentHp / p1.maxHp < 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (p1.currentHp / p1.maxHp) * 100))}%` }}
                />
              </div>
            </div>

            {/* Barra de Energia */}
            <div className="w-full mt-2">
              <div className="flex justify-between text-[11px] mb-1 font-mono">
                <span className="text-gray-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> Energia
                </span>
                <span className="text-cyan-300 font-bold">
                  {p1.currentEnergy} / {p1.maxEnergy}
                </span>
              </div>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: p1.maxEnergy }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      idx < p1.currentEnergy ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Ibope / Popularidade */}
            <div className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
              <span className="text-gray-400">Ibope:</span>
              <span className="text-yellow-400 font-bold">📊 {p1.popularity}%</span>
            </div>
          </div>

          {/* LUTADOR 2 (DIREITA) */}
          <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur shadow-2xl relative">
            {p2.cardLocked && (
              <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-xs font-bold animate-pulse">
                🔒 Carta Pronta
              </span>
            )}

            <div className="relative mb-3">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-tr from-[#1f1414] to-[#3a1f1f] border-2 border-red-500/50 flex items-center justify-center text-5xl md:text-6xl shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse">
                {p2.avatarEmoji}
              </div>
              <span className="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-md bg-red-600 text-white font-mono text-[10px] uppercase font-bold shadow">
                {p2.affinity || 'Povão'}
              </span>
            </div>

            <h2 className="font-extrabold text-base md:text-lg text-white truncate max-w-full">{p2.name}</h2>
            <p className="text-xs text-red-400/90 font-medium">{p2.characterName}</p>

            {/* Barra de Vida (HP) */}
            <div className="w-full mt-3">
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-red-400" /> HP
                </span>
                <span className="font-bold text-red-300">
                  {p2.currentHp} / {p2.maxHp}
                </span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    p2.currentHp / p2.maxHp < 0.25
                      ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
                      : p2.currentHp / p2.maxHp < 0.5
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (p2.currentHp / p2.maxHp) * 100))}%` }}
                />
              </div>
            </div>

            {/* Barra de Energia */}
            <div className="w-full mt-2">
              <div className="flex justify-between text-[11px] mb-1 font-mono">
                <span className="text-gray-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> Energia
                </span>
                <span className="text-cyan-300 font-bold">
                  {p2.currentEnergy} / {p2.maxEnergy}
                </span>
              </div>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: p2.maxEnergy }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      idx < p2.currentEnergy ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Ibope / Popularidade */}
            <div className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
              <span className="text-gray-400">Ibope:</span>
              <span className="text-yellow-400 font-bold">📊 {p2.popularity}%</span>
            </div>
          </div>
        </div>

        {/* FEED DE RESUMO / REPLAY DO COMBATE */}
        {combatLogs.length > 0 && (
          <div className="relative z-10 w-full max-w-xl mx-auto my-3 max-h-24 overflow-y-auto rounded-xl bg-black/60 border border-white/10 p-2.5 text-xs font-mono text-gray-300 space-y-1">
            {combatLogs.slice(-4).map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 3. DOCK INFERIOR: CARTAS NA MÃO DO JOGADOR (SE FOR PARTICIPANTE) */}
      <footer className="w-full bg-[#0d111a]/95 backdrop-blur border-t border-white/10 p-4 z-20">
        <div className="max-w-4xl mx-auto">
          {myParticipant && myParticipant.hand && myParticipant.hand.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-gray-300 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Suas Cartas na Mão
                </span>
                {isMyTurnLocked ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> Carta travada! Aguardando oponente...
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 font-mono">
                    Energia disponível: <span className="text-cyan-400 font-bold">{myParticipant.currentEnergy}</span>
                  </span>
                )}
              </div>

              {/* Grid / Carrossel de Cartas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {myParticipant.hand.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  const canAfford = myParticipant.currentEnergy >= card.energyCost;
                  const col = CATEGORY_COLORS[card.category] || CATEGORY_COLORS.forca;

                  return (
                    <button
                      key={card.id}
                      disabled={isMyTurnLocked || !canAfford}
                      onClick={() => setSelectedCardId(card.id)}
                      className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                        col.bg
                      } ${isSelected ? `${col.border} ${col.glow} scale-105 ring-2 ring-emerald-400` : 'border-white/10 hover:border-white/30'} ${
                        !canAfford || isMyTurnLocked ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-2xl">{card.emoji}</span>
                          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
                            <Zap className="w-2.5 h-2.5" /> {card.energyCost}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-white leading-tight line-clamp-1">{card.name}</h4>
                        {card.description && (
                          <p className="text-[10px] text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                            {card.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-400">Poder: {card.power}</span>
                        <span className="text-gray-400">Prioridade: {card.priority}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Botão de Confirmação */}
              {!isMyTurnLocked && (
                <div className="flex justify-end mt-1">
                  <button
                    disabled={!selectedCardId || isLocking}
                    onClick={handleLockCard}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Swords className="w-4 h-4" /> Travar Jogada do Turno
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-2 text-sm text-gray-400 font-mono">
              👓 Você está assistindo a esta luta como espectador ao vivo.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default RpgArenaView;
