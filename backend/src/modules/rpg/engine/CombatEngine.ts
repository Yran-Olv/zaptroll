export type FighterSide = 'p1' | 'p2';

export interface FighterCombatState {
  id: string; // playerId ou 'bot'
  name: string;
  characterId: string;
  characterClass: 'demagogo' | 'tecnocrata' | 'populista' | 'estrategista' | 'militante';
  affinity: 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao';
  weakness: 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao';
  resistance: 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao';
  maxHp: number;
  currentHp: number;
  maxEnergy: number;
  currentEnergy: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
  baseCrit: number;
  popularity: number; // 0-100%
  rage: number; // 0-100%
  activeStatuses: Array<{ type: string; duration: number; potency: number }>;
  passiveName: string;
  passiveEffect: { type: string; value: number; description: string };
  passiveTriggered: boolean;
  comboStreak: string[];
  shield: number;
  allyUsed: boolean;
}

export interface CardCombatState {
  id: string;
  name: string;
  category: 'forca' | 'defesa' | 'estrategia' | 'utilidade';
  element: 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao' | 'neutro';
  energyCost: number;
  power: number;
  priority: number;
  cooldown: number;
  targetEffect?: any;
  selfEffect?: any;
  isBluff?: boolean;
  isComboStarter?: boolean;
  comboFollowUp?: string | null;
  emoji: string;
}

export interface CombatTurnInput {
  turnNumber: number;
  rngSeed: number;
  p1: FighterCombatState;
  p2: FighterCombatState;
  p1Card: CardCombatState;
  p2Card: CardCombatState;
}

export interface CombatEvent {
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
  actor: FighterSide;
  target?: FighterSide;
  value?: number;
  text: string;
}

export interface CombatTurnResult {
  p1: FighterCombatState;
  p2: FighterCombatState;
  events: CombatEvent[];
  logSummary: string;
  winner: 'p1' | 'p2' | 'draw' | 'none';
  isSuddenDeath: boolean;
}

/**
 * Pseudo-random generator determinístico baseado em seed Mulberry32
 */
class DeterministicRng {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  public next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export class CombatEngine {
  /**
   * Tabela de eficácia de elementos ideológicos
   */
  public static getAffinityMultiplier(
    attackerElement: string,
    defenderAffinity: string,
    defenderWeakness: string,
    defenderResistance: string
  ): { multiplier: number; description: string | null } {
    if (attackerElement === defenderWeakness) {
      return { multiplier: 1.25, description: 'Super eficaz! 🎯' };
    }
    if (attackerElement === defenderResistance) {
      return { multiplier: 0.8, description: 'Pouco eficaz... 🛡️' };
    }
    return { multiplier: 1.0, description: null };
  }

