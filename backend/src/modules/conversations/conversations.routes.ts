import { Router } from 'express';
import { ConversationsController } from './conversations.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/connection/:connectionId', ConversationsController.list);
router.post('/sync/:connectionId', ConversationsController.syncMailbox);
router.get('/:id', ConversationsController.getById);
router.post('/:id/read', ConversationsController.markAsRead);

export default router;
