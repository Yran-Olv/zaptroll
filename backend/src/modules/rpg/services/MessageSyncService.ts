import { WaClient } from 'zapo-js';
import crypto from 'crypto';
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
      lines.push('📜 *ÚLTIMOS ACONTECIMENTOS DO TURNO:*');
      lines.push(lastSummary);
      lines.push('');
    }

    if (battle.status === 'finished') {
      const winner = battle.winnerPlayerId === p1.playerId ? p1.name : battle.winnerPlayerId === p2.playerId ? p2.name : null;
      if (winner) {
        lines.push(`🏆 *VENCEDOR:* 👑 *${winner.toUpperCase()}* levou o mandato e venceu o duelo!`);
      } else {
        lines.push('⚖️ *FIM DE LUTA:* Empate regimental!');
      }
    } else {
      // Mostrar cartas do jogador humano para facilitar jogada rápida no WhatsApp
      const human = !p1.isBot ? p1 : !p2.isBot ? p2 : p1;
      if (human && human.hand && human.hand.length > 0) {
        const cards = await RpgCard.findAll({ where: { id: human.hand } });
        const cardMap = new Map(cards.map((c) => [c.id, c]));
        lines.push(`🃏 *SUAS CARTAS NA MÃO (${human.name}):*`);
        human.hand.forEach((cardId, idx) => {
          const c = cardMap.get(cardId);
          if (c) {
            const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][idx] || `[${idx + 1}]`;
            const costIcon = human.currentEnergy >= c.energyCost ? '⚡' : '⚠️⚡';
            lines.push(`${numEmoji} ${c.emoji} *${c.name}* (${costIcon}${c.energyCost}) — ${c.description}`);
          }
        });
        lines.push('');
      }

      lines.push('⏱️ *ESCOLHAM SUAS CARTAS!* (45 segundos para decidir)');
      lines.push('👉 *Responda com 1, 2, 3 ou 4 neste grupo para jogar!*');
      lines.push(`🔗 *Ver Arena ao Vivo:* ${arenaUrl}`);
    }

    return lines.join('\n');
  }

  /**
   * Sincroniza a mensagem da batalha no grupo do WhatsApp:
   * - No turno inicial, envia card com Botão Nativo de Webview (cta_url em tela cheia).
   * - Nos turnos seguintes, edita a mensagem anterior no WhatsApp via editKey.
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
      const token = RpgTokenService.generateBattleToken(battle.id, undefined, true);
      const arenaUrl = `${config.appUrl}/rpg/batalha/${battle.id}?t=${token}`;

      let edited = false;

      // 1. Se já existe mensagem anterior da batalha, EDITA a mensagem anterior!
      if (battle.lastMessageId) {
        try {
          await client.message.send(
            targetJid,
            {
              type: 'text',
              text,
              linkPreview: false,
            } as any,
            {
              editKey: {
                id: battle.lastMessageId,
              },
            }
          );
          edited = true;
          battle.lastMessageTimestamp = new Date();
          await battle.save();
        } catch (editErr: any) {
          console.warn(`[MessageSyncService] Falha ao editar mensagem ${battle.lastMessageId}, reenviando:`, editErr?.message || editErr);
          edited = false;
        }
      }

      // 2. Se for a mensagem inaugural (Turno 1) ou se a edição falhou:
      if (!edited) {
        let sendResult: any = null;

        // Tenta enviar com o Botão Nativo de Webview (padrão Multivus-Barber cta_url / webview_presentation full)
        try {
          const interactivePayload = {
            messageContextInfo: {
              messageSecret: crypto.randomBytes(32),
            },
            interactiveMessage: {
              body: { text },
              footer: { text: '🏛️ Arena Zaptroll RPG • Luta Política' },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                      display_text: '⚔️ Abrir Arena Web',
                      url: arenaUrl,
                      merchant_url: arenaUrl,
                      webview_presentation: 'full',
                      webview_interaction: true,
                    }),
                  },
                ],
                messageVersion: 1,
                messageParamsJson: '{}',
              },
            },
          };

          sendResult = await client.message.send(targetJid, interactivePayload as any);
        } catch (buttonErr: any) {
          console.warn('[MessageSyncService] Envio com botão nativo falhou, enviando como texto simples:', buttonErr?.message || buttonErr);
          sendResult = await client.message.send(targetJid, {
            type: 'text',
            text,
            linkPreview: false,
          } as any);
        }

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