  /**
   * Resolução pura e determinística de um turno de combate
   */
  public static resolveTurn(input: CombatTurnInput): CombatTurnResult {
    const rng = new DeterministicRng(input.rngSeed + input.turnNumber * 100);
    const events: CombatEvent[] = [];
    const narrativeLines: string[] = [];

    // Clones profundos dos estados para garantir imutabilidade do input
    const p1: FighterCombatState = JSON.parse(JSON.stringify(input.p1));
    const p2: FighterCombatState = JSON.parse(JSON.stringify(input.p2));
    const p1Card = input.p1Card;
    const p2Card = input.p2Card;

    narrativeLines.push(`⚔️ *TURNO ${input.turnNumber}*`);

    // 1. Desconto de custos de energia
    p1.currentEnergy = Math.max(0, p1.currentEnergy - p1Card.energyCost);
    p2.currentEnergy = Math.max(0, p2.currentEnergy - p2Card.energyCost);

    // 2. Revelação das cartas
    events.push({
      type: 'card_reveal',
      actor: 'p1',
      text: `${p1.name} usou ${p1Card.emoji} ${p1Card.name}!`,
    });
    events.push({
      type: 'card_reveal',
      actor: 'p2',
      text: `${p2.name} usou ${p2Card.emoji} ${p2Card.name}!`,
    });
    narrativeLines.push(`• ${p1.name} usou *${p1Card.name}* ${p1Card.emoji}`);
    narrativeLines.push(`• ${p2.name} usou *${p2Card.name}* ${p2Card.emoji}`);

    // 3. Aplicação de auto-efeitos imediatos (escudos, cura, energia)
    this.applySelfEffects(p1, p1Card, 'p1', events, narrativeLines);
    this.applySelfEffects(p2, p2Card, 'p2', events, narrativeLines);

    // 4. Verificação de status pré-ação (ex: Fake News pode anular golpe com 25% de chance)
    const p1Fails = this.checkStatusFailure(p1, rng, 'p1', events, narrativeLines);
    const p2Fails = this.checkStatusFailure(p2, rng, 'p2', events, narrativeLines);

    // 5. Determinação da ordem de resolução por prioridade da carta e velocidade
    let actors: Array<{ side: FighterSide; fighter: FighterCombatState; target: FighterCombatState; card: CardCombatState; targetCard: CardCombatState; failed: boolean }>;

    if (p1Card.priority > p2Card.priority) {
      actors = [
        { side: 'p1', fighter: p1, target: p2, card: p1Card, targetCard: p2Card, failed: p1Fails },
        { side: 'p2', fighter: p2, target: p1, card: p2Card, targetCard: p1Card, failed: p2Fails },
      ];
    } else if (p2Card.priority > p1Card.priority) {
      actors = [
        { side: 'p2', fighter: p2, target: p1, card: p2Card, targetCard: p1Card, failed: p2Fails },
        { side: 'p1', fighter: p1, target: p2, card: p1Card, targetCard: p2Card, failed: p1Fails },
      ];
    } else {
      // Empate na prioridade: velocidade decide (com desempate por RNG determinístico)
      const p1Speed = p1.baseSpeed + rng.next();
      const p2Speed = p2.baseSpeed + rng.next();
      if (p1Speed >= p2Speed) {
        actors = [
          { side: 'p1', fighter: p1, target: p2, card: p1Card, targetCard: p2Card, failed: p1Fails },
          { side: 'p2', fighter: p2, target: p1, card: p2Card, targetCard: p1Card, failed: p2Fails },
        ];
      } else {
        actors = [
          { side: 'p2', fighter: p2, target: p1, card: p2Card, targetCard: p1Card, failed: p2Fails },
          { side: 'p1', fighter: p1, target: p2, card: p1Card, targetCard: p2Card, failed: p1Fails },
        ];
      }
    }

    // 6. Execução das ações
    for (const action of actors) {
      if (action.failed) continue;
      if (action.fighter.currentHp <= 0) break; // Lutador já foi nocauteado

      this.executeAction(action.side, action.fighter, action.target, action.card, action.targetCard, rng, events, narrativeLines);
    }

    // 7. Efeitos de fim de turno (CPI contínua, venenos)
    this.applyEndTurnStatuses(p1, 'p1', events, narrativeLines);
    this.applyEndTurnStatuses(p2, 'p2', events, narrativeLines);

    // 8. Regeneração base de energia (+2 por turno, máx maxEnergy)
    p1.currentEnergy = Math.min(p1.maxEnergy, p1.currentEnergy + 2);
    p2.currentEnergy = Math.min(p2.maxEnergy, p2.currentEnergy + 2);

    // Reset de escudos de turno
    p1.shield = 0;
    p2.shield = 0;

    // 9. Verificação de Passiva de Sobrevivência (Ex: Reeleição Garantida do Doutor Promessa)
    this.checkPassives(p1, 'p1', events, narrativeLines);
    this.checkPassives(p2, 'p2', events, narrativeLines);

    // 10. Verificação de Condição de Vitória / Fim de Batalha
    let winner: 'p1' | 'p2' | 'draw' | 'none' = 'none';
    let isSuddenDeath = false;

    if (p1.currentHp <= 0 && p2.currentHp <= 0) {
      winner = 'draw';
      narrativeLines.push('💥 *EMPATE TÉCNICO!* Ambos os lutadores foram nocauteados juntos!');
      events.push({ type: 'draw', actor: 'p1', text: 'Empate duplo!' });
    } else if (p1.currentHp <= 0) {
      winner = 'p2';
      narrativeLines.push(`🏆 *VITÓRIA DE ${p2.name.toUpperCase()}!* ${p1.name} foi à lona!`);
      events.push({ type: 'ko', actor: 'p2', target: 'p1', text: `${p2.name} venceu por nocaute!` });
    } else if (p2.currentHp <= 0) {
      winner = 'p1';
      narrativeLines.push(`🏆 *VITÓRIA DE ${p1.name.toUpperCase()}!* ${p2.name} foi à lona!`);
      events.push({ type: 'ko', actor: 'p1', target: 'p2', text: `${p1.name} venceu por nocaute!` });
    } else if (input.turnNumber >= 20) {
      // Limite de turnos: vence quem tiver maior porcentagem de vida
      const p1Pct = p1.currentHp / p1.maxHp;
      const p2Pct = p2.currentHp / p2.maxHp;
      if (Math.abs(p1Pct - p2Pct) < 0.01) {
        winner = 'draw';
        narrativeLines.push('⚖️ Limite de 20 turnos atingido com empate exato de vida!');
      } else if (p1Pct > p2Pct) {
        winner = 'p1';
        narrativeLines.push(`🏁 Limite de turnos! ${p1.name} venceu por pontos (${Math.round(p1Pct * 100)}% vs ${Math.round(p2Pct * 100)}% de HP)!`);
      } else {
        winner = 'p2';
        narrativeLines.push(`🏁 Limite de turnos! ${p2.name} venceu por pontos (${Math.round(p2Pct * 100)}% vs ${Math.round(p1Pct * 100)}% de HP)!`);
      }
    }

    return {
      p1,
      p2,
      events,
      logSummary: narrativeLines.join('\n'),
      winner,
      isSuddenDeath,
    };
  }

