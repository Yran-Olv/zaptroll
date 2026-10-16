import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { adminMiddleware } from '../../middleware/admin.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', AdminController.listUsers);
router.put('/users/:id', AdminController.updateUser);
router.get('/stats', AdminController.getStats);
router.get('/audit-logs', AdminController.listAuditLogs);

export default router;
