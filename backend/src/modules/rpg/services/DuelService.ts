import { WaClient } from 'zapo-js';
import { Op } from 'sequelize';
import {
  RpgBattle,
  RpgBattleParticipant,
  RpgDuelInvite,
  RpgPlayer,
  RpgCharacter,
  RpgCard,
} from '../models/index.js';
import { MessageSyncService } from './MessageSyncService.js';
import { TurnResolutionService } from './TurnResolutionService.js';
import { RpgTokenService } from './RpgTokenService.js';
import { config } from '../../../config/index.js';

export class DuelService {
  /**
   * Registra um convite de duelo entre dois jogadores no WhatsApp
   */
  public static async createInvite(params: {
    connectionId: string;
    groupId: string;
    challengerPhone: string;
    challengerName: string;
    challengedPhone: string;
    challengedName: string;
    betAmount?: number;
    client: WaClient;
  }): Promise<string> {
    const {
      connectionId,
      groupId,
      challengerPhone,
      challengerName,
      challengedPhone,
      challengedName,
      betAmount = 0,
      client,
    } = params;

    if (challengerPhone === challengedPhone) {
      return '❌ Você não pode desafiar a si mesmo!';
    }

    // Verificar se o desafiante já está em uma batalha ativa
    const activeBattle = await RpgBattle.findOne({
      where: { status: ['selecting_characters', 'selecting_cards', 'resolving_turn'] },
      include: [
        {
          model: RpgBattleParticipant,
          as: 'participants',
          where: { phone: [challengerPhone, challengedPhone] },
        },
      ],
    });

    if (activeBattle) {
      return '⚠️ Um dos participantes já está engajado em uma luta ativa na arena!';
    }

    // Auto-registrar ou buscar jogadores
    let p1 = await RpgPlayer.findOne({ where: { whatsappPhone: challengerPhone } });
    if (!p1) {
      p1 = await RpgPlayer.create({
        whatsappPhone: challengerPhone,
        name: challengerName || 'Candidato',
      });
    }

    let p2 = await RpgPlayer.findOne({ where: { whatsappPhone: challengedPhone } });
    if (!p2) {
      p2 = await RpgPlayer.create({
        whatsappPhone: challengedPhone,
        name: challengedName || 'Adversário',
      });
    }

    // Validar aposta se houver
    if (betAmount > 0) {
      if (p1.coins < betAmount) {
        return `❌ Você não possui saldo suficiente (${p1.coins} R$) para apostar ${betAmount} R$!`;
      }
      if (p2.coins < betAmount) {
        return `❌ O adversário não possui saldo suficiente (${p2.coins} R$) para essa aposta!`;
      }
    }

    // Criar convite válido por 2 minutos
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const invite = await RpgDuelInvite.create({
      connectionId,
      groupId,
      challengerPhone,
      challengerName,
      challengedPhone,
      challengedName,
      betAmount,
      expiresAt,
      status: 'pending',
    });

    const betText = betAmount > 0 ? `\n💰 *Aposta em jogo:* ${betAmount} R$` : '';

    const text = [
      '⚔️ *DESAFIO DE DUELO POLÍTICO NA ARENA!* 🏛️',
      '',
      `👤 *Desafiante:* ${challengerName} (@${challengerPhone.split('@')[0]})`,
      `🎯 *Convocado:* ${challengedName} (@${challengedPhone.split('@')[0]})`,
      betText,
      '',
      '⏱️ *Validade:* 2 minutos para responder!',
      '👉 Digite */aceitar* para subir ao ringue ou */recusar* para fugir do debate.',
    ].filter(Boolean).join('\n');

    await client.message.send(groupId, {
      type: 'text',
      text,
      contextInfo: {
        mentionedJids: [challengerPhone, challengedPhone],
      },
    });

    return 'Convite de duelo enviado com sucesso!';
  }

