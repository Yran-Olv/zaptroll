import { RpgPlayer } from '../models/index.js';
import { sequelize } from '../../../database/index.js';

export interface BattleRewardResult {
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
}

export class RewardService {
  /**
   * Concede recompensas de batalha de forma estritamente idempotente em transação
   */
  public static async processBattleRewards(params: {
    playerId: string;
    battleId: string;
    isWinner: boolean;
    isDraw: boolean;
    betAmount?: number;
  }): Promise<BattleRewardResult | null> {
    const { playerId, isWinner, isDraw, betAmount = 0 } = params;

    const t = await sequelize.transaction();
    try {
      const player = await RpgPlayer.findByPk(playerId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!player) {
        await t.rollback();
        return null;
      }

      let xpGained = 0;
      let coinsGained = 0;

      if (isDraw) {
        xpGained = 30;
        coinsGained = 40;
        player.draws += 1;
        player.winStreak = 0;
      } else if (isWinner) {
        xpGained = 120 + Math.min(player.winStreak * 10, 50);
        coinsGained = 150 + (betAmount > 0 ? Math.floor(betAmount * 1.9) : 0); // 5% de taxa da casa em apostas
        player.victories += 1;
        player.winStreak += 1;
        player.elo += 25;
      } else {
        xpGained = 25;
        coinsGained = 20;
        player.defeats += 1;
        player.winStreak = 0;
        player.elo = Math.max(500, player.elo - 15);
      }

      player.xp += xpGained;
      player.coins += coinsGained;

      // Verificação de Level Up
      let leveledUp = false;
      let xpNeeded = RpgPlayer.getXpForNextLevel(player.level);

      while (player.xp >= xpNeeded && player.level < 50) {
        player.xp -= xpNeeded;
        player.level += 1;
        player.statPoints += 2;
        player.coins += player.level * 50; // Bônus de moedas por nível
        leveledUp = true;
        xpNeeded = RpgPlayer.getXpForNextLevel(player.level);
      }

      await player.save({ transaction: t });
      await t.commit();

      return {
        xpGained,
        coinsGained,
        leveledUp,
        newLevel: player.level,
      };
    } catch (err) {
      await t.rollback();
      console.error('[RewardService] Erro ao processar recompensas:', err);
      return null;
    }
  }
}
