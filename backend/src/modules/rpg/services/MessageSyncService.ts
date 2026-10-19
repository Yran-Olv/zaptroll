import { WaClient } from 'zapo-js';
import { RpgBattle, RpgBattleParticipant, RpgCharacter, RpgBattleTurn } from '../models/index.js';
import { config } from '../../../config/index.js';
import { CombatTurnResult } from '../engine/CombatEngine.js';
import { RpgAccessCodeService } from './RpgAccessCodeService.js';
import { BattleNarratorService } from './BattleNarratorService.js';

export interface BattleMessageOptions {
  inCombatStep?: string;
  turnNarrative?: string;
  commentatorLine?: string | null;
  forceNewMessage?: boolean;
}

export class MessageSyncService {
  /**
   * Helper para formatar o nome do cenário de forma agradável
   */
  private static formatArenaName(arena: string): string {
    if (!arena) return 'Brasília';
    return arena
      .replace(/ring_/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Envia uma mensagem SEPARADA no grupo com o link/botão oficial de transmissão da WebView 2.5D
   */
  public static async sendSeparateSpectatorLink(client: WaClient, battle: RpgBattle): Promise<void> {
    const targetJid = battle.groupId;
    if (!targetJid) return;
    try {
      const spectatorCode = await RpgAccessCodeService.getOrCreateSpectatorCode(battle.id);
      const spectatorUrl = `${config.appUrl}/a/${spectatorCode}`;
      await client.message.send(targetJid, {
        type: 'text',
        text: [
          `👁️ *ZAPTROLL RPG — TRANSMISSÃO AO VIVO (ARENA 2.5D)* 🏛️`,
          `Acompanhe a batalha com gráficos 2.5D, animações de ataque e torcida em tempo real:`,
          `🔗 ${spectatorUrl}`,
          ``,
          `🏛️ _Transmissão oficial de espectador aberta a todos do grupo!_`,
        ].join('\n'),
      });
    } catch (e: any) {
      console.warn('[MessageSyncService] Falha ao enviar link de espectador separado:', e?.message || e);
    }
  }

  /**
   * Formata a mensagem principal da batalha:
   * - Quando finished: APENAS o grande vencedor, como foi o desfecho e recompensas!
   * - Em andamento: Placar com vida colorida, Narração viva, Como chegamos até aqui, Comentarista e Status das cartas.
   * - Nunca inclui o link gigante de webview (ele vai separado)!
   */
  public static async formatBattleMessage(
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    options?: BattleMessageOptions
  ): Promise<string> {
    let p1Char: any = null;
    let p2Char: any = null;
    try {
      p1Char = await RpgCharacter.findByPk(p1.characterId);
      p2Char = await RpgCharacter.findByPk(p2.characterId);
    } catch {}

    // Se a batalha acabou, exibe EXCLUSIVAMENTE o desfecho épico final
    if (battle.status === 'finished') {
      return BattleNarratorService.generateFinalBattleMessage({
        battle,
        p1,
        p2,
        p1CharTitle: p1Char?.title,
        p2CharTitle: p2Char?.title,
      });
    }

    const p1Name = BattleNarratorService.cleanFighterName(p1.name, p1.isBot);
    const p2Name = BattleNarratorService.cleanFighterName(p2.name, p2.isBot);

    const lines: string[] = [];
    lines.push('🥊 *ZAPTROLL RPG — ARENA POLÍTICA* 🏛️');
    lines.push(`⚔️ *${p1Name}*  _VS_  *${p2Name}*`);
    lines.push(`📍 *Ring ${this.formatArenaName(battle.arena)}* • *Turno ${battle.currentTurn}/${battle.maxTurns}*`);
    lines.push('');

    // Placar Lutador 1
    lines.push(`${p1Char?.avatarEmoji || '👔'} *${p1Name}* — _${p1Char?.title || 'Candidato'}_`);
    lines.push(`❤️ ${BattleNarratorService.renderHpBar(p1.currentHp, p1.maxHp)}   ⚡${p1.currentEnergy}  🔥${p1.popularity}%`);
    lines.push('');

    // Placar Lutador 2
    lines.push(`${p2Char?.avatarEmoji || '📑'} *${p2Name}* — _${p2Char?.title || 'Candidato'}_`);
    lines.push(`❤️ ${BattleNarratorService.renderHpBar(p2.currentHp, p2.maxHp)}   ⚡${p2.currentEnergy}  🔥${p2.popularity}%`);
    lines.push('');

    // Se estiver em etapa intermediária de animação (Ação 1/2 ou Ação 2/2)
    if (options?.inCombatStep) {
      lines.push(options.inCombatStep);
      lines.push('');
      return lines.join('\n');
    }

    // 1. Narração do Turno
    let activeNarrative = options?.turnNarrative;
    let commentator = options?.commentatorLine;

    if (!activeNarrative && battle.currentTurn > 1) {
      let lastTurn: any = null;
      try {
        lastTurn = await RpgBattleTurn.findOne({
          where: { battleId: battle.id, turnNumber: battle.currentTurn - 1 },
        });
      } catch {}

      if (lastTurn) {
        const narrativeResult = BattleNarratorService.generateTurnNarrative({
          turnNumber: lastTurn.turnNumber,
          rngSeed: lastTurn.rngSeedUsed,
          p1,
          p2,
          combatResult: {
            events: lastTurn.events || [],
            logSummary: lastTurn.logSummary || '',
            p1: p1 as any,
            p2: p2 as any,
            winner: 'none',
            isSuddenDeath: false,
          },
        });
        activeNarrative = narrativeResult.narrativeText;
        if (!commentator) {
          commentator = narrativeResult.commentatorLine;
        }
      }
    }

    if (activeNarrative) {
      lines.push(`🎙️ *NARRAÇÃO — TURNO ${battle.currentTurn - 1}*`);
      lines.push(activeNarrative);
      lines.push('');
    }

    // 2. Histórico de Turnos ("COMO CHEGAMOS ATÉ AQUI") - 3 turnos anteriores
    let priorTurns: any[] = [];
    try {
      priorTurns = await RpgBattleTurn.findAll({
        where: { battleId: battle.id },
        order: [['turnNumber', 'DESC']],
        offset: activeNarrative || battle.currentTurn > 1 ? 1 : 0,
        limit: 3,
      });
    } catch {}

    if (priorTurns.length > 0) {
      lines.push('📜 *COMO CHEGAMOS ATÉ AQUI:*');
      for (const pt of priorTurns) {
        const recap = BattleNarratorService.generateTurnNarrative({
          turnNumber: pt.turnNumber,
          rngSeed: pt.rngSeedUsed,
          p1,
          p2,
          combatResult: {
            events: pt.events || [],
            logSummary: pt.logSummary || '',
            p1: p1 as any,
            p2: p2 as any,
            winner: 'none',
            isSuddenDeath: false,
          },
        });
        lines.push(recap.historyLine);
      }
      lines.push('');
    }

    // 3. Comentarista (somente em momentos de destaque)
    if (commentator) {
      lines.push(commentator);
      lines.push('');
    }

    // 4. Status de Escolha e Instruções do Turno Atual
    const p1Status = p1.cardLocked ? `✅ ${p1Name} travou` : `⌛ ${p1Name} escolhendo...`;
    const p2Status = p2.cardLocked ? `✅ ${p2Name} travou` : `⌛ ${p2Name} escolhendo...`;

    lines.push(`⏱️ *Turno ${battle.currentTurn} — 45s*`);
    lines.push(`${p1Status}   ${p2Status}`);
    lines.push('👉 *Responda 1, 2, 3 ou 4* | */arena para o link no privado*');

    return lines.join('\n');
  }

  /**
   * Envia ou edita a mensagem da batalha em tempo real no WhatsApp.
   * Respeita a janela máxima de 12 minutos do WhatsApp, criando uma nova mensagem se expirar.
   */
  public static async sendOrEditBattleMessage(
    client: WaClient,
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    options?: BattleMessageOptions
  ): Promise<void> {
    const targetJid = battle.groupId || p1.phone || p2.phone;
    if (!targetJid) return;

    try {
      const text = await this.formatBattleMessage(battle, p1, p2, options);
      let edited = false;

      // Janela de edição do WhatsApp: limite seguro de 12 minutos
      const ageMs = battle.lastMessageTimestamp
        ? Date.now() - new Date(battle.lastMessageTimestamp).getTime()
        : 0;
      const isExpiredForEdit = Boolean(battle.lastMessageId && ageMs > 12 * 60 * 1000);

      // 1. Tentar editar a mensagem existente se não expirou
      if (battle.lastMessageId && !isExpiredForEdit && !options?.forceNewMessage) {
        try {
          const editRes = await client.message.send(targetJid, text, {
            editKey: { id: battle.lastMessageId },
          } as any);

          if (editRes?.id) {
            edited = true;
          }
        } catch (editErr: any) {
          console.warn(
            `[MessageSyncService] Falha ao editar mensagem ${battle.lastMessageId} (fallback para nova mensagem):`,
            editErr?.message || editErr
          );
          edited = false;
        }
      }

      // 2. Se for a inaugural, se expirou ou se a edição falhou, envia mensagem nova
      if (!edited) {
        const sendResult = await client.message.send(targetJid, {
          type: 'text',
          text,
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
   * Alias de compatibilidade
   */
  public static async syncBattleMessage(
    client: WaClient,
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant,
    summaryOrOptions?: string | BattleMessageOptions
  ): Promise<void> {
    const options: BattleMessageOptions =
      typeof summaryOrOptions === 'string'
        ? { inCombatStep: summaryOrOptions }
        : summaryOrOptions || {};
    return this.sendOrEditBattleMessage(client, battle, p1, p2, options);
  }

  /**
   * Sincroniza a narrativa do turno passo a passo editando a cada ação:
   * 1. Ação 1: Golpe do primeiro combatente -> Edita mensagem
   * 2. Intervalo de 1.6s
   * 3. Ação 2: Reação/contra-ataque do segundo combatente -> Edita mensagem
   * 4. Intervalo de 1.6s
   * 5. Desfecho com Narração completa do turno, histórico e novo status!
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

    const actionIndices = rawLines
      .map((line, idx) => (line.startsWith('• ') ? idx : -1))
      .filter((idx) => idx !== -1);

    const p1Name = BattleNarratorService.cleanFighterName(p1.name, p1.isBot);
    const p2Name = BattleNarratorService.cleanFighterName(p2.name, p2.isBot);

    if (actionIndices.length >= 2 && battle.lastMessageId) {
      // --- PASSO 1: AÇÃO 1 ---
      const a1Index = actionIndices[0];
      const a2Index = actionIndices[1];
      const a1Line = rawLines[a1Index];
      const a1Effects = rawLines.slice(a1Index + 1, a2Index).filter((l) => !l.startsWith('• '));

      const step1Text = [
        `⚔️ *EM COMBATE (AÇÃO 1/2):*`,
        a1Line,
        ...a1Effects,
        `⏳ _Processando resposta do oponente..._`,
      ].join('\n');

      await this.sendOrEditBattleMessage(client, battle, p1, p2, { inCombatStep: step1Text });
      await new Promise((resolve) => setTimeout(resolve, 1600));

      // --- PASSO 2: AÇÃO 2 ---
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
        `⏳ _Apurando votos e prestígio..._`,
      ].join('\n');

      await this.sendOrEditBattleMessage(client, battle, p1, p2, { inCombatStep: step2Text });
      await new Promise((resolve) => setTimeout(resolve, 1600));
    }

    // --- PASSO FINAL: DESFECHO COMPLETO DO TURNO OU FIM DE BATALHA ---
    const narrativeResult = BattleNarratorService.generateTurnNarrative({
      turnNumber: battle.currentTurn - 1,
      rngSeed: battle.rngSeed,
      p1,
      p2,
      combatResult,
    });

    await this.sendOrEditBattleMessage(client, battle, p1, p2, {
      turnNarrative: narrativeResult.narrativeText,
      commentatorLine: narrativeResult.commentatorLine,
    });
  }
}
