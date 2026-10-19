import { Router } from 'express';
import { RpgController } from '../controllers/rpg.controller.js';
import { authMiddleware } from '../../../middleware/auth.js';
import { adminMiddleware } from '../../../middleware/admin.js';

const router = Router();

// Endpoints públicos / autenticados via token de batalha para a WebView
router.get('/batalha/:battleId', RpgController.getBattleState);
router.post('/batalha/:battleId/jogar', RpgController.playCard);

// Endpoints informativos, missões e ranking
router.get('/ranking', RpgController.getRanking);
router.get('/personagens', RpgController.getCharacters);
router.get('/missoes', RpgController.getMissions);

// Endpoints Administrativos protegidos por JWT + Admin
router.get('/admin/overview', authMiddleware, adminMiddleware, RpgController.getAdminOverview);
router.post('/admin/personagens/:id/toggle', authMiddleware, adminMiddleware, RpgController.toggleCharacter);
router.put('/admin/configs/:key', authMiddleware, adminMiddleware, RpgController.updateConfig);

export default router;
