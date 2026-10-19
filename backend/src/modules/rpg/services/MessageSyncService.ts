import { WaClient } from 'zapo-js';
import { RpgBattle, RpgBattleParticipant, RpgCharacter, RpgCard } from '../models/index.js';
import { RpgTokenService } from './RpgTokenService.js';
import { config } from '../../../config/index.js';

export class MessageSyncService {
  /**
   * Constrói barra visual de vida em emojis (ex: 🟩🟩🟩🟨⬜ 64/100)
   */
  public static renderHpBar(current: number, max: number): string {
    const pct = Math.max(0, Math.min(1, current / max));
    const totalBlocks = 8;
    const filled = Math.round(pct * totalBlocks);

    let color = '🟩';
    if (pct <= 0.25) color = '🟥';
    else if (pct <= 0.5) color = '🟨';

    const bar = color.repeat(filled) + '⬜'.repeat(totalBlocks - filled);
    return `${bar} ${current}/${max} HP`;
  }

  /**
   * Formata a mensagem completa de status do turno da arena
   */
  public static async formatBattleMessage(
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    lastSummary?: string
  ): Promise<string> {
    const p1Char = await RpgCharacter.findByPk(p1.characterId);
    const p2Char = await RpgCharacter.findByPk(p2.characterId);

    const token = RpgTokenService.generateBattleToken(battle.id, undefined, true);
    const arenaUrl = `${config.appUrl}/rpg/batalha/${battle.id}?t=${token}`;

    const lines: string[] = [];
    lines.push('🥊 *ZAPTROLL RPG — ARENA POLÍTICA* 🏛️');
    lines.push(`📍 *Cenário:* ${battle.arena.toUpperCase()} • *Turno ${battle.currentTurn}/${battle.maxTurns}*`);
    lines.push('');

    // Placar Lutador 1
    lines.push(`${p1Char?.avatarEmoji || '👤'} *${p1.name}* (${p1Char?.title || 'Candidato'})`);
    lines.push(`❤️ ${this.renderHpBar(p1.currentHp, p1.maxHp)}`);
    lines.push(`⚡ Energia: ${p1.currentEnergy}/${p1.maxEnergy} | 🔥 Ibope: ${p1.popularity}%`);
    lines.push('');

    // Placar Lutador 2
    lines.push(`${p2Char?.avatarEmoji || '👤'} *${p2.name}* (${p2Char?.title || 'Candidato'})`);
    lines.push(`❤️ ${this.renderHpBar(p2.currentHp, p2.maxHp)}`);
    lines.push(`⚡ Energia: ${p2.currentEnergy}/${p2.maxEnergy} | 🔥 Ibope: ${p2.popularity}%`);
    lines.push('');

    // Resumo da última ação se houver
    if (lastSummary) {
      lines.push('📜 *ÚLTIMOS ACONTECIMENTOS:*');
      lines.push(lastSummary);
      lines.push('');
    }

    if (battle.status === 'finished') {
      const winner = battle.winnerPlayerId === p1.playerId ? p1.name : battle.winnerPlayerId === p2.playerId ? p2.name : null;
      if (winner) {
        lines.push(`🏆 *VENCEDOR:* 👑 *${winner.toUpperCase()}* levou o mandato!`);
      } else {
        lines.push('⚖️ *FIM DE LUTA:* Empate regimental!');
      }
    } else {
      lines.push('⏱️ *ESCOLHAM SUAS CARTAS!* (45 segundos)');
      lines.push('👉 _Envie o número da carta ou confirme pela Arena Web:_');
      lines.push(`🔗 *Ver Arena ao Vivo:* ${arenaUrl}`);
    }

    return lines.join('\n');
  }

  /**
   * Sincroniza a mensagem da batalha no grupo do WhatsApp:
   * Tenta editar a mensagem anterior via Zapo; se falhar ou se for muito antiga, envia nova mensagem e atualiza o ID.
   */
  public static async syncBattleMessage(
    client: WaClient,
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    summary?: string
  ): Promise<void> {
    const targetJid = battle.groupId || p1.phone || p2.phone;
    if (!targetJid) return;

    try {
      const text = await this.formatBattleMessage(battle, p1, p2, summary);

      // Tenta editar a mensagem anterior se existir e tiver menos de 10 minutos
      let edited = false;
      if (battle.lastMessageId && battle.lastMessageTimestamp) {
        const elapsedMinutes = (Date.now() - new Date(battle.lastMessageTimestamp).getTime()) / (1000 * 60);
        if (elapsedMinutes < 12) {
          try {
            await client.message.send(targetJid, {
              protocolMessage: {
                key: {
                  remoteJid: targetJid,
                  fromMe: true,
                  id: battle.lastMessageId,
                },
                type: 14, // MESSAGE_EDIT
                editedMessage: {
                  conversation: text,
                },
              },
            } as any);
            edited = true;
          } catch (editErr) {
            // Edição não suportada ou falhou, fará fallback para nova mensagem
            edited = false;
          }
        }
      }

      if (!edited) {
        // Envio de nova mensagem controlada
        const sendResult = await client.message.send(targetJid, {
          type: 'text',
          text,
        });

        if (sendResult?.id) {
          battle.lastMessageId = sendResult.id;
          battle.lastMessageTimestamp = new Date();
          await battle.save();
        }
      }
    } catch (err: any) {
      console.warn(`[MessageSyncService] Falha ao sincronizar mensagem da batalha ${battle.id}:`, err?.message || err);
    }
  }
}
