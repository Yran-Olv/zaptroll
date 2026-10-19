import { Router } from 'express';
import { RpgController } from '../controllers/rpg.controller.js';

const router = Router();

// Endpoints públicos / autenticados via token de batalha para a WebView
router.get('/batalha/:battleId', RpgController.getBattleState);
router.post('/batalha/:battleId/jogar', RpgController.playCard);

// Endpoints informativos e ranking
router.get('/ranking', RpgController.getRanking);
router.get('/personagens', RpgController.getCharacters);

export default router;
