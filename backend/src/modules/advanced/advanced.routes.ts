import { Router } from 'express';
import { AdvancedController } from './advanced.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/examples', AdvancedController.getExamples);
router.get('/templates', AdvancedController.listTemplates);
router.post('/templates', AdvancedController.saveTemplate);
router.delete('/templates/:id', AdvancedController.deleteTemplate);

export default router;
