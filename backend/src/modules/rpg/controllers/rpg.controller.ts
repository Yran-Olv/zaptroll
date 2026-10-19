import { Request, Response } from 'express';
import {
  RpgBattle,
  RpgBattleParticipant,
  RpgBattleTurn,
  RpgCard,
  RpgCharacter,
  RpgPlayer,
  RpgConfig,
  RpgAuditLog,
} from '../models/index.js';
import { RpgTokenService } from '../services/RpgTokenService.js';
import { TurnResolutionService } from '../services/TurnResolutionService.js';
import { MissionService } from '../services/MissionService.js';
import { DuelService } from '../services/DuelService.js';
import { zapoManager } from '../../../integrations/zapo/ZapoConnectionManager.js';

export class RpgController {
  /**
   * Retorna os dados completos da batalha para a WebView 2.5D
   * GET /api/rpg/batalha/:battleId?t=token
   */
  public static async getBattleState(req: Request, res: Response): Promise<void> {
    try {
      const { battleId } = req.params;
      const token = (req.query.t || req.headers.authorization?.replace(/^Bearer\s+/, '')) as string;

      if (!token) {
        res.status(401).json({ error: 'Token de acesso à batalha não fornecido.' });
        return;
      }

      let decoded;
      try {
        decoded = RpgTokenService.verifyBattleToken(token);
      } catch (err: any) {
        res.status(401).json({ error: err.message });
        return;
      }

      if (decoded.battleId !== battleId) {
        res.status(403).json({ error: 'Token não corresponde a esta arena de combate.' });
        return;
      }

      const battle = await RpgBattle.findByPk(battleId, {
        include: [
          {
            model: RpgBattleParticipant,
            as: 'participants',
          },
        ],
      });

      if (!battle) {
        res.status(404).json({ error: 'Batalha não encontrada ou já expirada.' });
        return;
      }

      const participants = (battle.get('participants') as RpgBattleParticipant[]) || [];
      const participantsData = [];

      for (const p of participants) {
        const char = await RpgCharacter.findByPk(p.characterId);
        const isSelf = decoded.phone && p.phone === decoded.phone;

        let cardsInHand: any[] = [];
        if (isSelf) {
          // Se for o próprio jogador, revelar cartas completas na mão
          const cards = await RpgCard.findAll({ where: { id: p.hand } });
          cardsInHand = cards.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            category: c.category,
            element: c.element,
            energyCost: c.energyCost,
            power: c.power,
            priority: c.priority,
            emoji: c.emoji,
            isBluff: c.isBluff,
          }));
        } else {
          // Oponente ou espectador: apenas quantidade de cartas na mão (anti-trapaça!)
          cardsInHand = p.hand.map((_, idx) => ({ id: `hidden_${idx}`, hidden: true }));
        }

