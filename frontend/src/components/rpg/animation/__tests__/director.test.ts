import { describe, it, expect, vi } from 'vitest';
import {
  AnimationDirector,
  mapCardToAction,
  TurnResolutionPayload,
} from '../AnimationDirector.js';
import { ArenaFighterVisualState } from '../types.js';

describe('AnimationDirector & Coreografia de Combate', () => {
  const createMockFighter = (side: 'p1' | 'p2', hp = 100): ArenaFighterVisualState => ({
    side,
    name: side === 'p1' ? 'Lutador A' : 'Lutador B',
    characterId: side === 'p1' ? 'doutor_promessa' : 'dona_reforma',
    characterName: side === 'p1' ? 'Doutor Promessa' : 'Dona Reforma',
    maxHp: 100,
    currentHp: hp,
    displayedHp: hp,
    maxEnergy: 10,
    currentEnergy: 4,
    popularity: 50,
    action: 'idle',
    actionTimeMs: 0,
    x: side === 'p1' ? 240 : 760,
    y: 350,
    baseX: side === 'p1' ? 240 : 760,
    baseY: 350,
    flipX: side === 'p2',
    isHit: false,
    isGuarding: false,
    activeStatuses: [],
  });

  it('deve mapear cartas para as ações coreografadas corretas', () => {
    expect(mapCardToAction('soco_demagogico', 'Soco Demagógico')).toBe('punch');
    expect(mapCardToAction('chute_populista', 'Chute Populista')).toBe('kick');
    expect(mapCardToAction('investida_eleitoral', 'Investida Eleitoral')).toBe('charge');
    expect(mapCardToAction('bloqueio_blindagem', 'Bloqueio de Blindagem')).toBe('block');
    expect(mapCardToAction('obstrucao_parlamentar', 'Obstrução Parlamentar')).toBe('block');
    expect(mapCardToAction('esquiva_foro', 'Esquiva do Foro')).toBe('dodge');
    expect(mapCardToAction('habeas_corpus_relampago', 'Habeas Corpus Relâmpago')).toBe('dodge');
    expect(mapCardToAction('contra_ataque_cpi', 'Contra-Ataque da CPI')).toBe('counter');
    expect(mapCardToAction('propina_suica', 'Propina na Suíça')).toBe('special');
    expect(mapCardToAction('convocar_suplente', 'Convocar Suplente')).toBe('summon');
    expect(mapCardToAction('combo_parlamentar', 'Combo Parlamentar')).toBe('combo_punch');
    expect(mapCardToAction('emenda_relator', 'Emenda do Relator')).toBe('buff');
    expect(mapCardToAction('denuncia_anonima', 'Denúncia Anônima')).toBe('debuff');
    expect(mapCardToAction('provocacao_plenario', 'Provocação no Plenário')).toBe('taunt');
  });

  it('deve avançar o lutador para a distância correta de ataque sem atravessar o adversário', async () => {
    const p1 = createMockFighter('p1', 100);
    const p2 = createMockFighter('p2', 100);

    let currentP1 = { ...p1 };
    let currentP2 = { ...p2 };

    const director = new AnimationDirector(p1, p2, {
      onUpdateFighters: (up1, up2) => {
        currentP1 = up1;
        currentP2 = up2;
      },
      onScreenShake: vi.fn(),
      onHitEffect: vi.fn(),
      onFloatingNumber: vi.fn(),
      onSpecialBanner: vi.fn(),
      onTurnFinished: vi.fn(),
    });

    const payload: TurnResolutionPayload = {
      battleId: 'test_123',
      currentTurn: 1,
      p1: { id: 'p1_id', name: 'Lutador A', currentHp: 100, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      p2: { id: 'p2_id', name: 'Lutador B', currentHp: 75, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      events: [
        { type: 'card_reveal', actor: 'p1', text: 'Revelou carta' },
        { type: 'attack', actor: 'p1', target: 'p2', cardId: 'soco_demagogico', cardName: 'Soco Demagógico', text: 'Atacou' },
        { type: 'damage', actor: 'p1', target: 'p2', value: 25, text: 'Causou 25 de dano' },
      ],
      winner: 'none',
    };

    // Iniciar animação do turno
    const playPromise = director.playTurn(payload);

    // Após a fase de revelação (400ms), o atacante avança sem ultrapassar a base do defensor (760)
    // A distância calculada é defender.baseX - 130 = 630
    await new Promise((r) => setTimeout(r, 450));
    expect(currentP1.action).toBe('punch');
    expect(currentP1.x).toBeLessThan(p2.baseX);
    expect(currentP1.x).toBeGreaterThan(p1.baseX);

    await playPromise;

    // Ao fim do turno, o atacante retorna para sua baseX original
    expect(currentP1.x).toBe(p1.baseX);
    expect(currentP1.action).toBe('idle');
    expect(currentP2.displayedHp).toBe(75);

    director.destroy();
  });

  it('quando o defensor esquivar, ele deve executar dodge e o dano deve ser zero', async () => {
    const p1 = createMockFighter('p1', 100);
    const p2 = createMockFighter('p2', 100);

    let currentP1 = { ...p1 };
    let currentP2 = { ...p2 };
    const floatingCalls: any[] = [];

    const director = new AnimationDirector(p1, p2, {
      onUpdateFighters: (up1, up2) => {
        currentP1 = up1;
        currentP2 = up2;
      },
      onScreenShake: vi.fn(),
      onHitEffect: vi.fn(),
      onFloatingNumber: (x, y, text, type) => {
        floatingCalls.push({ x, y, text, type });
      },
      onSpecialBanner: vi.fn(),
      onTurnFinished: vi.fn(),
    });

    const payload: TurnResolutionPayload = {
      battleId: 'test_dodge',
      currentTurn: 2,
      p1: { id: 'p1_id', name: 'Lutador A', currentHp: 100, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      p2: { id: 'p2_id', name: 'Lutador B', currentHp: 100, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      events: [
        { type: 'attack', actor: 'p1', target: 'p2', cardId: 'soco_demagogico', text: 'Atacou' },
        { type: 'dodge', actor: 'p1', target: 'p2', text: 'Esquivou do golpe!' },
      ],
      winner: 'none',
    };

    await director.playTurn(payload);

    expect(floatingCalls.some((c) => c.type === 'dodge' && c.text.includes('ESQUIVOU'))).toBe(true);
    expect(currentP2.displayedHp).toBe(100);

    director.destroy();
  });

  it('quando o defensor bloquear, ele deve executar block e receber hit_blocked', async () => {
    const p1 = createMockFighter('p1', 100);
    const p2 = createMockFighter('p2', 100);

    let currentP2 = { ...p2 };
    const hitEffectCalls: any[] = [];

    const director = new AnimationDirector(p1, p2, {
      onUpdateFighters: (_, up2) => {
        currentP2 = up2;
      },
      onScreenShake: vi.fn(),
      onHitEffect: (x, y, type) => {
        hitEffectCalls.push({ x, y, type });
      },
      onFloatingNumber: vi.fn(),
      onSpecialBanner: vi.fn(),
      onTurnFinished: vi.fn(),
    });

    const payload: TurnResolutionPayload = {
      battleId: 'test_block',
      currentTurn: 3,
      p1: { id: 'p1_id', name: 'Lutador A', currentHp: 100, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      p2: { id: 'p2_id', name: 'Lutador B', currentHp: 90, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 50 },
      events: [
        { type: 'attack', actor: 'p1', target: 'p2', cardId: 'soco_demagogico', text: 'Atacou' },
        { type: 'block', actor: 'p1', target: 'p2', value: 10, text: 'Bloqueou parte do dano' },
      ],
      winner: 'none',
    };

    await director.playTurn(payload);

    expect(hitEffectCalls.some((h) => h.type === 'hit_blocked')).toBe(true);
    expect(currentP2.displayedHp).toBe(90);

    director.destroy();
  });

  it('em caso de nocaute (KO), o perdedor deve ficar em pose ko e o vencedor em victory', async () => {
    const p1 = createMockFighter('p1', 100);
    const p2 = createMockFighter('p2', 20);

    let currentP1 = { ...p1 };
    let currentP2 = { ...p2 };

    const director = new AnimationDirector(p1, p2, {
      onUpdateFighters: (up1, up2) => {
        currentP1 = up1;
        currentP2 = up2;
      },
      onScreenShake: vi.fn(),
      onHitEffect: vi.fn(),
      onFloatingNumber: vi.fn(),
      onSpecialBanner: vi.fn(),
      onTurnFinished: vi.fn(),
    });

    const payload: TurnResolutionPayload = {
      battleId: 'test_ko',
      currentTurn: 4,
      p1: { id: 'p1_id', name: 'Lutador A', currentHp: 100, maxHp: 100, currentEnergy: 4, maxEnergy: 10, popularity: 60 },
      p2: { id: 'p2_id', name: 'Lutador B', currentHp: 0, maxHp: 100, currentEnergy: 2, maxEnergy: 10, popularity: 40 },
      events: [
        { type: 'attack', actor: 'p1', target: 'p2', cardId: 'soco_demagogico', text: 'Golpe final' },
        { type: 'damage', actor: 'p1', target: 'p2', value: 20, text: 'Nocaute!' },
        { type: 'ko', actor: 'p1', target: 'p2', text: 'Vitória por KO' },
      ],
      winner: 'p1',
    };

    await director.playTurn(payload);

    expect(currentP1.action).toBe('victory');
    expect(currentP2.action).toBe('ko');
    expect(currentP2.displayedHp).toBe(0);

    director.destroy();
  });

  it('o método skip() deve transicionar imediatamente para o estado final sem esperar timers', () => {
    const p1 = createMockFighter('p1', 100);
    const p2 = createMockFighter('p2', 100);

    let currentP1 = { ...p1 };
    let currentP2 = { ...p2 };
    let turnFinishedCalled = false;

    const director = new AnimationDirector(p1, p2, {
      onUpdateFighters: (up1, up2) => {
        currentP1 = up1;
        currentP2 = up2;
      },
      onScreenShake: vi.fn(),
      onHitEffect: vi.fn(),
      onFloatingNumber: vi.fn(),
      onSpecialBanner: vi.fn(),
      onTurnFinished: () => {
        turnFinishedCalled = true;
      },
    });

    const payload: TurnResolutionPayload = {
      battleId: 'test_skip',
      currentTurn: 5,
      p1: { id: 'p1_id', name: 'Lutador A', currentHp: 60, maxHp: 100, currentEnergy: 2, maxEnergy: 10, popularity: 40 },
      p2: { id: 'p2_id', name: 'Lutador B', currentHp: 30, maxHp: 100, currentEnergy: 3, maxEnergy: 10, popularity: 70 },
      events: [],
      winner: 'p2',
    };

    director.skip(payload);

    expect(turnFinishedCalled).toBe(true);
    expect(currentP1.displayedHp).toBe(60);
    expect(currentP2.displayedHp).toBe(30);
    expect(currentP1.action).toBe('ko');
    expect(currentP1.x).toBe(p1.baseX);
    expect(currentP2.action).toBe('victory');
    expect(currentP2.x).toBe(p2.baseX);

    director.destroy();
  });
});
