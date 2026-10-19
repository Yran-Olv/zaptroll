import { Router } from 'express';
import { AdvancedController } from './advanced.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Templates & Interactive Examples
router.get('/examples', AdvancedController.getExamples);
router.get('/templates', AdvancedController.listTemplates);
router.post('/templates', AdvancedController.saveTemplate);
router.delete('/templates/:id', AdvancedController.deleteTemplate);

// 1. Phone & Location Lookup (DDD, Estado, Cidades, Operadora)
router.get('/phone-lookup/:phone', AdvancedController.phoneLookup);
router.post('/phone-lookup', AdvancedController.phoneLookup);

// 2. Official WhatsApp Server Health & Ping Latency Check
router.get('/server-health/:connectionId', AdvancedController.serverHealth);

// 3. Status & Stories
router.get('/status/:connectionId', AdvancedController.listStatus);
router.post('/status/post', AdvancedController.postStatus);
router.post('/status/view', AdvancedController.markStatusViewed);

// 4. Ghost Mention
router.post('/ghost-mention', AdvancedController.sendGhostMention);

// 5. Community Features & Protocol Reverse Engineering (Jobas Fernandes)
router.get('/community-credits', AdvancedController.getCommunityCredits);
router.post('/meta-banner', AdvancedController.sendMetaBanner);
router.post('/group-status', AdvancedController.sendGroupStatus);
router.post('/poll', AdvancedController.sendPoll);
router.post('/meta-ai', AdvancedController.askMetaAi);

export default router;
