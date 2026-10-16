import { Router } from 'express';
import { MemesController } from './memes.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/flows', MemesController.listFlows);
router.post('/flows/trigger', MemesController.triggerFlow);

export default router;
