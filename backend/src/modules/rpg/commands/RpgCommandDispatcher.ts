import { WaClient } from 'zapo-js';
import { Op } from 'sequelize';
import {
  RpgBattle,
  RpgBattleParticipant,
  RpgCard,
  RpgConfig,
} from '../models/index.js';
import { DuelService } from '../services/DuelService.js';
import { TurnResolutionService } from '../services/TurnResolutionService.js';
import { EconomyService } from '../services/EconomyService.js';
import { CampaignService } from '../services/CampaignService.js';
import { MissionService } from '../services/MissionService.js';
import { RpgAccessCodeService } from '../services/RpgAccessCodeService.js';
import { config } from '../../../config/index.js';

export interface DispatcherParams {
  client: WaClient;
  connectionId: string;
  userId: string;
  remoteJid: string;
  senderJid: string;
  userName: string;
  text: string;
  mentionedJids?: string[];
  quotedParticipant?: string;
}

export class RpgCommandDispatcher {
  /**
   * Ponto de entrada para processamento de mensagens no ecossistema RPG
   */
  public static async handleMessage(params: DispatcherParams): Promise<boolean> {
    const {
      client,
      connectionId,
      remoteJid,
      senderJid,
      userName,
      text,
      mentionedJids = [],
    } = params;

    if (!text) return false;
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    // 1. Verificar jogadas de cartas rápidas durante combate (ex: '1', '2', '3', '4' ou '/carta 1')
    if (await this.handleCombatCardSelection(params)) {
      return true;
    }

    // 2. Comandos que começam com barra ou palavras-chave de ação
    if (!cleanText.startsWith('/') && !cleanText.startsWith('!')) {
      return false;
    }

    const parts = cleanText.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'rpg':
      case 'ajuda':
      case 'luta': {
        await this.sendHelp(client, remoteJid);
        return true;
      }

      case 'duelo':
      case 'desafiar': {
        await this.handleDuel(params, args);
        return true;
      }

      case 'aceitar': {
        const reply = await DuelService.answerInvite({
          connectionId,
          groupId: remoteJid,
          phone: senderJid,
          accept: true,
          client,
        });
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'recusar': {
        const reply = await DuelService.answerInvite({
          connectionId,
          groupId: remoteJid,
          phone: senderJid,
          accept: false,
          client,
        });
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'lutarbot':
      case 'bot': {
        const diff = (args[0] || 'normal').toLowerCase();
        const difficulty = ['facil', 'normal', 'dificil', 'chefe'].includes(diff)
          ? (diff as any)
          : 'normal';

        await DuelService.startBotBattle({
          connectionId,
          targetJid: remoteJid,
          phone: senderJid,
          userName,
          difficulty,
          client,
        });
        return true;
      }

      case 'arena':
      case 'link': {
        await this.handleArenaLinkRequest(params);
        return true;
      }

      case 'perfil':
      case 'status': {
        const { formatted } = await EconomyService.getProfile(senderJid, userName);
        await client.message.send(remoteJid, { type: 'text', text: formatted });
        return true;
      }

      case 'diaria':
      case 'daily':
      case 'verba': {
        const reply = await EconomyService.claimDaily(senderJid, userName);
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'loja':
      case 'shop': {
        const catalog = await EconomyService.getStoreCatalog();
        await client.message.send(remoteJid, { type: 'text', text: catalog });
        return true;
      }

      case 'comprar':
      case 'buy': {
        const itemId = args[0]?.toLowerCase();
        if (!itemId) {
          await client.message.send(remoteJid, {
            type: 'text',
            text: '👉 Digite */comprar <id_do_item>*. Exemplo: `/comprar microfone_ouro`',
          });
          return true;
        }
        const reply = await EconomyService.buyItem(senderJid, itemId);
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'inventario':
      case 'itens':
      case 'mochila': {
        const reply = await EconomyService.getInventory(senderJid);
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'usar':
      case 'equipar': {
        const itemId = args[0]?.toLowerCase();
        if (!itemId) {
          await client.message.send(remoteJid, {
            type: 'text',
            text: '👉 Digite */usar <id_do_item>*. Exemplo: `/usar terno_blindado`',
          });
          return true;
        }
        const reply = await EconomyService.useItem(senderJid, itemId);
        await client.message.send(remoteJid, { type: 'text', text: reply });
        return true;
      }

      case 'ranking':
      case 'top':
      case 'placar': {
        const leaderboard = await EconomyService.getLeaderboard();
        await client.message.send(remoteJid, { type: 'text', text: leaderboard });
        return true;
      }

      case 'campanha':
      case 'historia': {
        const sub = args[0]?.toLowerCase();
        if (sub === '1' || sub === '2') {
          const reply = await CampaignService.makeChoiceAndFight({
            connectionId,
            targetJid: remoteJid,
            phone: senderJid,
            userName,
            choiceIndex: parseInt(sub, 10),
            client,
          });
          await client.message.send(remoteJid, { type: 'text', text: reply });
        } else if (sub === 'lutar' || sub === 'boss') {
          const reply = await CampaignService.makeChoiceAndFight({
            connectionId,
            targetJid: remoteJid,
            phone: senderJid,
            userName,
            client,
          });
          await client.message.send(remoteJid, { type: 'text', text: reply });
        } else {
          const status = await CampaignService.showCampaignStatus(senderJid, userName);
          await client.message.send(remoteJid, { type: 'text', text: status });
        }
        return true;
      }

      case 'missoes':
      case 'metas':
      case 'tarefas': {
        const { formatted } = await MissionService.getDailyMissions(senderJid, userName);
        await client.message.send(remoteJid, { type: 'text', text: formatted });
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Trata escolhas de cartas enviadas durante um combate ativo
   */
  private static async handleCombatCardSelection(params: DispatcherParams): Promise<boolean> {
    const { client, remoteJid, senderJid, text } = params;
    const clean = text.trim().toLowerCase();

    let choiceNumber: number | null = null;
    if (['1', '2', '3', '4'].includes(clean)) {
      choiceNumber = parseInt(clean, 10);
    } else if (clean.startsWith('/carta ') || clean.startsWith('!carta ')) {
      const parsed = parseInt(clean.replace(/^[!/]carta\s+/, ''), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
        choiceNumber = parsed;
      }
    }

    if (choiceNumber === null) return false;

    const cleanDigits = senderJid ? senderJid.replace(/\D/g, '') : '';
    const phoneCandidates = [
      senderJid,
      cleanDigits,
      `${cleanDigits}@s.whatsapp.net`,
    ].filter(Boolean);

    // Buscar se o jogador está em uma batalha ativa com status 'selecting_cards'
    const activeParticipant = await RpgBattleParticipant.findOne({
      where: {
        phone: { [Op.in]: phoneCandidates },
        cardLocked: false,
      },
      include: [
        {
          model: RpgBattle,
          as: 'battle',
          where: {
            status: 'selecting_cards',
            ...(remoteJid ? { groupId: remoteJid } : {}),
          },
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    if (!activeParticipant) {
      return false;
    }

    const battle = activeParticipant.get('battle') as RpgBattle;
    const hand = activeParticipant.hand || [];

    if (choiceNumber < 1 || choiceNumber > hand.length) {
      await client.message.send(remoteJid, {
        type: 'text',
        text: `⚠️ Escolha inválida. Você possui ${hand.length} cartas na mão (escolha de 1 a ${hand.length}).`,
      });
      return true;
    }

    const selectedCardId = hand[choiceNumber - 1];
    const card = await RpgCard.findByPk(selectedCardId);

    try {
      const lockResult = await TurnResolutionService.lockCard({
        battleId: battle.id,
        phone: senderJid,
        cardId: selectedCardId,
      });

      if (lockResult.success) {
        if (!lockResult.turnResolved) {
          const cardDisplay = card ? `${card.emoji} *${card.name}*` : selectedCardId;
          await client.message.send(remoteJid, {
            type: 'text',
            text: `🃏 *CARTA TRAVADA:* ${cardDisplay}!\n⌛ Aguardando a jogada do seu adversário...`,
          });
        }
      } else {
        await client.message.send(remoteJid, {
          type: 'text',
          text: `⚠️ ${lockResult.message}`,
        });
      }
      return true;
    } catch (err: any) {
      await client.message.send(remoteJid, {
        type: 'text',
        text: `❌ Não foi possível jogar a carta: ${err.message}`,
      });
      return true;
    }
  }

  /**
   * Processa o comando /duelo
   */
  private static async handleDuel(params: DispatcherParams, args: string[]): Promise<void> {
    const { client, connectionId, remoteJid, senderJid, userName, mentionedJids = [] } = params;

    let targetPhone = mentionedJids[0];
    let betAmount = 0;

    // Verificar se passou aposta como argumento (ex: /duelo @user 50)
    for (const arg of args) {
      const num = parseInt(arg, 10);
      if (!isNaN(num) && num > 0) {
        betAmount = num;
        break;
      }
    }

    // Se não marcou diretamente com @, verificar se passou número no texto
    if (!targetPhone) {
      const candidate = args.find((a) => a.includes('@') || a.replace(/\D/g, '').length >= 10);
      if (candidate) {
        const cleanDigits = candidate.replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          targetPhone = `${cleanDigits}@s.whatsapp.net`;
        }
      }
    }

    if (!targetPhone) {
      await client.message.send(remoteJid, {
        type: 'text',
        text: [
          '👉 *COMO DESAFIAR UM OPONENTE:*',
          'Use: */duelo @usuario [aposta]*',
          '',
          'Exemplos:',
          '• `/duelo @5511999999999` (sem aposta)',
          '• `/duelo @5511999999999 100` (valendo 100 R$ de verba)',
        ].join('\n'),
      });
      return;
    }

    const reply = await DuelService.createInvite({
      connectionId,
      groupId: remoteJid,
      challengerPhone: senderJid,
      challengerName: userName,
      challengedPhone: targetPhone,
      challengedName: targetPhone.split('@')[0],
      betAmount,
      client,
    });

    if (reply && !reply.includes('sucesso')) {
      await client.message.send(remoteJid, { type: 'text', text: reply });
    }
  }

  /**
   * Banner de ajuda (/rpg ou /ajuda)
   */
  private static async sendHelp(client: WaClient, remoteJid: string): Promise<void> {
    const helpText = [
      '🏛️ *ZAPTROLL RPG — LUTA POLÍTICA NO WHATSAPP* 🥊',
      'Assuma sua persona parlamentar, dispute o plenário e alcance a presidência!',
      '',
      '⚔️ *BATALHAS & ARENA:*',
      '• */duelo @usuario [aposta]* — Desafie alguém para o debate',
      '• */aceitar* ou */recusar* — Responda a um desafio recebido',
      '• */lutarbot [facil|normal|dificil]* — Luta rápida contra IA',
      '• *1*, *2*, *3*, *4* — Durante o combate, digite o número da carta',
      '',
      '📖 *MODO CAMPANHA:*',
      '• */campanha* — Veja seu capítulo atual e tome decisões de gabinete',
      '• */campanha 1* ou */campanha 2* — Escolha ética vs maquiavelismo',
      '',
      '💼 *ECONOMIA & PERFIL:*',
      '• */perfil* — Atributos, cargo, ELO, vitórias e sequência',
      '• */missoes* — Metas diárias com bônus extras de verba e XP',
      '• */diaria* — Recolha sua verba parlamentar diária (R$ + XP)',
      '• */loja* — Compre equipamentos e itens na Loja do Congresso',
      '• */comprar <id>* — Adquira um item da loja',
      '• */inventario* — Veja seus pertences',
      '• */usar <id>* — Equipe armas/armaduras ou use consumíveis',
      '• */ranking* — Veja os líderes da política nacional',
      '',
      '🌐 *ARENA 2.5D AO VIVO:*',
      'Cada combate gera um link ao vivo para assistir e jogar pela web com animações!',
    ].join('\n');

    await client.message.send(remoteJid, { type: 'text', text: helpText });
  }

  /**
   * Envia o link confidencial de combate ao jogador por mensagem privada (/arena)
   */
  private static async handleArenaLinkRequest(params: DispatcherParams): Promise<void> {
    const { client, remoteJid, senderJid, userName } = params;
    const cleanDigits = senderJid ? senderJid.replace(/\D/g, '') : '';
    const phoneCandidates = [
      senderJid,
      cleanDigits,
      `${cleanDigits}@s.whatsapp.net`,
    ].filter(Boolean);

    // Buscar batalha ativa onde o usuário seja participante
    const activeParticipant = await RpgBattleParticipant.findOne({
      where: {
        phone: { [Op.in]: phoneCandidates },
      },
      include: [
        {
          model: RpgBattle,
          as: 'battle',
          where: {
            status: { [Op.in]: ['selecting_cards', 'resolving_turn'] },
          },
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const isGroup = remoteJid.endsWith('@g.us');
    const privateJid = cleanDigits ? `${cleanDigits}@s.whatsapp.net` : senderJid;

    if (!activeParticipant || !activeParticipant.battleId) {
      const msg = `⚠️ *Olá ${userName}!* Você não está participando de nenhum duelo ativo no momento.\n\n👉 Para começar, digite */bot* para lutar contra a máquina ou */duelo @alguem* para desafiar um amigo!`;
      await client.message.send(remoteJid, { type: 'text', text: msg });
      return;
    }

    const fighterCode = await RpgAccessCodeService.getOrCreateFighterCode({
      battleId: activeParticipant.battleId,
      participantId: activeParticipant.id,
      phone: activeParticipant.phone,
      playerId: activeParticipant.playerId,
    });

    const arenaUrl = `${config.appUrl}/a/${fighterCode}`;

    const privateMsg = [
      `⚔️ *ZAPTROLL RPG — SUA ARENA PRIVADA* 🏛️`,
      `Olá *${userName}*! Aqui está o seu link exclusivo e confidencial de combate:`,
      `🔗 ${arenaUrl}`,
      ``,
      `🃏 *Sua mão de cartas e ações ao vivo estão liberadas neste link.*`,
      `⚠️ *Aviso de Segurança:* Não envie este link para outros jogadores para não revelar suas cartas!`,
    ].join('\n');

    await client.message.send(privateJid, { type: 'text', text: privateMsg });

    if (isGroup) {
      await client.message.send(remoteJid, {
        type: 'text',
        text: `🔒 @${userName}, seu link confidencial de combate foi enviado no seu privado!`,
        mentions: [senderJid],
      } as any);
    }
  }
}
