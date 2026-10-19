import { CombatEngine, FighterCombatState, CardCombatState } from './CombatEngine.js';

export interface SimulationResult {
  totalBattles: number;
  averageTurns: number;
  characterWinRates: Record<string, { wins: number; matches: number; winRatePct: number }>;
}

export class BalanceSimulator {
  public static runSimulations(
    characters: FighterCombatState[],
    cards: CardCombatState[],
    battlesPerPair = 50
  ): SimulationResult {
    const stats: Record<string, { wins: number; matches: number; winRatePct: number }> = {};
    for (const c of characters) {
      stats[c.id] = { wins: 0, matches: 0, winRatePct: 0 };
    }

    let totalTurns = 0;
    let totalBattles = 0;

    for (let i = 0; i < characters.length; i++) {
      for (let j = 0; j < characters.length; j++) {
        if (i === j) continue;
        const c1 = characters[i];
        const c2 = characters[j];

        for (let b = 0; b < battlesPerPair; b++) {
          totalBattles++;
          stats[c1.id].matches++;
          stats[c2.id].matches++;

          const p1: FighterCombatState = { ...c1, currentHp: c1.maxHp, currentEnergy: 4, activeStatuses: [], shield: 0, comboStreak: [], passiveTriggered: false };
          const p2: FighterCombatState = { ...c2, currentHp: c2.maxHp, currentEnergy: 4, activeStatuses: [], shield: 0, comboStreak: [], passiveTriggered: false };

          let turn = 1;
          let seed = 1000 + b * 13;

          while (turn <= 20) {
            const p1Card = cards[(b + turn) % cards.length];
            const p2Card = cards[(b + turn * 2) % cards.length];

            const result = CombatEngine.resolveTurn({
              turnNumber: turn,
              rngSeed: seed,
              p1,
              p2,
              p1Card,
              p2Card,
            });

            p1.currentHp = result.p1.currentHp;
            p1.currentEnergy = result.p1.currentEnergy;
            p2.currentHp = result.p2.currentHp;
            p2.currentEnergy = result.p2.currentEnergy;

            if (result.winner !== 'none') {
              if (result.winner === 'p1') stats[c1.id].wins++;
              else if (result.winner === 'p2') stats[c2.id].wins++;
              totalTurns += turn;
              break;
            }

            turn++;
            seed += 7;
          }

          if (turn > 20) {
            totalTurns += 20;
          }
        }
      }
    }

    for (const key of Object.keys(stats)) {
      stats[key].winRatePct = Math.round((stats[key].wins / (stats[key].matches || 1)) * 100);
    }

    return {
      totalBattles,
      averageTurns: Math.round((totalTurns / (totalBattles || 1)) * 10) / 10,
      characterWinRates: stats,
    };
  }
}
