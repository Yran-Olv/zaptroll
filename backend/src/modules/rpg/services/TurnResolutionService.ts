import {
  RpgBattle,
  RpgBattleParticipant,
  RpgBattleTurn,
  RpgCard,
  RpgCharacter,
  RpgPlayer,
} from '../models/index.js';
import { CombatEngine, CardCombatState, FighterCombatState } from '../engine/CombatEngine.js';
import { BotAiService } from './BotAiService.js';
import { MessageSyncService } from './MessageSyncService.js';
import { RewardService } from './RewardService.js';
import { zapoManager } from '../../../integrations/zapo/ZapoConnectionManager.js';
import { getIO } from '../../realtime/socket.js';
import { sequelize } from '../../../database/index.js';

export class TurnResolutionService {
  /**
   * Trava a carta escolhida pelo participante (via WhatsApp ou WebView)
   */
  public static async lockCard(params: {
    battleId: string;
    phone?: string;
    participantId?: string;
    cardId: string;
  }): Promise<{ success: boolean; turnResolved: boolean; message: string }> {
    const { battleId, phone, participantId, cardId } = params;

    const battle = await RpgBattle.findByPk(battleId, {
      include: [{ model: RpgBattleParticipant, as: 'participants' }],
    });

    if (!battle) {
      throw new Error('Batalha não encontrada.');
    }

    if (battle.status !== 'selecting_cards') {
      return { success: false, turnResolved: false, message: 'O turno atual não está aceitando jogadas.' };
    }

    const participants = battle.get('participants') as RpgBattleParticipant[];
    const cleanDigits = phone ? phone.replace(/\D/g, '') : null;
    const participant = participants.find(
      (p) =>
        (participantId && p.id === participantId) ||
        (phone && p.phone === phone) ||
        (cleanDigits && p.phone && p.phone.replace(/\D/g, '') === cleanDigits)
    );

    if (!participant) {
      throw new Error('Você não é um participante desta batalha.');
    }

    // Verificar se a carta existe e está na mão
    const card = await RpgCard.findByPk(cardId);
    if (!card) {
      throw new Error(`Carta '${cardId}' não encontrada.`);
    }

    if (!participant.hand.includes(cardId)) {
      throw new Error('Esta carta não está na sua mão atual.');
    }

    if (card.energyCost > participant.currentEnergy) {
      throw new Error(`Energia insuficiente (${participant.currentEnergy}/${card.energyCost}).`);
    }

    // Travar escolha
    participant.selectedCardId = cardId;
    participant.cardLocked = true;
    await participant.save();

    // Notificar sala pública que este jogador travou (SEM revelar qual carta escolheu!)
    const io = getIO();
    if (io) {
      // 1. Sala pública da arena (espectadores e outros jogadores): APENAS flag de travamento
      io.to(`battle_${battle.id}_public`).emit('battle:card_locked', {
        battleId: battle.id,
        participantId: participant.id,
        participantName: participant.name,
      });
      io.to(`battle_${battle.id}`).emit('battle:card_locked', {
        battleId: battle.id,
        participantId: participant.id,
        participantName: participant.name,
      });

      // 2. Sala privada exclusiva do próprio jogador: confirmação com a carta travada
      io.to(`battle_${battle.id}_player_${participant.id}`).emit('battle:my_card_locked', {
        battleId: battle.id,
        participantId: participant.id,
        lockedCardId: cardId,
      });
      if (participant.phone) {
        io.to(`battle_${battle.id}_player_${participant.phone}`).emit('battle:my_card_locked', {
          battleId: battle.id,
          participantId: participant.id,
          lockedCardId: cardId,
        });
      }
    }

    // Se o outro participante for um BOT, escolher e travar a jogada do bot agora
    const other = participants.find((p) => p.id !== participant.id);
    if (other && other.isBot && !other.cardLocked) {
      await this.triggerBotCardSelection(battle, other, participant);
    }

    // Recarregar participantes para checar se ambos travaram
    const refreshed = await RpgBattleParticipant.findAll({ where: { battleId: battle.id } });
    const allLocked = refreshed.every((p) => p.cardLocked);

    if (allLocked && refreshed.length === 2) {
      // Ambos travaram suas escolhas -> RESOLVER TURNO!
      await this.resolveTurn(battle, refreshed[0], refreshed[1]);
      return { success: true, turnResolved: true, message: 'Ambos travaram as cartas. Turno resolvido!' };
    }

    if (!allLocked && refreshed.length === 2) {
      const zapoClient = zapoManager.getClient(battle.connectionId);
      if (zapoClient) {
        MessageSyncService.syncBattleMessage(zapoClient, battle, refreshed[0], refreshed[1]).catch(() => {});
      }
    }

    return { success: true, turnResolved: false, message: 'Carta travada com sucesso! Aguardando oponente.' };
  }

