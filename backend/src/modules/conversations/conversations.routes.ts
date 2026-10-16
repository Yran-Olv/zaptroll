import { Router } from 'express';
import { ConversationsController } from './conversations.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/connection/:connectionId', ConversationsController.list);
router.post('/sync/:connectionId', ConversationsController.syncMailbox);
router.post('/close-all', ConversationsController.closeAllConversations);
router.post('/close-selected', ConversationsController.closeSelectedConversations);
router.post('/reopen-all', ConversationsController.reopenAllConversations);
router.put('/:id/close', ConversationsController.closeConversation);
router.put('/:id/reopen', ConversationsController.reopenConversation);
router.get('/:id', ConversationsController.getById);
router.post('/:id/read', ConversationsController.markAsRead);

export default router;
