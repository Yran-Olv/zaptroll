import { Router } from 'express';
import { MessagesController } from './messages.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/history/:conversationId', MessagesController.getHistory);
router.post('/send', MessagesController.send);
router.post('/revoke', MessagesController.revoke);

export default router;
