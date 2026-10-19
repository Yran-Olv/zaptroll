import { Router } from 'express';
import { RpgController } from '../controllers/rpg.controller.js';
import { authMiddleware } from '../../../middleware/auth.js';
import { adminMiddleware } from '../../../middleware/admin.js';
import { rateLimiter } from '../../../middleware/rateLimiter.js';

const router = Router();

// Endpoints seguros via código Base62 (/a/:code)
router.get('/a/:code', rateLimiter(60, 60000), RpgController.getBattleStateByCode);
router.post('/a/:code/jogar', rateLimiter(30, 60000), RpgController.playCardByCode);

// Endpoints legados para compatibilidade
router.get('/batalha/:battleId', RpgController.getBattleState);
router.post('/batalha/:battleId/jogar', RpgController.playCard);

// Endpoints de duelo
router.post('/duelo/bot', authMiddleware, RpgController.startBotDuel);

// Endpoints informativos, missões e ranking
router.get('/ranking', RpgController.getRanking);
router.get('/personagens', RpgController.getCharacters);
router.get('/missoes', RpgController.getMissions);

// Endpoints Administrativos protegidos por JWT + Admin
router.get('/admin/overview', authMiddleware, adminMiddleware, RpgController.getAdminOverview);
router.post('/admin/personagens/:id/toggle', authMiddleware, adminMiddleware, RpgController.toggleCharacter);
router.put('/admin/configs/:key', authMiddleware, adminMiddleware, RpgController.updateConfig);

export default router;