        participantsData.push({
          id: p.id,
          playerId: p.playerId,
          name: p.name,
          phone: isSelf ? p.phone : undefined,
          isBot: p.isBot,
          characterId: p.characterId,
          characterName: char?.name || p.name,
          characterTitle: char?.title,
          characterClass: char?.characterClass,
          affinity: char?.affinity,
          weakness: char?.weakness,
          resistance: char?.resistance,
          avatarEmoji: char?.avatarEmoji || '👔',
          passiveName: char?.passiveName,
          passiveDescription: char?.passiveDescription,
          maxHp: p.maxHp,
          currentHp: p.currentHp,
          maxEnergy: p.maxEnergy,
          currentEnergy: p.currentEnergy,
          popularity: p.popularity,
          rage: p.rage,
          cardLocked: p.cardLocked,
          selectedCardId: isSelf ? p.selectedCardId : (p.cardLocked ? 'locked' : null),
          activeStatuses: p.activeStatuses,
          handCount: p.hand.length,
          hand: cardsInHand,
        });
      }

      // Buscar os últimos 5 turnos resolvidos para replay/histórico
      const recentTurns = await RpgBattleTurn.findAll({
        where: { battleId },
        order: [['turnNumber', 'ASC']],
        limit: 10,
      });

      res.json({
        battle: {
          id: battle.id,
          mode: battle.mode,
          status: battle.status,
          arena: battle.arena,
          currentTurn: battle.currentTurn,
          maxTurns: battle.maxTurns,
          turnDeadline: battle.turnDeadline,
          winnerPlayerId: battle.winnerPlayerId,
        },
        participants: participantsData,
        recentTurns: recentTurns.map((t) => ({
          turnNumber: t.turnNumber,
          events: t.events,
          logSummary: t.logSummary,
        })),
        viewer: {
          role: decoded.role,
          phone: decoded.phone,
        },
      });
    } catch (err: any) {
      console.error('[RpgController] Erro ao obter estado da batalha:', err);
      res.status(500).json({ error: 'Erro interno ao carregar a batalha.' });
    }
  }

  /**
   * Joga uma carta na batalha via WebView
   * POST /api/rpg/batalha/:battleId/jogar
   */
  public static async playCard(req: Request, res: Response): Promise<void> {
    try {
      const { battleId } = req.params;
      const { cardId } = req.body;
      const token = (req.query.t || req.headers.authorization?.replace(/^Bearer\s+/, '')) as string;

      if (!token) {
        res.status(401).json({ error: 'Token de autenticação ausente.' });
        return;
      }

      if (!cardId) {
        res.status(400).json({ error: 'ID da carta não informado.' });
        return;
      }

      const decoded = RpgTokenService.verifyBattleToken(token);
      if (decoded.battleId !== battleId) {
        res.status(403).json({ error: 'Token não corresponde a esta arena.' });
        return;
      }

      if (decoded.role === 'spectator' || !decoded.phone) {
        res.status(403).json({ error: 'Espectadores não podem jogar cartas.' });
        return;
      }

      const result = await TurnResolutionService.lockCard({
        battleId,
        phone: decoded.phone,
        cardId,
      });

      res.json(result);
    } catch (err: any) {
      console.error('[RpgController] Erro ao jogar carta:', err.message);
      res.status(400).json({ error: err.message || 'Erro ao travar carta.' });
    }
  }

  /**
   * Lista o ranking dos melhores parlamentares
   * GET /api/rpg/ranking
   */
  public static async getRanking(req: Request, res: Response): Promise<void> {
    try {
      const players = await RpgPlayer.findAll({
        order: [
          ['elo', 'DESC'],
          ['level', 'DESC'],
        ],
        limit: 20,
        attributes: [
          'id',
          'name',
          'level',
          'xp',
          'coins',
          'elo',
          'prestige',
          'victories',
          'defeats',
          'draws',
          'winStreak',
        ],
      });

      res.json({ ranking: players });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao obter ranking.' });
    }
  }

  /**
   * Lista personagens jogáveis ativos
   * GET /api/rpg/personagens
   */
  public static async getCharacters(req: Request, res: Response): Promise<void> {
    try {
      const characters = await RpgCharacter.findAll({
        where: { active: true },
        order: [['name', 'ASC']],
      });
      res.json({ characters });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar personagens.' });
    }
  }

  /**
   * Consulta metas e missões diárias
   * GET /api/rpg/missoes
   */
  public static async getMissions(req: Request, res: Response): Promise<void> {
    try {
      const phone = (req.query.phone as string) || '5511999999999@s.whatsapp.net';
      const result = await MissionService.getDailyMissions(phone);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao obter missões.' });
    }
  }

  /**
   * Visão geral administrativa do ecossistema RPG
   * GET /api/rpg/admin/overview
   */
  public static async getAdminOverview(req: Request, res: Response): Promise<void> {
    try {
      const totalPlayers = await RpgPlayer.count();
      const activeBattlesCount = await RpgBattle.count({
        where: { status: ['selecting_characters', 'selecting_cards', 'resolving_turn'] },
      });
      const totalBattlesCount = await RpgBattle.count();
      const totalCoinsInCirculation = (await RpgPlayer.sum('coins')) || 0;

      const recentBattles = await RpgBattle.findAll({
        order: [['createdAt', 'DESC']],
        limit: 10,
        include: [{ model: RpgBattleParticipant, as: 'participants' }],
      });

      const allCharacters = await RpgCharacter.findAll({
        order: [['name', 'ASC']],
      });

      const configs = await RpgConfig.findAll({
        order: [['key', 'ASC']],
      });

      res.json({
        stats: {
          totalPlayers,
          activeBattlesCount,
          totalBattlesCount,
          totalCoinsInCirculation,
        },
        recentBattles,
        characters: allCharacters,
        configs,
      });
    } catch (err: any) {
      console.error('[RpgController] Erro no painel admin:', err);
      res.status(500).json({ error: 'Erro ao carregar dados administrativos.' });
    }
  }

  /**
   * Alterna estado de ativação de um personagem (kill-switch de segurança)
   * POST /api/rpg/admin/personagens/:id/toggle
   */
  public static async toggleCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const character = await RpgCharacter.findByPk(id);

      if (!character) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }

      character.active = !character.active;
      await character.save();

      await RpgAuditLog.create({
        action: 'toggle_character',
        targetType: 'character',
        targetId: id,
        details: { active: character.active, name: character.name },
      });

      res.json({ success: true, active: character.active, name: character.name });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alterar estado do personagem.' });
    }
  }

  /**
   * Atualiza valor de uma configuração / feature flag do RPG
   * PUT /api/rpg/admin/configs/:key
   */
  public static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        res.status(400).json({ error: 'Valor da configuração não fornecido.' });
        return;
      }

      const [config] = await RpgConfig.upsert({
        key,
        value: String(value),
      });

      await RpgAuditLog.create({
        action: 'update_config',
        targetType: 'config',
        targetId: key,
        details: { key, value: String(value) },
      });

      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar configuração.' });
    }
  }

  /**
   * Dispara batalha de bot no grupo ou chat
   * POST /api/rpg/duelo/bot
   */
  public static async startBotDuel(req: any, res: Response): Promise<void> {
    try {
      const { connectionId, targetJid, difficulty = 'facil', phone, userName } = req.body;
      const client = zapoManager.getClient(connectionId);
      if (!client) {
        res.status(400).json({ error: 'Sessão WhatsApp não está conectada.' });
        return;
      }
      const reply = await DuelService.startBotBattle({
        connectionId,
        targetJid,
        phone: phone || '553499198782@s.whatsapp.net',
        userName: userName || 'Candidato Yran',
        difficulty,
        client,
      });
      res.json({ success: true, reply });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