  private static applySelfEffects(
    fighter: FighterCombatState,
    card: CardCombatState,
    side: FighterSide,
    events: CombatEvent[],
    lines: string[]
  ) {
    if (card.selfEffect) {
      if (card.selfEffect.shield) {
        fighter.shield = card.selfEffect.shield;
        events.push({
          type: 'block',
          actor: side,
          value: card.selfEffect.shield,
          text: `${fighter.name} levantou defesa de ${card.selfEffect.shield} pts!`,
        });
      }
      if (card.selfEffect.heal) {
        const heal = Math.min(fighter.maxHp - fighter.currentHp, card.selfEffect.heal);
        fighter.currentHp += heal;
        events.push({
          type: 'heal',
          actor: side,
          value: heal,
          text: `${fighter.name} recuperou +${heal} de HP!`,
        });
        lines.push(`💚 ${fighter.name} recuperou +${heal} de vida.`);
      }
      if (card.selfEffect.energyGain) {
        fighter.currentEnergy = Math.min(fighter.maxEnergy, fighter.currentEnergy + card.selfEffect.energyGain);
      }
    }
  }

  private static checkStatusFailure(
    fighter: FighterCombatState,
    rng: DeterministicRng,
    side: FighterSide,
    events: CombatEvent[],
    lines: string[]
  ): boolean {
    const fakeNews = fighter.activeStatuses.find((s) => s.type === 'fake_news');
    if (fakeNews) {
      const roll = rng.next();
      if (roll < (fakeNews.potency || 25) / 100) {
        events.push({
          type: 'status_applied',
          actor: side,
          text: `${fighter.name} caiu em Fake News e errou a jogada!`,
        });
        lines.push(`❌ ${fighter.name} foi desorientado por Fake News e sua jogada falhou!`);
        return true;
      }
    }

    const atordoado = fighter.activeStatuses.find((s) => s.type === 'atordoado');
    if (atordoado) {
      events.push({
        type: 'status_applied',
        actor: side,
        text: `${fighter.name} está atordoado pelo Pedido de Vista!`,
      });
      lines.push(`⏳ ${fighter.name} está paralisado por Pedido de Vista e perdeu a vez!`);
      return true;
    }

    return false;
  }

