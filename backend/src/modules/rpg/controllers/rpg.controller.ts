import { Request, Response } from 'express';
import {
  RpgBattle,
  RpgBattleParticipant,
  RpgBattleTurn,
  RpgCard,
  RpgCharacter,
  RpgPlayer,
} from '../models/index.js';
import { RpgTokenService } from '../services/RpgTokenService.js';
import { TurnResolutionService } from '../services/TurnResolutionService.js';

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
}
