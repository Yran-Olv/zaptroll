import { Router } from 'express';
import { GroupsController } from './groups.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/connection/:connectionId', GroupsController.list);
router.post('/connection/:connectionId', GroupsController.create);
router.post('/sync/:connectionId', GroupsController.sync);

export default router;
