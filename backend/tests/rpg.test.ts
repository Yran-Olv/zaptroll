import { describe, it, expect, vi } from 'vitest';
import { CombatEngine, FighterCombatState, CardCombatState } from '../src/modules/rpg/engine/CombatEngine.js';
import { BalanceSimulator } from '../src/modules/rpg/engine/BalanceSimulator.js';
import { BotAiService } from '../src/modules/rpg/services/BotAiService.js';
import { RpgTokenService } from '../src/modules/rpg/services/RpgTokenService.js';
import { EconomyService } from '../src/modules/rpg/services/EconomyService.js';
import { MissionService } from '../src/modules/rpg/services/MissionService.js';
import { RpgTurnWorker } from '../src/modules/rpg/services/RpgTurnWorker.js';
import { RpgCommandDispatcher } from '../src/modules/rpg/commands/RpgCommandDispatcher.js';

describe('Zaptroll RPG — Combat Engine (Pure Deterministic)', () => {
  const createMockFighter = (overrides?: Partial<FighterCombatState>): FighterCombatState => ({
    id: 'f1',
    name: 'Doutor Promessa',
    characterId: 'doutor_promessa',
    characterClass: 'demagogo',
    affinity: 'retorica',
    weakness: 'povao',
    resistance: 'juridico',
    maxHp: 100,
    currentHp: 100,
    maxEnergy: 10,
    currentEnergy: 5,
    baseAtk: 15,
    baseDef: 10,
    baseSpeed: 10,
    baseCrit: 0.05,
    popularity: 50,
    rage: 0,
    activeStatuses: [],
    passiveName: 'Reeleição Garantida',
    passiveEffect: { type: 'revive_once', value: 20 },
    passiveTriggered: false,
    comboStreak: 0,
    shield: 0,
    allyUsed: false,
    ...overrides,
  });

  const createMockCard = (overrides?: Partial<CardCombatState>): CardCombatState => ({
    id: 'c1',
    name: 'Discurso Inflamado',
    category: 'forca',
    element: 'retorica',
    energyCost: 2,
    power: 20,
    priority: 5,
    cooldown: 0,
    emoji: '📢',
    ...overrides,
  });

  it('resolves turn with deterministic Mulberry32 RNG seed', () => {
    const f1 = createMockFighter({ id: 'p1', currentHp: 100 });
    const f2 = createMockFighter({ id: 'p2', currentHp: 100 });

    const card1 = createMockCard({ power: 25, priority: 6 });
    const card2 = createMockCard({ power: 20, priority: 4 });

    const result1 = CombatEngine.resolveTurn({
      turnNumber: 1,
      p1: { ...f1 },
      p2: { ...f2 },
      p1Card: { ...card1 },
      p2Card: { ...card2 },
      rngSeed: 12345,
    });

    const result2 = CombatEngine.resolveTurn({
      turnNumber: 1,
      p1: { ...f1 },
      p2: { ...f2 },
      p1Card: { ...card1 },
      p2Card: { ...card2 },
      rngSeed: 12345,
    });

    // Mesma semente gera exatamente os mesmos resultados e danos
    expect(result1.p1.currentHp).toBe(result2.p1.currentHp);
    expect(result1.p2.currentHp).toBe(result2.p2.currentHp);
    expect(result1.events.length).toBe(result2.events.length);
  });

  it('respects priority order: higher priority acts first', () => {
    const f1 = createMockFighter({ id: 'p1' });
    const f2 = createMockFighter({ id: 'p2' });

    // P1 tem prioridade 8, P2 tem prioridade 3
    const quickCard = createMockCard({ priority: 8, power: 15 });
    const slowCard = createMockCard({ priority: 3, power: 30 });

    const result = CombatEngine.resolveTurn({
      turnNumber: 1,
      p1: f1,
      p2: f2,
      p1Card: quickCard,
      p2Card: slowCard,
      rngSeed: 9999,
    });

    const damageEvents = result.events.filter((e) => e.type === 'damage');
    expect(damageEvents.length).toBe(2);
    expect(damageEvents[0].actor).toBe('p1');
    expect(damageEvents[1].actor).toBe('p2');
  });

  it('applies affinity advantage multiplier (Weakness vs Resistance)', () => {
    // Atacante com elemento 'povao' contra defensor fraco a 'povao'
    const multAdvantage = CombatEngine.getAffinityMultiplier('povao', 'retorica', 'povao', 'juridico');
    expect(multAdvantage.multiplier).toBe(1.25);
    expect(multAdvantage.description).toContain('Super eficaz');

    // Atacante com elemento 'juridico' contra defensor resistente a 'juridico'
    const multDisadvantage = CombatEngine.getAffinityMultiplier('juridico', 'retorica', 'povao', 'juridico');
    expect(multDisadvantage.multiplier).toBe(0.8);
    expect(multDisadvantage.description).toContain('Pouco eficaz');
  });

  it('consumes card energy cost and adds round energy gain', () => {
    const f1 = createMockFighter({ currentEnergy: 6 });
    const f2 = createMockFighter({ currentEnergy: 6 });

    const card = createMockCard({ energyCost: 4 });

    const result = CombatEngine.resolveTurn({
      turnNumber: 1,
      p1: f1,
      p2: f2,
      p1Card: card,
      p2Card: card,
      rngSeed: 100,
    });

    // 6 - 4 de custo + 2 de regeneração base de turno = 4
    expect(result.p1.currentEnergy).toBe(4);
    expect(result.p2.currentEnergy).toBe(4);
  });
});