  private static executeAction(
    side: FighterSide,
    actor: FighterCombatState,
    target: FighterCombatState,
    card: CardCombatState,
    targetCard: CardCombatState,
    rng: DeterministicRng,
    events: CombatEvent[],
    lines: string[]
  ) {
    if (card.category === 'defesa' && card.power === 0) {
      // Carta puramente defensiva já ativou auto-efeito
      return;
    }

    if (card.category === 'utilidade') {
      if (card.isBluff) {
        lines.push(`🃏 ${actor.name} fingiu um golpe pesado, desestabilizou o adversário e absorveu energia!`);
      } else {
        // Provocação
        actor.popularity = Math.min(100, actor.popularity + 25);
        lines.push(`🗣️ ${actor.name} provocou em rede nacional! Ibope subiu para ${actor.popularity}%.`);
      }
      return;
    }

    // Cálculo do Dano
    let basePower = card.power;
    const atkMultiplier = 0.8;
    const rawAttack = basePower + actor.baseAtk * atkMultiplier;

    // Afinidade Ideológica
    const affinity = this.getAffinityMultiplier(
      card.element,
      target.affinity,
      target.weakness,
      target.resistance
    );

    // Sistema Pedra-Papel-Tesoura suave
    let typeMultiplier = 1.0;
    if (card.category === 'forca' && targetCard.category === 'estrategia') {
      typeMultiplier = 1.2; // Força interrompe Estratégia
    } else if (card.category === 'estrategia' && targetCard.category === 'defesa') {
      typeMultiplier = 1.25; // Estratégia fura Defesa
    } else if (card.category === 'defesa' && targetCard.category === 'forca') {
      typeMultiplier = 0.6; // Defesa reduz Força
    }

    // Crítico
    const critRoll = rng.next();
    const isCrit = critRoll < actor.baseCrit;
    const critMultiplier = isCrit ? 1.5 : 1.0;

    // Combo
    let comboMultiplier = 1.0;
    if (actor.comboStreak.length > 0 && card.id === actor.comboStreak[actor.comboStreak.length - 1]) {
      comboMultiplier = 1.35;
      lines.push(`🔥 *COMBO CONFIRMADO!* ${actor.name} emendou sequência parlamentar (+35% dano)!`);
      events.push({ type: 'combo', actor: side, text: 'Combo parlamentar confirmado!' });
    }

    // Gestão da cadeia de combo
    if (card.isComboStarter && card.comboFollowUp) {
      actor.comboStreak = [card.comboFollowUp];
    } else {
      actor.comboStreak = [];
    }

    // Mitigação pela defesa e escudos
    let targetMitigation = target.baseDef * 0.5;
    if (targetCard.category === 'defesa' && target.shield > 0) {
      if (target.shield === 100) {
        // Esquiva total
        events.push({
          type: 'dodge',
          actor: side === 'p1' ? 'p2' : 'p1',
          text: `${target.name} esquivou-se perfeitamente com foro privilegiado!`,
        });
        lines.push(`💨 ${target.name} esquivou-se perfeitamente do golpe com foro privilegiado!`);
        return;
      }
      targetMitigation += target.shield;
    }

    let finalDamage = Math.round(
      rawAttack * affinity.multiplier * typeMultiplier * critMultiplier * comboMultiplier - targetMitigation
    );
    finalDamage = Math.max(3, finalDamage);

    // Teto de dano passivo (Ex: Dona Reforma)
    if (target.passiveEffect?.type === 'energy_shield' && finalDamage > target.passiveEffect.value) {
      finalDamage = target.passiveEffect.value;
      lines.push(`📑 [Teto de Gastos] O golpe foi limitado a ${finalDamage} de dano!`);
    }

    target.currentHp = Math.max(0, target.currentHp - finalDamage);

    // Geração de Ibope e Tensão
    actor.popularity = Math.min(100, actor.popularity + 8);
    if (target.characterClass === 'militante') {
      target.rage = Math.min(100, target.rage + Math.round(finalDamage * 0.8));
    }

    // Registro de eventos
    if (isCrit) {
      events.push({
        type: 'crit',
        actor: side,
        value: finalDamage,
        text: `CRÍTICO! ${actor.name} acertou golpe em cheio!`,
      });
      lines.push(`⚡ *GOLPE CRÍTICO!* ${actor.name} causou *${finalDamage} de dano* em ${target.name}!`);
    } else {
      events.push({
        type: 'damage',
        actor: side,
        target: side === 'p1' ? 'p2' : 'p1',
        value: finalDamage,
        text: `${actor.name} causou ${finalDamage} de dano em ${target.name}.`,
      });
      const affText = affinity.description ? ` (${affinity.description})` : '';
      lines.push(`💥 ${actor.name} atingiu ${target.name} causando *${finalDamage} de dano*${affText}.`);
    }

    // Aplicação de status no oponente
    if (card.targetEffect) {
      target.activeStatuses.push({
        type: card.targetEffect.status,
        duration: card.targetEffect.duration || 2,
        potency: card.targetEffect.potency || 10,
      });
      events.push({
        type: 'status_applied',
        actor: side === 'p1' ? 'p2' : 'p1',
        text: `Status ${card.targetEffect.status} aplicado!`,
      });
      lines.push(`⚠️ ${target.name} agora está sob efeito de *${card.targetEffect.status.toUpperCase()}*!`);
    }
  }