  /**
   * Dispara a decisão de IA do bot
   */
  private static async triggerBotCardSelection(
    battle: RpgBattle,
    botPart: RpgBattleParticipant,
    humanPart: RpgBattleParticipant
  ): Promise<void> {
    const botChar = await RpgCharacter.findByPk(botPart.characterId);
    const humanChar = await RpgCharacter.findByPk(humanPart.characterId);

    const botFighter: FighterCombatState = {
      id: botPart.id,
      name: botPart.name,
      characterId: botPart.characterId,
      characterClass: botChar?.characterClass || 'demagogo',
      affinity: botChar?.affinity || 'retorica',
      weakness: botChar?.weakness || 'povao',
      resistance: botChar?.resistance || 'juridico',
      maxHp: botPart.maxHp,
      currentHp: botPart.currentHp,
      maxEnergy: botPart.maxEnergy,
      currentEnergy: botPart.currentEnergy,
      baseAtk: botChar?.baseAtk || 15,
      baseDef: botChar?.baseDef || 10,
      baseSpeed: botChar?.baseSpeed || 10,
      baseCrit: botChar?.baseCrit || 0.05,
      popularity: botPart.popularity,
      rage: botPart.rage,
      activeStatuses: botPart.activeStatuses,
      passiveName: botChar?.passiveName || '',
      passiveEffect: botChar?.passiveEffect || ({} as any),
      passiveTriggered: botPart.passiveTriggered,
      comboStreak: botPart.comboStreak,
      shield: 0,
      allyUsed: botPart.allyUsed,
    };

    const humanFighter: FighterCombatState = {
      id: humanPart.id,
      name: humanPart.name,
      characterId: humanPart.characterId,
      characterClass: humanChar?.characterClass || 'demagogo',
      affinity: humanChar?.affinity || 'retorica',
      weakness: humanChar?.weakness || 'povao',
      resistance: humanChar?.resistance || 'juridico',
      maxHp: humanPart.maxHp,
      currentHp: humanPart.currentHp,
      maxEnergy: humanPart.maxEnergy,
      currentEnergy: humanPart.currentEnergy,
      baseAtk: humanChar?.baseAtk || 15,
      baseDef: humanChar?.baseDef || 10,
      baseSpeed: humanChar?.baseSpeed || 10,
      baseCrit: humanChar?.baseCrit || 0.05,
      popularity: humanPart.popularity,
      rage: humanPart.rage,
      activeStatuses: humanPart.activeStatuses,
      passiveName: humanChar?.passiveName || '',
      passiveEffect: humanChar?.passiveEffect || ({} as any),
      passiveTriggered: humanPart.passiveTriggered,
      comboStreak: humanPart.comboStreak,
      shield: 0,
      allyUsed: humanPart.allyUsed,
    };

    const handCards = await RpgCard.findAll({ where: { id: botPart.hand } });
    const handCardStates: CardCombatState[] = handCards.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      element: c.element,
      energyCost: c.energyCost,
      power: c.power,
      priority: c.priority,
      cooldown: c.cooldown,
      targetEffect: c.targetEffect,
      selfEffect: c.selfEffect,
      isBluff: c.isBluff,
      isComboStarter: c.isComboStarter,
      comboFollowUp: c.comboFollowUp,
      emoji: c.emoji,
    }));

    const chosen = BotAiService.selectCard(
      botFighter,
      humanFighter,
      handCardStates,
      botPart.botDifficulty || 'normal',
      botPart.botPersonality || 'equilibrado'
    );

    botPart.selectedCardId = chosen.id;
    botPart.cardLocked = true;
    await botPart.save();
  }

  /**
   * Executa a resolução do turno com lock otimista e outbox transacional
   */
  public static async resolveTurn(
    battle: RpgBattle,
    p1: RpgBattleParticipant,
    p2: RpgBattleParticipant
  ): Promise<void> {
    const t = await sequelize.transaction();

    try {
      // 1. Lock otimista no registro da batalha
      const freshBattle = await RpgBattle.findByPk(battle.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!freshBattle || freshBattle.status === 'resolving_turn' || freshBattle.status === 'finished') {
        await t.rollback();
        return;
      }

      freshBattle.status = 'resolving_turn';
      await freshBattle.save({ transaction: t });

      // 2. Carregar informações completas dos personagens e cartas
      const p1Char = await RpgCharacter.findByPk(p1.characterId, { transaction: t });
      const p2Char = await RpgCharacter.findByPk(p2.characterId, { transaction: t });

      const p1CardModel = await RpgCard.findByPk(p1.selectedCardId!, { transaction: t });
      const p2CardModel = await RpgCard.findByPk(p2.selectedCardId!, { transaction: t });

      const p1State: FighterCombatState = {
        id: p1.id,
        name: p1.name,
        characterId: p1.characterId,
        characterClass: p1Char?.characterClass || 'demagogo',
        affinity: p1Char?.affinity || 'retorica',
        weakness: p1Char?.weakness || 'povao',
        resistance: p1Char?.resistance || 'juridico',
        maxHp: p1.maxHp,
        currentHp: p1.currentHp,
        maxEnergy: p1.maxEnergy,
        currentEnergy: p1.currentEnergy,
        baseAtk: p1Char?.baseAtk || 15,
        baseDef: p1Char?.baseDef || 10,
        baseSpeed: p1Char?.baseSpeed || 10,
        baseCrit: p1Char?.baseCrit || 0.05,
        popularity: p1.popularity,
        rage: p1.rage,
        activeStatuses: p1.activeStatuses,
        passiveName: p1Char?.passiveName || '',
        passiveEffect: p1Char?.passiveEffect || ({} as any),
        passiveTriggered: p1.passiveTriggered,
        comboStreak: p1.comboStreak,
        shield: 0,
        allyUsed: p1.allyUsed,
      };

      const p2State: FighterCombatState = {
        id: p2.id,
        name: p2.name,
        characterId: p2.characterId,
        characterClass: p2Char?.characterClass || 'demagogo',
        affinity: p2Char?.affinity || 'retorica',
        weakness: p2Char?.weakness || 'povao',
        resistance: p2Char?.resistance || 'juridico',
        maxHp: p2.maxHp,
        currentHp: p2.currentHp,
        maxEnergy: p2.maxEnergy,
        currentEnergy: p2.currentEnergy,
        baseAtk: p2Char?.baseAtk || 15,
        baseDef: p2Char?.baseDef || 10,
        baseSpeed: p2Char?.baseSpeed || 10,
        baseCrit: p2Char?.baseCrit || 0.05,
        popularity: p2.popularity,
        rage: p2.rage,
        activeStatuses: p2.activeStatuses,
        passiveName: p2Char?.passiveName || '',
        passiveEffect: p2Char?.passiveEffect || ({} as any),
        passiveTriggered: p2.passiveTriggered,
        comboStreak: p2.comboStreak,
        shield: 0,
        allyUsed: p2.allyUsed,
      };

      const p1CardState: CardCombatState = {
        id: p1CardModel!.id,
        name: p1CardModel!.name,
        category: p1CardModel!.category,
        element: p1CardModel!.element,
        energyCost: p1CardModel!.energyCost,
        power: p1CardModel!.power,
        priority: p1CardModel!.priority,
        cooldown: p1CardModel!.cooldown,
        targetEffect: p1CardModel!.targetEffect,
        selfEffect: p1CardModel!.selfEffect,
        isBluff: p1CardModel!.isBluff,
        isComboStarter: p1CardModel!.isComboStarter,
        comboFollowUp: p1CardModel!.comboFollowUp,
        emoji: p1CardModel!.emoji,
      };

      const p2CardState: CardCombatState = {
        id: p2CardModel!.id,
        name: p2CardModel!.name,
        category: p2CardModel!.category,
        element: p2CardModel!.element,
        energyCost: p2CardModel!.energyCost,
        power: p2CardModel!.power,
        priority: p2CardModel!.priority,
        cooldown: p2CardModel!.cooldown,
        targetEffect: p2CardModel!.targetEffect,
        selfEffect: p2CardModel!.selfEffect,
        isBluff: p2CardModel!.isBluff,
        isComboStarter: p2CardModel!.isComboStarter,
        comboFollowUp: p2CardModel!.comboFollowUp,
        emoji: p2CardModel!.emoji,
      };

      // 3. Execução no motor puro determinístico
      const combatResult = CombatEngine.resolveTurn({
        turnNumber: freshBattle.currentTurn,
        rngSeed: freshBattle.rngSeed,
        p1: p1State,
        p2: p2State,
        p1Card: p1CardState,
        p2Card: p2CardState,
      });

      // 4. Salvar histórico de turno
      await RpgBattleTurn.create(
        {
          battleId: freshBattle.id,
          turnNumber: freshBattle.currentTurn,
          p1Choice: p1CardState.id,
          p2Choice: p2CardState.id,
          p1HpAfter: combatResult.p1.currentHp,
          p2HpAfter: combatResult.p2.currentHp,
          p1EnergyAfter: combatResult.p1.currentEnergy,
          p2EnergyAfter: combatResult.p2.currentEnergy,
          logSummary: combatResult.logSummary,
          events: combatResult.events as any,
          rngSeedUsed: freshBattle.rngSeed,
        },
        { transaction: t }
      );

      // 5. Atualizar participantes
      p1.currentHp = combatResult.p1.currentHp;
      p1.currentEnergy = combatResult.p1.currentEnergy;
      p1.popularity = combatResult.p1.popularity;
      p1.rage = combatResult.p1.rage;
      p1.activeStatuses = combatResult.p1.activeStatuses;
      p1.comboStreak = combatResult.p1.comboStreak;
      p1.passiveTriggered = combatResult.p1.passiveTriggered;
      p1.cardLocked = false;
      p1.selectedCardId = null;

      p2.currentHp = combatResult.p2.currentHp;
      p2.currentEnergy = combatResult.p2.currentEnergy;
      p2.popularity = combatResult.p2.popularity;
      p2.rage = combatResult.p2.rage;
      p2.activeStatuses = combatResult.p2.activeStatuses;
      p2.comboStreak = combatResult.p2.comboStreak;
      p2.passiveTriggered = combatResult.p2.passiveTriggered;
      p2.cardLocked = false;
      p2.selectedCardId = null;

      // Remover cartas usadas das mãos
      const p1Hand = [...(p1.hand || [])];
      const p1Idx = p1Hand.indexOf(p1CardState.id);
      if (p1Idx !== -1) p1Hand.splice(p1Idx, 1);

      const p2Hand = [...(p2.hand || [])];
      const p2Idx = p2Hand.indexOf(p2CardState.id);
      if (p2Idx !== -1) p2Hand.splice(p2Idx, 1);

      // Compra de nova carta para a mão mantendo sempre opções jogáveis
      const allCards = await RpgCard.findAll({ transaction: t });
      const cardIds = allCards.map((c) => c.id);
      const lowCostIds = allCards.filter((c) => c.energyCost <= 2).map((c) => c.id);

      while (p1Hand.length < 4 && cardIds.length > 0) {
        const hasLowCost = p1Hand.some((id) => {
          const card = allCards.find((c) => c.id === id);
          return card && card.energyCost <= 2;
        });
        const pool = !hasLowCost && lowCostIds.length > 0 ? lowCostIds : cardIds;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        p1Hand.push(pick);
      }

      while (p2Hand.length < 4 && cardIds.length > 0) {
        const hasLowCost = p2Hand.some((id) => {
          const card = allCards.find((c) => c.id === id);
          return card && card.energyCost <= 2;
        });
        const pool = !hasLowCost && lowCostIds.length > 0 ? lowCostIds : cardIds;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        p2Hand.push(pick);
      }

      p1.hand = p1Hand;
      p2.hand = p2Hand;

      await p1.save({ transaction: t });
      await p2.save({ transaction: t });

      // 6. Atualizar Batalha
      freshBattle.version += 1;
      freshBattle.rngSeed += 17;

      if (combatResult.winner !== 'none') {
        freshBattle.status = 'finished';
        freshBattle.winnerPlayerId =
          combatResult.winner === 'p1' ? p1.playerId : combatResult.winner === 'p2' ? p2.playerId : null;
      } else {
        freshBattle.status = 'selecting_cards';
        freshBattle.currentTurn += 1;
        freshBattle.turnDeadline = new Date(Date.now() + 45 * 1000);
      }

      await freshBattle.save({ transaction: t });
      await t.commit();

      // 7. Processar Recompensas fora da transação de turno se a batalha terminou
      if (freshBattle.status === 'finished') {
        if (p1.playerId) {
          await RewardService.processBattleRewards({
            playerId: p1.playerId,
            battleId: freshBattle.id,
            isWinner: combatResult.winner === 'p1',
            isDraw: combatResult.winner === 'draw',
          });
        }
        if (p2.playerId) {
          await RewardService.processBattleRewards({
            playerId: p2.playerId,
            battleId: freshBattle.id,
            isWinner: combatResult.winner === 'p2',
            isDraw: combatResult.winner === 'draw',
          });
        }
      }

      const io = getIO();
      if (io) {
        const turnPayload = {
          battleId: freshBattle.id,
          currentTurn: freshBattle.currentTurn,
          p1: {
            id: p1.id,
            name: p1.name,
            currentHp: p1.currentHp,
            maxHp: p1.maxHp,
            currentEnergy: p1.currentEnergy,
            maxEnergy: p1.maxEnergy,
            popularity: p1.popularity,
            activeStatuses: p1.activeStatuses,
          },
          p2: {
            id: p2.id,
            name: p2.name,
            currentHp: p2.currentHp,
            maxHp: p2.maxHp,
            currentEnergy: p2.currentEnergy,
            maxEnergy: p2.maxEnergy,
            popularity: p2.popularity,
            activeStatuses: p2.activeStatuses,
          },
          events: combatResult.events,
          logSummary: combatResult.logSummary,
          winner: combatResult.winner,
          status: freshBattle.status,
        };

        io.to(`battle_${freshBattle.id}_public`).emit('battle:turn_resolved', turnPayload);
        io.to(`battle_${freshBattle.id}`).emit('battle:turn_resolved', turnPayload);
      }

      // 9. Atualizar mensagem no WhatsApp com a narrativa do combate passo a passo
      const zapoClient = zapoManager.getClient(freshBattle.connectionId);
      if (zapoClient) {
        await MessageSyncService.syncBattleTurnNarrative(
          zapoClient,
          freshBattle,
          p1,
          p2,
          combatResult
        );
      }
    } catch (err: any) {
      await t.rollback();
      console.error('[TurnResolutionService] Erro ao resolver turno:', err);
    }
  }
}
