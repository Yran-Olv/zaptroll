import { WaClient } from 'zapo-js';
import crypto from 'crypto';
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
   * Constrói o payload com o Botão Nativo de Webview (cta_url em tela cheia)
   */
  public static buildInteractivePayload(text: string, arenaUrl: string) {
    return {
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
      lines.push('🃏 *ESCOLHA SUAS CARTAS:*');
      lines.push('📲 Toque no botão *⚔️ Abrir Arena Web* abaixo para ver suas cartas e jogar ao vivo!');
      lines.push(`🔗 ${arenaUrl}`);
      lines.push('');
      lines.push('⏱️ *Tempo para decisão:* 45 segundos');
      lines.push('👉 *Ou responda com 1, 2, 3 ou 4 neste grupo para jogar rápido!*');
    }

    return lines.join('\n');
  }

  /**
   * Envia uma nova mensagem com Botão Nativo ou edita a existente em tempo real no WhatsApp
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
      const human = !p1.isBot ? p1 : !p2.isBot ? p2 : p1;
      const token = RpgTokenService.generateBattleToken(battle.id, human?.phone || undefined, false);
      const arenaUrl = `${config.appUrl}/rpg/batalha/${battle.id}?t=${token}`;

      const interactivePayload = this.buildInteractivePayload(text, arenaUrl);

      const creds = client.getCredentials?.() || null;
      const ownParticipant = creds?.meLid || creds?.meJid;
      const isGroup = targetJid.endsWith('@g.us');

      let edited = false;

      // 1. Se já existe mensagem anterior da batalha, tenta EDITAR a mensagem no WhatsApp
      if (battle.lastMessageId) {
        // Tentativa A: Editar preservando o card interativo com o botão
        try {
          await client.message.send(
            targetJid,
            interactivePayload as any,
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
        } catch (interactiveEditErr: any) {
          // Tentativa B: Fallback de texto se o cliente do WhatsApp não aceitar edição de interactiveMessage
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
          } catch (textEditErr: any) {
            console.warn(
              `[MessageSyncService] Falha ao editar mensagem ${battle.lastMessageId}:`,
              textEditErr?.message || textEditErr
            );
            edited = false;
          }
        }
      }

      // 2. Se for a mensagem inaugural (Turno 1) ou se a edição não pôde ser aplicada:
      if (!edited) {
        try {
          const sendResult = await client.message.send(targetJid, interactivePayload as any);
          if (sendResult?.id) {
            battle.lastMessageId = sendResult.id;
            battle.lastMessageTimestamp = new Date();
            await battle.save();
          }
        } catch (buttonErr: any) {
          console.warn('[MessageSyncService] Envio com botão nativo falhou, enviando com link preview:', buttonErr);
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
   * Sincroniza a narrativa do turno passo a passo editando a cada ação:
   * 1. Ação 1: Golpe do primeiro combatente + dano/efeitos -> Edita mensagem!
   * 2. Intervalo de 1.8s
   * 3. Ação 2: Reação/contra-ataque do segundo combatente + dano -> Edita mensagem!
   * 4. Intervalo de 1.5s
   * 5. Efeitos contínuos/Passivas se houver -> Edita mensagem!
   * 6. Desfecho completo do turno e atualização do placar -> Edita mensagem com botão Webview!
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

    // Identificar linhas que representam ações (começam com "• ")
    const actionIndices = rawLines
      .map((line, idx) => (line.startsWith('• ') ? idx : -1))
      .filter((idx) => idx !== -1);

    if (actionIndices.length >= 2 && battle.lastMessageId) {
      // --- PASSO 1: AÇÃO 1 (PRIMEIRO GOLPE) ---
      const a1Index = actionIndices[0];
      const a2Index = actionIndices[1];
      const a1Line = rawLines[a1Index];

      // Efeitos associados à Ação 1
      const a1Effects = rawLines.slice(a1Index + 1, a2Index).filter((l) => !l.startsWith('• '));

      const step1Text = [
        `⚔️ *EM COMBATE (AÇÃO 1/2):*`,
        a1Line,
        ...a1Effects,
        `⏳ Processando reação do oponente...`,
      ].join('\n');

      await this.sendOrEditBattleMessage(client, battle, p1, p2, step1Text);
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // --- PASSO 2: AÇÃO 2 (RESPOSTA / CONTRA-ATAQUE) ---
      const a2Line = rawLines[a2Index];
      const afterA2 = rawLines.slice(a2Index + 1);
      const standardEffects = afterA2.filter(
        (l) => !l.startsWith('☠️') && !l.startsWith('👑') && !l.startsWith('🏆') && !l.startsWith('⚖️')
      );

      const step2Text = [
        `⚔️ *EM COMBATE (AÇÃO 2/2):*`,
        a1Line,
        a2Line,
        ...standardEffects,
      ].join('\n');

      await this.sendOrEditBattleMessage(client, battle, p1, p2, step2Text);
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // --- PASSO 3: EVENTOS ESPECIAIS (SE HOUVER CPI, PASSIVAS, REVIRAVOLTAS) ---
      const specialEvents = afterA2.filter(
        (l) => l.startsWith('☠️') || l.startsWith('👑') || l.startsWith('🏆') || l.startsWith('⚖️')
      );

      if (specialEvents.length > 0) {
        const step3Text = [
          `📜 *REVIRAVOLTA DO TURNO:*`,
          ...specialEvents,
        ].join('\n');

        await this.sendOrEditBattleMessage(client, battle, p1, p2, step3Text);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // --- PASSO FINAL: DESFECHO COMPLETO DO TURNO E PLACAR ATUALIZADO ---
    const finalSummary = [
      `📜 *ACONTECIMENTOS DO TURNO ${battle.currentTurn - 1}:*`,
      combatResult.logSummary,
    ].join('\n');

    await this.sendOrEditBattleMessage(client, battle, p1, p2, finalSummary);
  }
}