  private static applyEndTurnStatuses(
    fighter: FighterCombatState,
    side: FighterSide,
    events: CombatEvent[],
    lines: string[]
  ) {
    const remaining: typeof fighter.activeStatuses = [];

    for (const status of fighter.activeStatuses) {
      if (status.type === 'cpi') {
        const cpiDmg = status.potency || 8;
        fighter.currentHp = Math.max(0, fighter.currentHp - cpiDmg);
        events.push({
          type: 'status_tick',
          actor: side,
          value: cpiDmg,
          text: `CPI causou ${cpiDmg} de dano contínuo em ${fighter.name}!`,
        });
        lines.push(`☠️ A CPI corroeu a barra de ${fighter.name} em *- ${cpiDmg} de HP*!`);
      }

      status.duration -= 1;
      if (status.duration > 0) {
        remaining.push(status);
      }
    }

    fighter.activeStatuses = remaining;
  }

  private static checkPassives(
    fighter: FighterCombatState,
    side: FighterSide,
    events: CombatEvent[],
    lines: string[]
  ) {
    if (fighter.currentHp <= 0 && !fighter.passiveTriggered && fighter.passiveEffect?.type === 'revive_once') {
      fighter.passiveTriggered = true;
      const reviveHp = Math.round(fighter.maxHp * (fighter.passiveEffect.value / 100));
      fighter.currentHp = reviveHp;
      events.push({
        type: 'passive',
        actor: side,
        value: reviveHp,
        text: `${fighter.name} ativou ${fighter.passiveName} e reviveu com ${reviveHp} HP!`,
      });
      lines.push(`👑 *${fighter.passiveName.toUpperCase()}!* ${fighter.name} recusou a derrota e reviveu com *${reviveHp} de HP*!`);
    }
  }
}
