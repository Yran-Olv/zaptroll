import {
  ActionName,
  JointName,
  ImpactEffectType,
  ArenaFighterVisualState,
} from './types.js';

export interface TurnEvent {
  type:
    | 'card_reveal'
    | 'attack'
    | 'damage'
    | 'crit'
    | 'block'
    | 'dodge'
    | 'combo'
    | 'status_applied'
    | 'status_tick'
    | 'heal'
    | 'passive'
    | 'ko'
    | 'draw';
  actor: 'p1' | 'p2';
  target?: 'p1' | 'p2';
  value?: number;
  text: string;
  cardId?: string;
  cardName?: string;
}

export interface TurnResolutionPayload {
  battleId: string;
  currentTurn: number;
  p1: {
    id: string;
    name: string;
    currentHp: number;
    maxHp: number;
    currentEnergy: number;
    maxEnergy: number;
    popularity: number;
    activeStatuses?: any[];
  };
  p2: {
    id: string;
    name: string;
    currentHp: number;
    maxHp: number;
    currentEnergy: number;
    maxEnergy: number;
    popularity: number;
    activeStatuses?: any[];
  };
  events: TurnEvent[];
  logSummary?: string[];
  winner?: 'p1' | 'p2' | 'draw' | 'none';
  status?: string;
}

export interface AnimationDirectorCallbacks {
  onUpdateFighters: (p1: ArenaFighterVisualState, p2: ArenaFighterVisualState) => void;
  onScreenShake: (intensity: number) => void;
  onHitEffect: (x: number, y: number, type: ImpactEffectType) => void;
  onFloatingNumber: (x: number, y: number, text: string, type: 'damage' | 'crit' | 'heal' | 'block' | 'dodge') => void;
  onSpecialBanner: (info: { characterName: string; avatarEmoji?: string; attackName: string; side: 'p1' | 'p2' } | null) => void;
  onTurnFinished: () => void;
}

/**
 * Mapeia IDs ou nomes de cartas para uma ação coreografada específica
 */
export function mapCardToAction(cardId?: string, cardName?: string): ActionName {
  if (!cardId && !cardName) return 'punch';

  const lower = `${cardId || ''} ${cardName || ''}`.toLowerCase();

  if (lower.includes('chute') || lower.includes('rasteira') || lower.includes('pontapé')) {
    return 'kick';
  }
  if (lower.includes('investida') || lower.includes('trator') || lower.includes('charge')) {
    return 'charge';
  }
  if (lower.includes('esquiva') || lower.includes('habeas') || lower.includes('fuga') || lower.includes('dodge')) {
    return 'dodge';
  }
  if (lower.includes('bloqueio') || lower.includes('obstru') || lower.includes('blindagem') || lower.includes('imunidade') || lower.includes('defesa')) {
    return 'block';
  }
  if (lower.includes('contra') || lower.includes('revid') || lower.includes('counter')) {
    return 'counter';
  }
  if (lower.includes('propina') || lower.includes('dossie') || lower.includes('bomba') || lower.includes('supremo') || lower.includes('cpi') || lower.includes('especial')) {
    return 'special';
  }
  if (lower.includes('suplente') || lower.includes('aliad') || lower.includes('convoc') || lower.includes('summon')) {
    return 'summon';
  }
  if (lower.includes('combo') || lower.includes('sequencia') || lower.includes('rajada')) {
    return 'combo_punch';
  }
  if (lower.includes('emenda') || lower.includes('orçamento') || lower.includes('reforma') || lower.includes('buff')) {
    return 'buff';
  }
  if (lower.includes('veneno') || lower.includes('corrupção') || lower.includes('escandalo') || lower.includes('denuncia') || lower.includes('debuff')) {
    return 'debuff';
  }
  if (lower.includes('provoc') || lower.includes('discurso') || lower.includes('taunt')) {
    return 'taunt';
  }

  // Padrão para ataques diretos
  return 'punch';
}

export class AnimationDirector {
  private p1State: ArenaFighterVisualState;
  private p2State: ArenaFighterVisualState;
  private callbacks: AnimationDirectorCallbacks;
  private isAnimating = false;
  private queue: Array<() => Promise<void>> = [];
  private activeTimers: number[] = [];
  private destroyed = false;
  private prefersReducedMotion = false;

