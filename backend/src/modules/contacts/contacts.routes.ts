import { Router } from 'express';
import { ContactsController } from './contacts.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/profile', ContactsController.getProfile);
router.get('/download-picture', ContactsController.downloadProfilePicture);
router.get('/picture-proxy', ContactsController.pictureProxy);
router.get('/connection/:connectionId', ContactsController.list);

export default router;
