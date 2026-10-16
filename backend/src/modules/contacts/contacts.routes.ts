import { Router } from 'express';
import { ContactsController } from './contacts.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/connection/:connectionId', ContactsController.list);

export default router;
