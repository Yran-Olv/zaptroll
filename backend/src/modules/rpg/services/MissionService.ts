import { RpgPlayer } from '../models/index.js';

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  rewardCoins: number;
  rewardXp: number;
  emoji: string;
}

export const DAILY_MISSIONS: MissionDefinition[] = [
  {
    id: 'batalhas_2',
    title: 'Voz na Tribuna',
    description: 'Disputar pelo menos 2 debates ou duelos na arena',
    targetCount: 2,
    rewardCoins: 120,
    rewardXp: 60,
    emoji: '🎙️',
  },
  {
    id: 'vitoria_1',
    title: 'Discurso Vitorioso',
    description: 'Vencer 1 batalha política (PvP ou PvE)',
    targetCount: 1,
    rewardCoins: 150,
    rewardXp: 80,
    emoji: '🏆',
  },
  {
    id: 'loja_1',
    title: 'Investimento de Gabinete',
    description: 'Comprar ou equipar um item da loja de Brasília',
    targetCount: 1,
    rewardCoins: 100,
    rewardXp: 50,
    emoji: '💼',
  },
];

export class MissionService {
  /**
   * Calcula o progresso de missões de forma pura a partir dos atributos do jogador
   */
  public static calculateMissionProgress(stats: {
    victories: number;
    defeats: number;
    draws: number;
    bonusHp: number;
    bonusAtk: number;
  }): Array<MissionDefinition & { current: number; completed: boolean }> {
    const totalBattles = stats.victories + stats.defeats + stats.draws;
    return DAILY_MISSIONS.map((m) => {
      let current = 0;
      if (m.id === 'batalhas_2') current = Math.min(m.targetCount, totalBattles);
      else if (m.id === 'vitoria_1') current = Math.min(m.targetCount, stats.victories > 0 ? 1 : 0);
      else if (m.id === 'loja_1') current = stats.bonusHp > 0 || stats.bonusAtk > 0 ? 1 : 0;

      return {
        ...m,
        current,
        completed: current >= m.targetCount,
      };
    });
  }

  /**
   * Retorna as missões diárias do jogador formatadas para o WhatsApp ou WebView
   */
  public static async getDailyMissions(phone: string, userName?: string): Promise<{
    missions: Array<MissionDefinition & { current: number; completed: boolean }>;
    formatted: string;
  }> {
    let player: any = null;
    try {
      player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
      if (!player) {
        player = await RpgPlayer.create({
          whatsappPhone: phone,
          name: userName || 'Candidato',
        });
      }
    } catch {
      player = {
        name: userName || 'Candidato',
        victories: 0,
        defeats: 0,
        draws: 0,
        bonusHp: 0,
        bonusAtk: 0,
      };
    }

    const missionStatus = this.calculateMissionProgress(player);

    const lines = [
      `📜 *PAINEL DE METAS & MISSÕES DIÁRIAS* 🏛️`,
      `Parlamentar: *${player.name}*`,
      '',
    ];

    for (const m of missionStatus) {
      const statusIcon = m.completed ? '✅ *(CONCLUÍDA)*' : `⏳ (${m.current}/${m.targetCount})`;
      lines.push(`${m.emoji} *${m.title}* ${statusIcon}`);
      lines.push(`   📝 ${m.description}`);
      lines.push(`   🎁 Recompensa: *+${m.rewardCoins} R$* | *+${m.rewardXp} XP*`);
      lines.push('');
    }

    lines.push('💡 _As missões renovam a cada 24 horas. Cumpra suas metas para subir de nível mais rápido!_');

    return {
      missions: missionStatus,
      formatted: lines.join('\n'),
    };
  }
}
