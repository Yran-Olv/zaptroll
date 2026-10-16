import { Router } from 'express';
import { ConnectionsController } from './connections.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ConnectionsController.list);
router.post('/', ConnectionsController.create);
router.post('/:id/connect', ConnectionsController.connect);
router.post('/:id/pairing-code', ConnectionsController.requestPairingCode);
router.post('/:id/disconnect', ConnectionsController.disconnect);
router.delete('/:id', ConnectionsController.delete);

export default router;
