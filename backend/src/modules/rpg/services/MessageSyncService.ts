import { WaClient } from 'zapo-js';
import { RpgBattle, RpgBattleParticipant, RpgCharacter } from '../models/index.js';
import { RpgTokenService } from './RpgTokenService.js';
import { config } from '../../../config/index.js';
import { CombatTurnResult } from '../engine/CombatEngine.js';

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
   * Formata a mensagem de status da arena de batalha
   */
  public static async formatBattleMessage(
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    lastSummary?: string
  ): Promise<string> {
    const p1Char = await RpgCharacter.findByPk(p1.characterId);
    const p2Char = await RpgCharacter.findByPk(p2.characterId);

    const human = !p1.isBot ? p1 : !p2.isBot ? p2 : p1;
    const token = RpgTokenService.generateBattleToken(battle.id, human?.phone || undefined, false);
    const arenaUrl = `${config.appUrl}/rpg/batalha/${battle.id}?t=${token}`;

    const lines: string[] = [];
    lines.push('🥊 *ZAPTROLL RPG — ARENA POLÍTICA* 🏛️');
    lines.push(`⚔️ *${p1.name}*  _VS_  *${p2.name}*`);
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

    // Resumo da ação se houver
    if (lastSummary) {
      lines.push('📜 *ACONTECIMENTOS DO TURNO:*');
      lines.push(lastSummary);
      lines.push('');
    }

    if (battle.status === 'finished') {
      const winner =
        battle.winnerPlayerId === p1.playerId
          ? p1.name
          : battle.winnerPlayerId === p2.playerId
          ? p2.name
          : null;
      if (winner) {
        lines.push(`🏆 *VENCEDOR:* 👑 *${winner.toUpperCase()}* levou o mandato e venceu o duelo político!`);
      } else {
        lines.push('⚖️ *FIM DE LUTA:* Empate regimental!');
      }
    } else {
      lines.push('🃏 *ESCOLHA SUAS CARTAS NA ARENA WEB:*');
      lines.push('📲 *Toque no link abaixo para ver suas cartas e escolher sua jogada:*');
      lines.push(`🔗 ${arenaUrl}`);
      lines.push('');
      lines.push('⏱️ *Tempo para decisão:* 45 segundos');
      lines.push('👉 *Ou responda com 1, 2, 3 ou 4 neste grupo para jogar rápido!*');
    }

    return lines.join('\n');
  }

  /**
   * Envia uma nova mensagem ou edita a existente em tempo real no WhatsApp
   */
  public static async sendOrEditBattleMessage(
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
      const creds = client.getCredentials?.() || null;
      const ownParticipant = creds?.meLid || creds?.meJid;
      const isGroup = targetJid.endsWith('@g.us');

      let edited = false;

      // 1. Se já existe mensagem anterior da batalha, tenta EDITAR a mensagem no WhatsApp
      if (battle.lastMessageId) {
        try {
          await client.message.send(
            targetJid,
            {
              type: 'text',
              text,
              linkPreview: true,
            } as any,
            {
              editKey: {
                id: battle.lastMessageId,
                ...(isGroup && ownParticipant ? { participant: ownParticipant } : {}),
              },
            }
          );
          edited = true;
          battle.lastMessageTimestamp = new Date();
          await battle.save();
        } catch (editErr: any) {
          console.warn(
            `[MessageSyncService] Falha ao editar mensagem ${battle.lastMessageId}:`,
            editErr?.message || editErr
          );
          edited = false;
        }
      }

      // 2. Se for a mensagem inaugural (Turno 1) ou se a edição não pôde ser aplicada:
      if (!edited) {
        const sendResult = await client.message.send(targetJid, {
          type: 'text',
          text,
          linkPreview: true,
        } as any);

        if (sendResult?.id) {
          battle.lastMessageId = sendResult.id;
          battle.lastMessageTimestamp = new Date();
          await battle.save();
        }
      }
    } catch (err: any) {
      console.warn(
        `[MessageSyncService] Falha ao sincronizar mensagem da batalha ${battle.id}:`,
        err?.message || err
      );
    }
  }

  /**
   * Sincroniza a mensagem da batalha (alias compatível)
   */
  public static async syncBattleMessage(
    client: WaClient,
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    summary?: string
  ): Promise<void> {
    return this.sendOrEditBattleMessage(client, battle, p1, p2, summary);
  }

  /**
   * Sincroniza a narrativa do turno passo a passo:
   * 1. Edita com o primeiro golpe ("Yran deu primeiro soco...")
   * 2. Aguarda um breve intervalo (1.5s)
   * 3. Edita com a reação do adversário ("Bot defendeu...") e o status final do turno.
   */
  public static async syncBattleTurnNarrative(
    client: WaClient,
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    combatResult: CombatTurnResult
  ): Promise<void> {
    const rawLines = combatResult.logSummary
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Linhas de ações dos lutadores (iniciadas com "• ")
    const actionLines = rawLines.filter((l) => l.startsWith('• '));

    if (actionLines.length >= 2 && battle.lastMessageId) {
      // Passo 1: Edita a mensagem mostrando a primeira ação
      const firstActionSummary = [
        `⚔️ *EM COMBATE:*`,
        actionLines[0],
        `⏳ Processando resposta do oponente...`,
      ].join('\n');

      await this.sendOrEditBattleMessage(client, battle, p1, p2, firstActionSummary);

      // Intervalo dramático de 1.5s
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Passo 2: Edita a mensagem com o desfecho completo do turno
    await this.sendOrEditBattleMessage(client, battle, p1, p2, combatResult.logSummary);
  }
}