describe('Zaptroll RPG — Bot AI Service', () => {
  it('selects valid affordable card from hand', () => {
    const bot = {
      id: 'bot1',
      name: 'Bot Político',
      characterId: 'dona_reforma',
      characterClass: 'tecnocrata',
      affinity: 'burocracia',
      weakness: 'retorica',
      resistance: 'economia',
      maxHp: 100,
      currentHp: 100,
      maxEnergy: 10,
      currentEnergy: 3, // Energia suficiente apenas para cartas de custo <= 3
      baseAtk: 12,
      baseDef: 12,
      baseSpeed: 10,
      baseCrit: 0.05,
      popularity: 50,
      rage: 0,
      activeStatuses: [],
      passiveName: 'Teto de Gastos',
      passiveEffect: {},
      passiveTriggered: false,
      comboStreak: 0,
      shield: 0,
      allyUsed: false,
    } as any;

    const opponent = { ...bot, id: 'human' };

    const hand: CardCombatState[] = [
      {
        id: 'expensive',
        name: 'Golpe Caríssimo',
        category: 'forca',
        element: 'retorica',
        energyCost: 6, // Não pode pagar
        power: 40,
        priority: 5,
        cooldown: 0,
        emoji: '💎',
      },
      {
        id: 'affordable',
        name: 'Nota Oficial',
        category: 'defesa',
        element: 'burocracia',
        energyCost: 2, // Pode pagar!
        power: 10,
        priority: 6,
        cooldown: 0,
        emoji: '📝',
      },
    ];

    const chosen = BotAiService.selectCard(bot, opponent, hand, 'normal', 'equilibrado');
    expect(chosen.id).toBe('affordable');
    expect(chosen.energyCost).toBeLessThanOrEqual(bot.currentEnergy);
  });
});

describe('Zaptroll RPG — Token Security Service', () => {
  it('generates and verifies valid battle tokens', () => {
    const battleId = 'batalha_uuid_123';
    const phone = '5511999999999@s.whatsapp.net';

    const token = RpgTokenService.generateBattleToken(battleId, phone, false);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = RpgTokenService.verifyBattleToken(token);
    expect(decoded.battleId).toBe(battleId);
    expect(decoded.phone).toBe(phone);
    expect(decoded.role).toBe('fighter');
    expect(decoded.isSpectator).toBe(false);
  });

  it('generates valid spectator token without phone', () => {
    const battleId = 'batalha_uuid_456';
    const token = RpgTokenService.generateBattleToken(battleId, undefined, true);
    const decoded = RpgTokenService.verifyBattleToken(token);

    expect(decoded.battleId).toBe(battleId);
    expect(decoded.role).toBe('spectator');
    expect(decoded.isSpectator).toBe(true);
  });

  it('rejects tampered or malformed tokens', () => {
    expect(() => {
      RpgTokenService.verifyBattleToken('token.invalido.falso');
    }).toThrow();
  });
});

describe('Zaptroll RPG — Economy & Progression', () => {
  it('returns proper political titles by level and prestige', () => {
    expect(EconomyService.getTitleByLevel(1, 0)).toBe('📎 Estagiário de Gabinete');
    expect(EconomyService.getTitleByLevel(5, 0)).toBe('📋 Assessor Parlamentar');
    expect(EconomyService.getTitleByLevel(10, 0)).toBe('📢 Vereador de Oposição');
    expect(EconomyService.getTitleByLevel(15, 0)).toBe('💼 Deputado do Centrão');
    expect(EconomyService.getTitleByLevel(20, 0)).toBe('🎖️ Senador Vitalício');
    expect(EconomyService.getTitleByLevel(30, 0)).toBe('👑 Presidente da República');
    expect(EconomyService.getTitleByLevel(30, 2)).toBe('🏛️ Patriarca da República (P2)');
  });
});

