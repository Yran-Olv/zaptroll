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
  ThumbsUp,
  Award,
  FastForward,
  Bone,
} from 'lucide-react';
import { rpgAudio } from '../../utils/rpgAudio.js';
import { CharacterFighter } from './animation/CharacterFighter.js';
import {
  AnimationDirector,
  TurnResolutionPayload,
} from './animation/AnimationDirector.js';
import {
  ArenaFighterVisualState,
  CharacterManifest,
  DefaultRigConfig,
  ImpactEffectType,
} from './animation/types.js';
import { arenaToScreen } from './animation/arenaMath.js';
import {
  CombatVfx,
  HitEffectInstance,
  FloatingNumberInstance,
} from './effects/CombatVfx.js';
import { SpecialBanner } from './effects/SpecialBanner.js';

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
  playerId?: string | null;
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
  accessCode?: string;
  battleId?: string;
  token?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  forca: { bg: 'bg-red-950/70', border: 'border-red-500', text: 'text-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]' },
  defesa: { bg: 'bg-blue-950/70', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]' },
  estrategia: { bg: 'bg-purple-950/70', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]' },
  utilidade: { bg: 'bg-amber-950/70', border: 'border-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]' },
};

export const RpgArenaView: React.FC<RpgArenaProps> = ({ accessCode, battleId: initialBattleId, token }) => {
  const [battle, setBattle] = useState<BattleData | null>(null);
  const [p1, setP1] = useState<ParticipantData | null>(null);
  const [p2, setP2] = useState<ParticipantData | null>(null);
  const [viewerRole, setViewerRole] = useState<'fighter' | 'spectator'>('spectator');
  const [myPhone, setMyPhone] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [floatingDamage, setFloatingDamage] = useState<{ id: number; text: string; target: 'p1' | 'p2'; isCrit?: boolean }[]>([]);

  // Estado do Sistema de Animação e Poses
  const [defaultRig, setDefaultRig] = useState<DefaultRigConfig | null>(null);
  const [p1Manifest, setP1Manifest] = useState<CharacterManifest | null>(null);
  const [p2Manifest, setP2Manifest] = useState<CharacterManifest | null>(null);

  const [p1Visual, setP1Visual] = useState<ArenaFighterVisualState | null>(null);
  const [p2Visual, setP2Visual] = useState<ArenaFighterVisualState | null>(null);

  const [hitEffects, setHitEffects] = useState<HitEffectInstance[]>([]);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumberInstance[]>([]);
  const [specialBannerInfo, setSpecialBannerInfo] = useState<{
    characterName: string;
    avatarEmoji?: string;
    attackName: string;
    side: 'p1' | 'p2';
  } | null>(null);

  const [screenShake, setScreenShake] = useState<number>(0);
  const [showSkeletonDebug, setShowSkeletonDebug] = useState<boolean>(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'skeleton';
  });
  const [skeletonOpacity, setSkeletonOpacity] = useState<number>(0.65);
  const [lastTurnPayload, setLastTurnPayload] = useState<TurnResolutionPayload | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const directorRef = useRef<AnimationDirector | null>(null);
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);

  // Toggle Som
  const toggleAudio = () => {
    rpgAudio.enabled = !rpgAudio.enabled;
    setAudioMuted(!rpgAudio.enabled);
  };

  // Carregar Rig Mestre e Manifestos dos Lutadores
  useEffect(() => {
    async function loadRig() {
      try {
        const rigRes = await axios.get('/rpg/poses/default_rig.json');
        setDefaultRig(rigRes.data);
      } catch (err) {
        console.error('Erro ao carregar default_rig.json:', err);
      }
    }
    loadRig();
  }, []);

  useEffect(() => {
    if (!p1 || !p2) return;
    const char1Id = p1.characterId;
    const char2Id = p2.characterId;

    async function loadManifests() {
      try {
        const [m1, m2] = await Promise.allSettled([
          axios.get(`/rpg/characters/${char1Id}/manifest.json`),
          axios.get(`/rpg/characters/${char2Id}/manifest.json`),
        ]);

        if (m1.status === 'fulfilled') {
          setP1Manifest(m1.value.data);
          // Pré-carregar imagens do personagem P1
          preloadCharacterImages(char1Id, m1.value.data);
        }
        if (m2.status === 'fulfilled') {
          setP2Manifest(m2.value.data);
          // Pré-carregar imagens do personagem P2
          preloadCharacterImages(char2Id, m2.value.data);
        }
      } catch (err) {
        console.warn('Erro ao carregar manifestos dos personagens:', err);
      }
    }
    loadManifests();
  }, [p1?.characterId, p2?.characterId]);

  // Função utilitária para pré-carregar PNGs e decodificá-los na GPU
  const preloadCharacterImages = (charId: string, manifestData: CharacterManifest) => {
    if (typeof window === 'undefined') return;
    const actions = manifestData.actions || {};
    Object.values(actions).forEach((act) => {
      const pngFile = act.png;
      if (pngFile) {
        const img = new Image();
        img.src = `/rpg/characters/${charId}/${pngFile}`;
        if (img.decode) {
          img.decode().catch(() => {});
        }
      }
    });
  };

  // Inicializar / Sincronizar estado visual dos lutadores
  useEffect(() => {
    if (!p1 || !p2) return;

    setP1Visual((prev) => {
      if (prev && prev.characterId === p1.characterId) {
        return {
          ...prev,
          currentHp: p1.currentHp,
          maxHp: p1.maxHp,
          currentEnergy: p1.currentEnergy,
          maxEnergy: p1.maxEnergy,
          popularity: p1.popularity,
          name: p1.name,
        };
      }
      return {
        side: 'p1',
        name: p1.name,
        characterId: p1.characterId,
        characterName: p1.characterName,
        avatarEmoji: p1.avatarEmoji,
        maxHp: p1.maxHp,
        currentHp: p1.currentHp,
        displayedHp: p1.currentHp,
        maxEnergy: p1.maxEnergy,
        currentEnergy: p1.currentEnergy,
        popularity: p1.popularity,
        action: 'idle',
        actionTimeMs: 0,
        x: 240,
        y: 350,
        baseX: 240,
        baseY: 350,
        flipX: false,
        isHit: false,
        isGuarding: false,
        activeStatuses: p1.activeStatuses || [],
      };
    });

    setP2Visual((prev) => {
      if (prev && prev.characterId === p2.characterId) {
        return {
          ...prev,
          currentHp: p2.currentHp,
          maxHp: p2.maxHp,
          currentEnergy: p2.currentEnergy,
          maxEnergy: p2.maxEnergy,
          popularity: p2.popularity,
          name: p2.name,
        };
      }
      return {
        side: 'p2',
        name: p2.name,
        characterId: p2.characterId,
        characterName: p2.characterName,
        avatarEmoji: p2.avatarEmoji,
        maxHp: p2.maxHp,
        currentHp: p2.currentHp,
        displayedHp: p2.currentHp,
        maxEnergy: p2.maxEnergy,
        currentEnergy: p2.currentEnergy,
        popularity: p2.popularity,
        action: 'idle',
        actionTimeMs: 0,
        x: 760,
        y: 350,
        baseX: 760,
        baseY: 350,
        flipX: true,
        isHit: false,
        isGuarding: false,
        activeStatuses: p2.activeStatuses || [],
      };
    });
  }, [p1, p2]);

  // Inicializar o Diretor de Animação
  useEffect(() => {
    if (!p1Visual || !p2Visual) return;

    directorRef.current = new AnimationDirector(p1Visual, p2Visual, {
      onUpdateFighters: (updatedP1, updatedP2) => {
        setP1Visual(updatedP1);
        setP2Visual(updatedP2);
      },
      onScreenShake: (intensity) => {
        setScreenShake(intensity);
        setTimeout(() => setScreenShake(0), 280);
      },
      onHitEffect: (x, y, type) => {
        const id = `${Date.now()}-${Math.random()}`;
        setHitEffects((prev) => [...prev, { id, x, y, type, createdAt: Date.now() }]);
        setTimeout(() => {
          setHitEffects((prev) => prev.filter((h) => h.id !== id));
        }, 650);
      },
      onFloatingNumber: (x, y, text, type) => {
        const id = `${Date.now()}-${Math.random()}`;
        setFloatingNumbers((prev) => [...prev, { id, x, y, text, type, createdAt: Date.now() }]);
        setTimeout(() => {
          setFloatingNumbers((prev) => prev.filter((fn) => fn.id !== id));
        }, 1300);
      },
      onSpecialBanner: (info) => {
        setSpecialBannerInfo(info);
      },
      onTurnFinished: () => {
        // Conclusão limpa
      },
    });

    return () => {
      directorRef.current?.destroy();
    };
  }, [p1?.id, p2?.id]);

  // Pular animação do turno
  const handleSkipAnimation = () => {
    if (directorRef.current && lastTurnPayload) {
      directorRef.current.skip(lastTurnPayload);
    }
  };

  // Carregar dados da batalha (Suporta /a/{codigo} e link legado /rpg/batalha/{id})
  const fetchBattle = async () => {
    try {
      setLoading(true);

      let res: any;
      if (accessCode) {
        res = await axios.get(`/api/rpg/a/${accessCode}`);
      } else {
        const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const urlToken = searchParams.get('t') || token || '';
        const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('rpg_phone') || '' : '';
        const urlPhone = searchParams.get('p') || searchParams.get('phone') || savedPhone || '';

        res = await axios.get(`/api/rpg/batalha/${initialBattleId}`, {
          params: {
            t: urlToken || undefined,
            p: urlPhone || undefined,
          },
        });
      }

      const data = res.data;
      setBattle(data.battle);
      setViewerRole(data.viewer?.role || 'spectator');
      if (data.viewer?.participantId) {
        setMyParticipantId(data.viewer.participantId);
      }

      const resolvedPhone = data.viewer?.phone || null;
      if (resolvedPhone) {
        setMyPhone(resolvedPhone);
        if (typeof window !== 'undefined') {
          localStorage.setItem('rpg_phone', resolvedPhone);
        }
      }

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

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('rpg_phone') || '' : '';
    const activePhone = searchParams.get('p') || searchParams.get('phone') || savedPhone || '';

    // Autenticação no Socket.IO via código Base62 ou token legado
    const socketAuth: any = {};
    if (accessCode) {
      socketAuth.code = accessCode;
    } else {
      socketAuth.battleId = initialBattleId;
      socketAuth.token = token || undefined;
      socketAuth.phone = activePhone || undefined;
    }

    const s = io({
      auth: socketAuth,
      query: socketAuth,
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

    s.on('battle:my_card_locked', (payload: any) => {
      rpgAudio.playCardSelect();
      setP1((prev) => (prev && prev.id === payload.participantId ? { ...prev, cardLocked: true, selectedCardId: payload.lockedCardId } : prev));
      setP2((prev) => (prev && prev.id === payload.participantId ? { ...prev, cardLocked: true, selectedCardId: payload.lockedCardId } : prev));
    });

    s.on('battle:turn_resolved', (payload: any) => {
      setLastTurnPayload(payload);

      // Tocar sons de impacto
      rpgAudio.playGavel();
      setTimeout(() => rpgAudio.playHit(), 300);

      // Atualizar logs
      if (payload.logSummary) {
        setCombatLogs((prev) => [...prev, `--- Turno ${payload.currentTurn} ---`, ...payload.logSummary]);
      }

      // Executar a coreografia completa das poses!
      if (directorRef.current) {
        directorRef.current.playTurn(payload);
      }

      // Atualizar participantes
      setP1((prev) => (prev ? { ...prev, ...payload.p1, cardLocked: false } : null));
      setP2((prev) => (prev ? { ...prev, ...payload.p2, cardLocked: false } : null));
      setSelectedCardId(null);

      // Atualizar batalha
      setBattle((b) => (b ? { ...b, currentTurn: payload.currentTurn, status: payload.status } : null));

      if (payload.winner && payload.winner !== 'none') {
        setTimeout(() => rpgAudio.playVictory(), 1400);
      }
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
    };
  }, [accessCode, initialBattleId, token]);

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

      let res: any;
      if (accessCode) {
        res = await axios.post(`/api/rpg/a/${accessCode}/jogar`, {
          cardId: selectedCardId,
        });
      } else {
        res = await axios.post(
          `/api/rpg/batalha/${initialBattleId}/jogar`,
          {
            cardId: selectedCardId,
            phone: myPhone || undefined,
          },
          {
            params: {
              t: token || undefined,
              p: myPhone || undefined,
            },
          }
        );
      }

      if (res.data.success) {
        // Atualizar estado local
        if (p1 && (myPhone === p1.phone || myParticipantId === p1.id)) {
          setP1({ ...p1, cardLocked: true });
        } else if (p2 && (myPhone === p2.phone || myParticipantId === p2.id)) {
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
          {/* Botão Pular Animação */}
          <button
            onClick={handleSkipAnimation}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition shadow"
            title="Pular animação e ir para o estado final do turno"
          >
            <FastForward className="w-3.5 h-3.5" /> Pular
          </button>

          {/* Botão Modo Esqueleto Debug */}
          <button
            onClick={() => setShowSkeletonDebug(!showSkeletonDebug)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow ${
              showSkeletonDebug
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400'
            }`}
            title="Ligar/Desligar Esqueleto do Boneco de Palito por cima do PNG (?debug=skeleton)"
          >
            <Bone className="w-3.5 h-3.5" /> {showSkeletonDebug ? 'Palito ON' : 'Palito'}
          </button>

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

      {/* Popover de Controle de Opacidade do Esqueleto Debug */}
      {showSkeletonDebug && (
        <div className="fixed top-16 right-4 z-40 bg-black/85 backdrop-blur-md border border-emerald-500/50 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-mono shadow-2xl animate-fadeIn">
          <span className="text-emerald-400 font-bold">Opacidade Palito:</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={skeletonOpacity}
            onChange={(e) => setSkeletonOpacity(parseFloat(e.target.value))}
            className="w-20 accent-emerald-400 cursor-pointer"
          />
          <span className="text-white w-8 text-right font-bold">{Math.round(skeletonOpacity * 100)}%</span>
        </div>
      )}

      {/* 2. RINGUE / PALCO 2.5D COM OS DOIS LUTADORES */}
      <main
        className="flex-1 relative flex flex-col justify-between p-2 md:p-6 overflow-hidden"
        style={{
          transform: screenShake > 0 ? `translate3d(${(Math.random() - 0.5) * screenShake}px, ${(Math.random() - 0.5) * screenShake}px, 0)` : 'none',
          transition: 'transform 0.05s linear',
        }}
        onClick={() => {
          // Toque na tela pode pular animação se estiver no meio
          if (directorRef.current && lastTurnPayload) {
            handleSkipAnimation();
          }
        }}
      >
        {/* Banner Dramático de Ataque Especial */}
        <SpecialBanner
          visible={Boolean(specialBannerInfo)}
          characterName={specialBannerInfo?.characterName || ''}
          avatarEmoji={specialBannerInfo?.avatarEmoji}
          attackName={specialBannerInfo?.attackName || ''}
          side={specialBannerInfo?.side || 'p1'}
        />

        {/* Efeitos de Combate (Faíscas, Escudo, Supernova e Números de Dano) */}
        <CombatVfx
          hitEffects={hitEffects}
          floatingNumbers={floatingNumbers}
          shakeIntensity={screenShake}
        />

        {/* HUD SUPERIOR DE BARRAS DE VIDA (HP) E ENERGIA DOS LUTADORES */}
        <div className="relative z-30 grid grid-cols-2 gap-3 md:gap-8 w-full max-w-4xl mx-auto">
          {/* HUD LUTADOR 1 (ESQUERDA) */}
          <div className="p-3 rounded-2xl bg-black/60 border border-emerald-500/30 backdrop-blur shadow-xl relative">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">{p1.avatarEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs md:text-sm text-white truncate">{p1.name}</h3>
                  {p1.cardLocked && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse font-mono font-bold">
                      🔒 PRONTO
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-emerald-400/90 font-medium truncate">{p1.characterName}</p>
              </div>
            </div>

            {/* Barra de Vida (HP) - SINCRONIZADA EXATAMENTE NO IMPACTO! */}
            <div className="w-full">
              <div className="flex justify-between text-[11px] mb-0.5 font-mono">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> HP
                </span>
                <span className="font-bold text-emerald-300">
                  {p1Visual ? p1Visual.displayedHp : p1.currentHp} / {p1.maxHp}
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    (p1Visual ? p1Visual.displayedHp : p1.currentHp) / p1.maxHp < 0.25
                      ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                      : (p1Visual ? p1Visual.displayedHp : p1.currentHp) / p1.maxHp < 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, ((p1Visual ? p1Visual.displayedHp : p1.currentHp) / p1.maxHp) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Energia & Ibope */}
            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-gray-400">
              <span className="flex items-center gap-1 text-cyan-400">
                <Zap className="w-2.5 h-2.5" /> {p1.currentEnergy}/{p1.maxEnergy}
              </span>
              <span className="text-yellow-400 font-semibold">📊 {p1.popularity}% Ibope</span>
            </div>
          </div>

          {/* HUD LUTADOR 2 (DIREITA) */}
          <div className="p-3 rounded-2xl bg-black/60 border border-purple-500/30 backdrop-blur shadow-xl relative text-right">
            <div className="flex items-center justify-end gap-2 mb-1.5 flex-row-reverse">
              <span className="text-xl">{p2.avatarEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between flex-row-reverse">
                  <h3 className="font-extrabold text-xs md:text-sm text-white truncate">{p2.name}</h3>
                  {p2.cardLocked && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/40 animate-pulse font-mono font-bold">
                      🔒 PRONTO
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-purple-400/90 font-medium truncate">{p2.characterName}</p>
              </div>
            </div>

            {/* Barra de Vida (HP) - SINCRONIZADA EXATAMENTE NO IMPACTO! */}
            <div className="w-full">
              <div className="flex justify-between text-[11px] mb-0.5 font-mono flex-row-reverse">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" /> HP
                </span>
                <span className="font-bold text-purple-300">
                  {p2Visual ? p2Visual.displayedHp : p2.currentHp} / {p2.maxHp}
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    (p2Visual ? p2Visual.displayedHp : p2.currentHp) / p2.maxHp < 0.25
                      ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                      : (p2Visual ? p2Visual.displayedHp : p2.currentHp) / p2.maxHp < 0.5
                      ? 'bg-amber-500'
                      : 'bg-purple-500'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, ((p2Visual ? p2Visual.displayedHp : p2.currentHp) / p2.maxHp) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Energia & Ibope */}
            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-gray-400">
              <span className="text-yellow-400 font-semibold">📊 {p2.popularity}% Ibope</span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Zap className="w-2.5 h-2.5" /> {p2.currentEnergy}/{p2.maxEnergy}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================
            PALCO DA ARENA 2.5D (1000x500 COORDENADAS LÓGICAS RESPONSIVAS)
            ============================================================ */}
        <div
          ref={arenaContainerRef}
          className="relative w-full max-w-4xl h-[280px] md:h-[380px] mx-auto my-auto flex items-center justify-center overflow-visible"
        >
          {/* PISO ISOMÉTRICO 2.5D COM PROFUNDIDADE */}
          <div
            className="absolute inset-x-8 bottom-6 h-36 rounded-[50px] border-t-2 border-emerald-500/20 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0.6) 80%)',
              transform: 'perspective(400px) rotateX(40deg)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
            }}
          />

          {/* PALCO CENTRAL COM LINHA DE CENTRO */}
          <div className="absolute inset-x-16 bottom-16 h-1 border-b border-dashed border-white/10 pointer-events-none" />

          {/* LUTADOR 1 (P1 - JOGADOR DA ESQUERDA) */}
          {defaultRig && p1Visual && (
            <div
              className="absolute pointer-events-none transition-all duration-150"
              style={{
                left: `${(p1Visual.x / 1000) * 100}%`,
                bottom: `${500 - p1Visual.y}px`,
                transform: 'translate(-50%, 100%)',
                zIndex: Math.round(p1Visual.y),
              }}
            >
              <CharacterFighter
                side="p1"
                characterId={p1.characterId}
                characterName={p1.characterName}
                action={p1Visual.action}
                actionTimeMs={p1Visual.actionTimeMs}
                manifest={p1Manifest}
                defaultRig={defaultRig}
                skeletonOpacity={skeletonOpacity}
                showDebugSkeleton={showSkeletonDebug}
                flipX={p1Visual.flipX}
                isHit={p1Visual.isHit}
                isGuarding={p1Visual.isGuarding}
                auraEffect={p1Visual.auraEffect}
                speechBubble={p1Visual.speechBubble}
              />
            </div>
          )}

          {/* LUTADOR 2 (P2 - JOGADOR DA DIREITA) */}
          {defaultRig && p2Visual && (
            <div
              className="absolute pointer-events-none transition-all duration-150"
              style={{
                left: `${(p2Visual.x / 1000) * 100}%`,
                bottom: `${500 - p2Visual.y}px`,
                transform: 'translate(-50%, 100%)',
                zIndex: Math.round(p2Visual.y),
              }}
            >
              <CharacterFighter
                side="p2"
                characterId={p2.characterId}
                characterName={p2.characterName}
                action={p2Visual.action}
                actionTimeMs={p2Visual.actionTimeMs}
                manifest={p2Manifest}
                defaultRig={defaultRig}
                skeletonOpacity={skeletonOpacity}
                showDebugSkeleton={showSkeletonDebug}
                flipX={p2Visual.flipX}
                isHit={p2Visual.isHit}
                isGuarding={p2Visual.isGuarding}
                auraEffect={p2Visual.auraEffect}
                speechBubble={p2Visual.speechBubble}
              />
            </div>
          )}
        </div>

        {/* FEED DE RESUMO / REPLAY DO COMBATE */}
        {combatLogs.length > 0 && (
          <div className="relative z-10 w-full max-w-xl mx-auto my-1 max-h-20 overflow-y-auto rounded-xl bg-black/60 border border-white/10 p-2 text-xs font-mono text-gray-300 space-y-0.5">
            {combatLogs.slice(-3).map((log, idx) => (
              <div key={idx} className="leading-tight truncate">
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
            <div className="flex items-center justify-between py-1 px-2 text-xs font-mono text-gray-300">
              <span>👓 Modo Espectador ao Vivo (Transmissão da Arena)</span>
              <button
                onClick={() => {
                  rpgAudio.playCardSelect();
                  setP1((prev) => (prev ? { ...prev, popularity: Math.min(100, prev.popularity + 2) } : null));
                  setP2((prev) => (prev ? { ...prev, popularity: Math.min(100, prev.popularity + 2) } : null));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold transition shadow"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Aplaudir (+Ibope)
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* 4. MODAL DE FIM DE COMBATE / RESULTADO ELEITORAL */}
      {battle.status === 'finished' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#0d121c] border-2 border-emerald-500/50 rounded-3xl p-6 text-center shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                Resultado Oficial da Apuração
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                {battle.winnerPlayerId === p1.playerId
                  ? `${p1.name} Venceu o Debate!`
                  : battle.winnerPlayerId === p2.playerId
                  ? `${p2.name} Venceu o Debate!`
                  : 'Empate no Plenário!'}
              </h2>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
              O combate foi encerrado e os pontos de prestígio, experiência e verba parlamentar foram computados!
            </p>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex justify-around text-xs font-mono">
              <div>
                <div className="text-gray-400">Placar Final</div>
                <div className="font-bold text-white mt-0.5">
                  {p1.currentHp} vs {p2.currentHp} HP
                </div>
              </div>
              <div className="border-r border-white/10" />
              <div>
                <div className="text-gray-400">Total de Turnos</div>
                <div className="font-bold text-emerald-400 mt-0.5">{battle.currentTurn}</div>
              </div>
            </div>

            <button
              onClick={() => {
                if (window.opener) window.close();
                else window.location.href = '/';
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm tracking-wide shadow-lg transition"
            >
              Concluir & Retornar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RpgArenaView;
