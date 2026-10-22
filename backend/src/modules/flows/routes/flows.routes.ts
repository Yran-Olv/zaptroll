import { Router } from 'express';
import { FlowController } from '../controllers/flows.controller.js';
import { authMiddleware } from '../../../middleware/auth.js';

const router = Router();

// ==========================================
// ROTAS PÚBLICAS (Acesso sem login para WebViews e Formulários)
// ==========================================
router.get('/public/form/:publicId', FlowController.getPublicForm);
router.post('/public/form/:publicId/submit', FlowController.submitPublicForm);

// ==========================================
// ROTAS AUTENTICADAS (Gerenciamento do Flow Studio)
// ==========================================
router.use(authMiddleware);

router.get('/', FlowController.list);
router.post('/', FlowController.create);
router.get('/templates', FlowController.getTemplates);
router.post('/templates/:templateId/instantiate', FlowController.instantiateTemplate);
router.post('/simulate', FlowController.simulate);

router.get('/:id', FlowController.getById);
router.put('/:id', FlowController.saveVersion);
router.post('/:id/versions', FlowController.saveVersion);
router.post('/:id/publish', FlowController.publish);
router.post('/:id/unpublish', FlowController.unpublish);
router.delete('/:id', FlowController.delete);

export default router;