  /**
   * Responde ao convite de duelo (/aceitar ou /recusar)
   */
  public static async answerInvite(params: {
    connectionId: string;
    groupId: string;
    phone: string;
    accept: boolean;
    client: WaClient;
  }): Promise<string> {
    const { connectionId, groupId, phone, accept, client } = params;

    // Buscar convite pendente para este jogador neste grupo
    const invite = await RpgDuelInvite.findOne({
      where: {
        groupId,
        challengedPhone: phone,
        status: 'pending',
      },
      order: [['createdAt', 'DESC']],
    });

    if (!invite) {
      return '⚠️ Nenhum convite de duelo pendente para você neste grupo.';
    }

    if (new Date() > invite.expiresAt) {
      invite.status = 'expired';
      await invite.save();
      return '⌛ O prazo de 2 minutos para responder ao desafio expirou!';
    }

    if (!accept) {
      invite.status = 'rejected';
      await invite.save();
      await client.message.send(groupId, {
        type: 'text',
        text: `🏃‍♂️ *DESAFIO RECUSADO!* ${invite.challengedName} fugiu do debate político.`,
      });
      return 'Desafio recusado com sucesso.';
    }

    // Aceito! Iniciar a batalha PvP
    invite.status = 'accepted';
    await invite.save();

    const p1 = await RpgPlayer.findOne({ where: { whatsappPhone: invite.challengerPhone } });
    const p2 = await RpgPlayer.findOne({ where: { whatsappPhone: invite.challengedPhone } });

    // Descontar aposta se houver
    if (invite.betAmount > 0 && p1 && p2) {
      p1.coins -= invite.betAmount;
      p2.coins -= invite.betAmount;
      await p1.save();
      await p2.save();
    }

    const battle = await RpgBattle.create({
      connectionId,
      groupId,
      mode: 'pvp',
      status: 'selecting_cards',
      arena: 'ring_brasilia',
      currentTurn: 1,
      maxTurns: 20,
      turnDeadline: new Date(Date.now() + 45 * 1000),
      rngSeed: Math.floor(Math.random() * 1000000),
    });

    invite.battleId = battle.id;
    await invite.save();

    // Buscar cartas padrão para mão inicial (4 cartas aleatórias)
    const allCards = await RpgCard.findAll();
    const cardIds = allCards.map((c) => c.id);

    const pickCards = (count = 4) => {
      const picks: string[] = [];
      for (let i = 0; i < count; i++) {
        picks.push(cardIds[Math.floor(Math.random() * cardIds.length)]);
      }
      return picks;
    };

    const p1CharId = p1?.selectedCharacterId || 'doutor_promessa';
    const p2CharId = p2?.selectedCharacterId || 'capitao_palanque';

    const p1Part = await RpgBattleParticipant.create({
      battleId: battle.id,
      playerId: p1?.id,
      phone: invite.challengerPhone,
      name: invite.challengerName,
      characterId: p1CharId,
      maxHp: 100 + (p1?.bonusHp || 0),
      currentHp: 100 + (p1?.bonusHp || 0),
      maxEnergy: 10,
      currentEnergy: 4,
      hand: pickCards(4),
    });

    const p2Part = await RpgBattleParticipant.create({
      battleId: battle.id,
      playerId: p2?.id,
      phone: invite.challengedPhone,
      name: invite.challengedName,
      characterId: p2CharId,
      maxHp: 100 + (p2?.bonusHp || 0),
      currentHp: 100 + (p2?.bonusHp || 0),
      maxEnergy: 10,
      currentEnergy: 4,
      hand: pickCards(4),
    });

    // Enviar mensagem inaugural da batalha
    await MessageSyncService.syncBattleMessage(client, battle, p1Part, p2Part);

    return 'Duelo iniciado com sucesso!';
  }

  /**
   * Inicia uma batalha individual contra um bot PvE (/lutarbot)
   */
  public static async startBotBattle(params: {
    connectionId: string;
    targetJid: string; // Grupo ou privado
    phone: string;
    userName: string;
    difficulty?: 'facil' | 'normal' | 'dificil' | 'chefe';
    client: WaClient;
  }): Promise<string> {
    const { connectionId, targetJid, phone, userName, difficulty = 'normal', client } = params;

    const cleanPhone = phone ? phone.split('@')[0].replace(/\D/g, '') : '';
    let player = await RpgPlayer.findOne({
      where: {
        [Op.or]: [
          { whatsappPhone: phone },
          { whatsappPhone: cleanPhone },
          { whatsappPhone: `${cleanPhone}@s.whatsapp.net` },
        ],
      },
    });
    if (!player) {
      player = await RpgPlayer.create({
        whatsappPhone: cleanPhone || phone,
        name: userName || 'Candidato',
      });
    }

    const isGroup = targetJid.endsWith('@g.us');

    const battle = await RpgBattle.create({
      connectionId,
      groupId: isGroup ? targetJid : null,
      mode: 'pve',
      status: 'selecting_cards',
      arena: difficulty === 'chefe' ? 'estudio_tv' : 'ring_brasilia',
      currentTurn: 1,
      maxTurns: 20,
      turnDeadline: new Date(Date.now() + 45 * 1000),
      rngSeed: Math.floor(Math.random() * 1000000),
    });

    const allCards = await RpgCard.findAll();
    const cardIds = allCards.map((c) => c.id);

    const pickCards = (count = 4) => {
      const picks: string[] = [];
      const lowCost = allCards.filter((c) => c.energyCost <= 2).map((c) => c.id);
      if (lowCost.length > 0) {
        picks.push(lowCost[Math.floor(Math.random() * lowCost.length)]);
      }
      while (picks.length < count && cardIds.length > 0) {
        picks.push(cardIds[Math.floor(Math.random() * cardIds.length)]);
      }
      return picks;
    };

    const p1Part = await RpgBattleParticipant.create({
      battleId: battle.id,
      playerId: player.id,
      phone: cleanPhone || phone,
      name: userName || 'Candidato',
      characterId: player.selectedCharacterId || 'doutor_promessa',
      maxHp: 100 + player.bonusHp,
      currentHp: 100 + player.bonusHp,
      maxEnergy: 10,
      currentEnergy: 4,
      hand: pickCards(4),
    });

    // Configurar o bot adversário
    const botCharId = difficulty === 'chefe' ? 'lobista_sombrio' : difficulty === 'dificil' ? 'ex_tudo' : 'dona_reforma';
    const botName = difficulty === 'chefe' ? 'Lobista Sombrio (CHEFE)' : difficulty === 'dificil' ? 'O Ex-Tudo (Bot)' : 'Dona Reforma (Bot)';

    const p2Part = await RpgBattleParticipant.create({
      battleId: battle.id,
      playerId: null,
      phone: null,
      name: botName,
      isBot: true,
      botDifficulty: difficulty,
      botPersonality: difficulty === 'chefe' ? 'blefador' : 'equilibrado',
      characterId: botCharId,
      maxHp: difficulty === 'chefe' ? 140 : 110,
      currentHp: difficulty === 'chefe' ? 140 : 110,
      maxEnergy: 10,
      currentEnergy: 4,
      hand: pickCards(4),
    });

    // Enviar mensagem inaugural da batalha
    await MessageSyncService.syncBattleMessage(client, battle, p1Part, p2Part);

    return 'Luta contra bot iniciada com sucesso!';
  }
}
