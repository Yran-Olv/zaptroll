import { CardCombatState, FighterCombatState } from '../engine/CombatEngine.js';

export type BotDifficulty = 'facil' | 'normal' | 'dificil' | 'chefe';
export type BotPersonality = 'agressivo' | 'defensivo' | 'blefador' | 'equilibrado';

export class BotAiService {
  /**
   * Escolhe uma carta para o bot de forma inteligente e justa (sem ler a escolha secreta do oponente!)
   */
  public static selectCard(
    bot: FighterCombatState,
    opponent: FighterCombatState,
    availableCards: CardCombatState[],
    difficulty: BotDifficulty = 'normal',
    personality: BotPersonality = 'equilibrado',
    opponentHistoryCategories: string[] = []
  ): CardCombatState {
    // Filtrar apenas cartas que o bot tem energia suficiente para usar
    const usableCards = availableCards.filter((c) => c.energyCost <= bot.currentEnergy);
    if (usableCards.length === 0) {
      // Se não tiver energia para nenhuma, escolhe a de menor custo
      return availableCards.reduce((prev, curr) => (curr.energyCost < prev.energyCost ? curr : prev));
    }

    // 1. Dificuldade FÁCIL: Escolhe de forma semi-aleatória com leve preferência por força
    if (difficulty === 'facil') {
      const forceCards = usableCards.filter((c) => c.category === 'forca');
      if (forceCards.length > 0 && Math.random() < 0.6) {
        return forceCards[Math.floor(Math.random() * forceCards.length)];
      }
      return usableCards[Math.floor(Math.random() * usableCards.length)];
    }

    // 2. Dificuldade NORMAL: Reage à vida e energia
    if (difficulty === 'normal') {
      const hpPct = bot.currentHp / bot.maxHp;

      // Se a vida estiver baixa (< 35%), tenta defender ou curar
      if (hpPct < 0.35) {
        const defCards = usableCards.filter((c) => c.category === 'defesa');
        if (defCards.length > 0 && Math.random() < 0.7) {
          return defCards[Math.floor(Math.random() * defCards.length)];
        }
      }

      // Se tiver muita energia e golpe especial, usa o mais forte
      if (bot.currentEnergy >= 5) {
        const strongCards = usableCards.filter((c) => c.power >= 40);
        if (strongCards.length > 0) {
          return strongCards[0];
        }
      }

      // Personalidade
      if (personality === 'agressivo') {
        const forceCards = usableCards.filter((c) => c.category === 'forca');
        if (forceCards.length > 0) return forceCards[0];
      }

      return usableCards[Math.floor(Math.random() * usableCards.length)];
    }

    // 3. Dificuldade DIFÍCIL e CHEFE: Analisa o histórico de escolhas do jogador humano
    // Sem nunca ler a carta atual do turno! Analisa apenas tendências anteriores.
    const mostUsedOpponentCategory = this.getMostFrequent(opponentHistoryCategories);

    // Contramedidas estratégicas:
    // Se o oponente costuma usar FORÇA -> Bot prioriza DEFESA
    // Se o oponente costuma usar DEFESA -> Bot prioriza ESTRATÉGIA (fura defesa)
    // Se o oponente costuma usar ESTRATÉGIA -> Bot prioriza FORÇA (interrompe)
    let preferredCategory: 'forca' | 'defesa' | 'estrategia' = 'forca';
    if (mostUsedOpponentCategory === 'forca') {
      preferredCategory = 'defesa';
    } else if (mostUsedOpponentCategory === 'defesa') {
      preferredCategory = 'estrategia';
    } else if (mostUsedOpponentCategory === 'estrategia') {
      preferredCategory = 'forca';
    }

    const matched = usableCards.filter((c) => c.category === preferredCategory);
    if (matched.length > 0) {
      // Ordena pelo maior poder ou efeito
      matched.sort((a, b) => b.power - a.power);
      return matched[0];
    }

    // Fallback inteligente: maior dano acessível
    usableCards.sort((a, b) => b.power - a.power);
    return usableCards[0];
  }

  private static getMostFrequent(items: string[]): string | null {
    if (items.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item] = (counts[item] || 0) + 1;
    }
    let topItem = items[0];
    let topCount = 0;
    for (const [key, val] of Object.entries(counts)) {
      if (val > topCount) {
        topCount = val;
        topItem = key;
      }
    }
    return topItem;
  }
}