describe('Zaptroll RPG — Balance Simulator (Monte Carlo)', () => {
  it('runs Monte Carlo simulations across characters and outputs balanced metrics', () => {
    const char1: FighterCombatState = {
      id: 'c1',
      name: 'Doutor Promessa',
      characterId: 'doutor_promessa',
      characterClass: 'demagogo',
      affinity: 'retorica',
      weakness: 'povao',
      resistance: 'juridico',
      maxHp: 100,
      currentHp: 100,
      maxEnergy: 10,
      currentEnergy: 4,
      baseAtk: 16,
      baseDef: 10,
      baseSpeed: 11,
      baseCrit: 0.08,
      popularity: 50,
      rage: 0,
      activeStatuses: [],
      passiveName: 'Reeleição',
      passiveEffect: {},
      passiveTriggered: false,
      comboStreak: 0,
      shield: 0,
      allyUsed: false,
    };

    const char2: FighterCombatState = {
      id: 'c2',
      name: 'Capitão Palanque',
      characterId: 'capitao_palanque',
      characterClass: 'populista',
      affinity: 'povao',
      weakness: 'midia',
      resistance: 'retorica',
      maxHp: 95,
      currentHp: 95,
      maxEnergy: 10,
      currentEnergy: 4,
      baseAtk: 20,
      baseDef: 8,
      baseSpeed: 13,
      baseCrit: 0.15,
      popularity: 50,
      rage: 0,
      activeStatuses: [],
      passiveName: 'Clamor',
      passiveEffect: {},
      passiveTriggered: false,
      comboStreak: 0,
      shield: 0,
      allyUsed: false,
    };

    const cards: CardCombatState[] = [
      {
        id: 'atk',
        name: 'Golpe',
        category: 'forca',
        element: 'retorica',
        energyCost: 2,
        power: 18,
        priority: 5,
        cooldown: 0,
        emoji: '🥊',
      },
      {
        id: 'def',
        name: 'Bloqueio',
        category: 'defesa',
        element: 'juridico',
        energyCost: 1,
        power: 0,
        priority: 7,
        cooldown: 0,
        selfEffect: { shield: 15 },
        emoji: '🛡️',
      },
    ];

    const result = BalanceSimulator.runSimulations([char1, char2], cards, 10);
    expect(result.totalBattles).toBeGreaterThan(0);
    expect(result.averageTurns).toBeGreaterThan(0);
    expect(result.characterWinRates['c1']).toBeDefined();
    expect(result.characterWinRates['c2']).toBeDefined();
  });
});

describe('Zaptroll RPG — Missions & Daily Goals', () => {
  it('returns structured daily missions with rewards', async () => {
    const { missions, formatted } = await MissionService.getDailyMissions('5511888888888@s.whatsapp.net', 'Deputado Teste');
    expect(missions.length).toBe(3);
    expect(missions[0].rewardCoins).toBeGreaterThan(0);
    expect(missions[0].rewardXp).toBeGreaterThan(0);
    expect(formatted).toContain('PAINEL DE METAS & MISSÕES DIÁRIAS');
  });
});

describe('Zaptroll RPG — Turn Worker Timeout Monitor', () => {
  it('instantiates and starts/stops worker without errors', () => {
    expect(() => {
      RpgTurnWorker.start(10000);
      RpgTurnWorker.stop();
    }).not.toThrow();
  });
});

describe('Zaptroll RPG — WhatsApp Group Commands & Integration', () => {
  const mockClient = (onSend?: (payload: any) => void): any => ({
    message: {
      send: async (_target: string, payload: any) => {
        onSend?.(payload);
        return { stanzaId: 'msg-test' };
      },
    },
  });

  it('dispatches /rpg command in a WhatsApp group', async () => {
    let sentText = '';
    const client = mockClient((p) => {
      sentText = p.text || '';
    });
    const handled = await RpgCommandDispatcher.handleMessage({
      client,
      connectionId: 'conn-1',
      userId: 'user-1',
      remoteJid: '120363000000000000@g.us',
      senderJid: '5511999999999@s.whatsapp.net',
      userName: 'Deputado Teste',
      text: '/rpg',
    });

    expect(handled).toBe(true);
    expect(sentText).toContain('ZAPTROLL RPG — LUTA POLÍTICA NO WHATSAPP');
    expect(sentText).toContain('/duelo');
    expect(sentText).toContain('/lutarbot');
  });

  it('dispatches /perfil command in a WhatsApp group', async () => {
    vi.spyOn(EconomyService, 'getProfile').mockResolvedValueOnce({
      player: { name: 'Deputado Teste' } as any,
      formatted: '👤 *PERFIL POLÍTICO: Deputado Teste*\n🏷️ *Cargo:* Estagiário de Gabinete',
    });

    let sentText = '';
    const client = mockClient((p) => {
      sentText = p.text || '';
    });
    const handled = await RpgCommandDispatcher.handleMessage({
      client,
      connectionId: 'conn-1',
      userId: 'user-1',
      remoteJid: '120363000000000000@g.us',
      senderJid: '5511999999999@s.whatsapp.net',
      userName: 'Deputado Teste',
      text: '/perfil',
    });

    expect(handled).toBe(true);
    expect(sentText).toContain('PERFIL POLÍTICO');
  });

  it('dispatches /missoes command in a WhatsApp group', async () => {
    let sentText = '';
    const client = mockClient((p) => {
      sentText = p.text || '';
    });
    const handled = await RpgCommandDispatcher.handleMessage({
      client,
      connectionId: 'conn-1',
      userId: 'user-1',
      remoteJid: '120363000000000000@g.us',
      senderJid: '5511999999999@s.whatsapp.net',
      userName: 'Deputado Teste',
      text: '/missoes',
    });

    expect(handled).toBe(true);
    expect(sentText).toContain('PAINEL DE METAS & MISSÕES DIÁRIAS');
  });
});

