import { RpgBattle, RpgBattleParticipant, RpgCard } from '../models/index.js';
import { TurnResolutionService } from './TurnResolutionService.js';
import { zapoManager } from '../../../integrations/zapo/ZapoConnectionManager.js';
import { Op } from 'sequelize';

export class RpgTurnWorker {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Inicia o monitor de timeout de turnos
   */
  public static start(intervalMs = 5000): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.checkExpiredTurns();
      } catch (err: any) {
        console.error('[RpgTurnWorker] Erro ao processar timeouts:', err.message);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);

    console.log(`⏰ [RpgTurnWorker] Monitor de timeouts de batalha iniciado (${intervalMs}ms).`);
  }

  /**
   * Para o monitor
   */
  public static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Varre e resolve batalhas cujo prazo do turno expirou
   */
  public static async checkExpiredTurns(): Promise<number> {
    const now = new Date();

    const expiredBattles = await RpgBattle.findAll({
      where: {
        status: 'selecting_cards',
        turnDeadline: {
          [Op.lt]: now,
        },
      },
      include: [
        {
          model: RpgBattleParticipant,
          as: 'participants',
        },
      ],
    });

    if (!expiredBattles.length) return 0;

    let processedCount = 0;

    for (const battle of expiredBattles) {
      try {
        const participants = (battle.get('participants') as RpgBattleParticipant[]) || [];
        if (participants.length < 2) continue;

        let needsResolution = false;

        for (const p of participants) {
          if (!p.cardLocked) {
            // Auto-selecionar a primeira carta acessível da mão
            const hand = p.hand || [];
            let pickedCardId = hand[0];

            // Tentar achar uma carta que o jogador consiga pagar
            if (hand.length > 0) {
              const cards = await RpgCard.findAll({ where: { id: hand } });
              const affordable = cards.filter((c) => c.energyCost <= p.currentEnergy);
              if (affordable.length > 0) {
                pickedCardId = affordable[0].id;
              }
            }

            if (pickedCardId) {
              p.selectedCardId = pickedCardId;
              p.cardLocked = true;
              await p.save();
              needsResolution = true;
            }
          }
        }

        const refreshed = await RpgBattleParticipant.findAll({ where: { battleId: battle.id } });
        if (refreshed.every((p) => p.cardLocked) && refreshed.length === 2) {
          await TurnResolutionService.resolveTurn(battle, refreshed[0], refreshed[1]);
          processedCount++;
        }
      } catch (err: any) {
        console.error(`[RpgTurnWorker] Erro na batalha ${battle.id}:`, err.message);
      }
    }

    return processedCount;
  }
}