  constructor(
    initialP1: ArenaFighterVisualState,
    initialP2: ArenaFighterVisualState,
    callbacks: AnimationDirectorCallbacks
  ) {
    this.p1State = { ...initialP1 };
    this.p2State = { ...initialP2 };
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  public destroy() {
    this.destroyed = true;
    this.clearAllTimers();
    this.queue = [];
  }

  private clearAllTimers() {
    this.activeTimers.forEach((t) => clearTimeout(t));
    this.activeTimers = [];
  }

  private sleep(ms: number): Promise<void> {
    if (this.prefersReducedMotion) ms = Math.min(ms, 200);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, ms) as unknown as number;
      this.activeTimers.push(timer);
    });
  }

  private notify() {
    if (this.destroyed) return;
    this.callbacks.onUpdateFighters({ ...this.p1State }, { ...this.p2State });
  }

  /**
   * Pular e avançar imediatamente para o estado final da batalha
   */
  public skip(finalPayload: TurnResolutionPayload) {
    this.clearAllTimers();
    this.queue = [];
    this.isAnimating = false;

    // Colocar lutadores nas posições base
    this.p1State.x = this.p1State.baseX;
    this.p1State.y = this.p1State.baseY;
    this.p1State.actionTimeMs = 0;
    this.p1State.isHit = false;
    this.p1State.isGuarding = false;
    this.p1State.displayedHp = finalPayload.p1.currentHp;
    this.p1State.currentHp = finalPayload.p1.currentHp;
    this.p1State.currentEnergy = finalPayload.p1.currentEnergy;
    this.p1State.popularity = finalPayload.p1.popularity;

    this.p2State.x = this.p2State.baseX;
    this.p2State.y = this.p2State.baseY;
    this.p2State.actionTimeMs = 0;
    this.p2State.isHit = false;
    this.p2State.isGuarding = false;
    this.p2State.displayedHp = finalPayload.p2.currentHp;
    this.p2State.currentHp = finalPayload.p2.currentHp;
    this.p2State.currentEnergy = finalPayload.p2.currentEnergy;
    this.p2State.popularity = finalPayload.p2.popularity;

    if (finalPayload.winner === 'p1') {
      this.p1State.action = 'victory';
      this.p2State.action = 'ko';
    } else if (finalPayload.winner === 'p2') {
      this.p1State.action = 'ko';
      this.p2State.action = 'victory';
    } else {
      this.p1State.action = 'idle';
      this.p2State.action = 'idle';
    }

    this.callbacks.onSpecialBanner(null);
    this.notify();
    this.callbacks.onTurnFinished();
  }

  /**
   * Enfileira e orquestra a resolução sequencial do turno
   */
  public async playTurn(payload: TurnResolutionPayload) {
    if (this.isAnimating) {
      // Se já estava animando um turno anterior, salta para o fim antes de começar o novo
      this.skip(payload);
    }

    this.isAnimating = true;

    // Separar eventos por ator e fase
    const p1Events = payload.events.filter((e) => e.actor === 'p1');
    const p2Events = payload.events.filter((e) => e.actor === 'p2');

    // 1. Fase de Revelação de Cartas
    await this.stepCardReveal(payload);

    // 2. Determinar quem ataca primeiro pela ordem da lista de eventos
    const firstAttackEvent = payload.events.find((e) => e.type === 'attack');
    const firstSide = firstAttackEvent?.actor || 'p1';
    const secondSide = firstSide === 'p1' ? 'p2' : 'p1';

    const firstActorEvents = firstSide === 'p1' ? p1Events : p2Events;
    const secondActorEvents = secondSide === 'p1' ? p1Events : p2Events;

    // Executa 1º lutador
    if (firstActorEvents.some((e) => e.type === 'attack')) {
      await this.executeFighterAction(firstSide, firstActorEvents, payload);
    }

    // Checar se o segundo lutador ainda tem vida para agir
    const secondFighterState = secondSide === 'p1' ? this.p1State : this.p2State;
    if (secondFighterState.displayedHp > 0 && secondActorEvents.some((e) => e.type === 'attack')) {
      await this.executeFighterAction(secondSide, secondActorEvents, payload);
    }

    // 3. Efeitos de Status / Fim de turno
    const statusTicks = payload.events.filter((e) => e.type === 'status_tick');
    for (const st of statusTicks) {
      await this.stepStatusTick(st);
    }

    // 4. Verificação de KO e Vitória
    if (payload.winner && payload.winner !== 'none') {
      await this.stepGameOver(payload.winner);
    } else {
      // Retornar ao repouso Idle
      this.p1State.action = 'idle';
      this.p2State.action = 'idle';
      this.notify();
    }

    this.isAnimating = false;
    this.callbacks.onTurnFinished();
  }

  /**
   * Fase 1: Revelação de cartas
   */
  private async stepCardReveal(payload: TurnResolutionPayload) {
    const revealEvents = payload.events.filter((e) => e.type === 'card_reveal');
    if (revealEvents.length > 0) {
      // Breve suspense
      await this.sleep(400);
    }
  }

  /**
   * Executa a ação de um lutador (Avanço -> Coreografia -> Impacto/Dano -> Retorno)
   */
  private async executeFighterAction(
    actorSide: 'p1' | 'p2',
    actorEvents: TurnEvent[],
    payload: TurnResolutionPayload
  ) {
    const isP1 = actorSide === 'p1';
    const attacker = isP1 ? this.p1State : this.p2State;
    const defender = isP1 ? this.p2State : this.p1State;
    const defenderFinalData = isP1 ? payload.p2 : payload.p1;

    const attackEv = actorEvents.find((e) => e.type === 'attack');
    const damageEv = actorEvents.find((e) => e.type === 'damage');
    const critEv = actorEvents.find((e) => e.type === 'crit');
    const isDodge = actorEvents.some((e) => e.type === 'dodge');
    const isBlock = actorEvents.some((e) => e.type === 'block');

    const action = mapCardToAction(attackEv?.cardId, attackEv?.cardName);
    const isSpecial = action === 'special';

    // Se for ataque especial, exibir banner dramático
    if (isSpecial) {
      this.callbacks.onSpecialBanner({
        characterName: attacker.characterName,
        avatarEmoji: attacker.avatarEmoji,
        attackName: attackEv?.cardName || 'Golpe Parlamentar',
        side: actorSide,
      });
      await this.sleep(1200);
      this.callbacks.onSpecialBanner(null);
    }

    // 1. Avançar em direção ao alvo (sem atravessá-lo)
    const attackDistance = isP1 ? defender.baseX - 130 : defender.baseX + 130;
    attacker.action = action;
    attacker.actionTimeMs = 0;
    attacker.x = attackDistance;
    this.notify();

    // Se o defensor esquivar, ele já se prepara
    if (isDodge) {
      defender.action = 'dodge';
      defender.x = isP1 ? defender.baseX + 70 : defender.baseX - 70;
      this.notify();
    } else if (isBlock) {
      defender.action = 'block';
      defender.isGuarding = true;
      this.notify();
    }

    // Tempo de preparação / windup do golpe
    await this.sleep(220);

    // 2. MOMENTO DO IMPACTO! (A vida SÓ muda aqui!)
    attacker.actionTimeMs = 240;

    const damageValue = (damageEv?.value || critEv?.value || 0);

    // Calcular coordenadas da colisão na tela
    const impactX = (attacker.x + defender.x) / 2;
    const impactY = attacker.y - 60;

    if (isDodge) {
      // Esquiva bem sucedida: 0 de dano!
      this.callbacks.onFloatingNumber(defender.x, impactY, '💨 ESQUIVOU!', 'dodge');
    } else if (isBlock) {
      // Bloqueio bem sucedido
      this.callbacks.onHitEffect(impactX, impactY, 'hit_blocked');
      this.callbacks.onScreenShake(this.prefersReducedMotion ? 0 : 4);
      defender.displayedHp = Math.max(0, defenderFinalData.currentHp);
      defender.isHit = true;
      this.callbacks.onFloatingNumber(defender.x, impactY, `🛡️ BLOQUEADO! -${damageValue} HP`, 'block');
    } else {
      // Impacto direto
      const hitType: ImpactEffectType = isSpecial ? 'special_blast' : critEv ? 'hit_crit' : 'hit_heavy';
      this.callbacks.onHitEffect(impactX, impactY, hitType);
      this.callbacks.onScreenShake(this.prefersReducedMotion ? 0 : critEv ? 12 : isSpecial ? 14 : 7);

      // Knockback proporcional ao dano (com limite)
      const knockback = Math.min(45, Math.max(12, damageValue * 0.9));
      defender.x = isP1 ? defender.baseX + knockback : defender.baseX - knockback;
      defender.action = 'hit';
      defender.isHit = true;

      // ATUALIZAR VIDA NO FRAME DO IMPACTO!
      defender.displayedHp = Math.max(0, defenderFinalData.currentHp);

      const floaterType = critEv ? 'crit' : 'damage';
      const floaterText = critEv ? `💥 CRÍTICO! -${damageValue} HP` : `-${damageValue} HP`;
      this.callbacks.onFloatingNumber(defender.x, impactY, floaterText, floaterType);
    }

    this.notify();

    // Duração do impacto e recuperação
    await this.sleep(350);

    // 3. Retornar à posição de base
    attacker.x = attacker.baseX;
    attacker.action = 'idle';
    attacker.actionTimeMs = 0;

    defender.x = defender.baseX;
    defender.isHit = false;
    defender.isGuarding = false;
    if (defender.displayedHp > 0) {
      defender.action = 'idle';
    }
    this.notify();

    await this.sleep(250);
  }

  /**
   * Efeitos de status de fim de turno (ex: CPI contínua, veneno)
   */
  private async stepStatusTick(st: TurnEvent) {
    const targetSide = st.target || st.actor;
    const target = targetSide === 'p1' ? this.p1State : this.p2State;

    if (st.value && st.value > 0) {
      target.action = 'hit';
      target.isHit = true;
      target.displayedHp = Math.max(0, target.displayedHp - st.value);
      this.callbacks.onFloatingNumber(target.x, target.y - 70, `🔥 -${st.value} HP`, 'damage');
      this.callbacks.onScreenShake(this.prefersReducedMotion ? 0 : 3);
      this.notify();

      await this.sleep(300);
      target.isHit = false;
      target.action = 'idle';
      this.notify();
    }
  }

  /**
   * Finalização de Batalha (Nocaute + Vitória)
   */
  private async stepGameOver(winner: 'p1' | 'p2' | 'draw') {
    if (winner === 'p1') {
      this.p1State.action = 'victory';
      this.p2State.action = 'ko';
    } else if (winner === 'p2') {
      this.p1State.action = 'ko';
      this.p2State.action = 'victory';
    } else {
      this.p1State.action = 'ko';
      this.p2State.action = 'ko';
    }
    this.notify();
    await this.sleep(1000);
  }
}
