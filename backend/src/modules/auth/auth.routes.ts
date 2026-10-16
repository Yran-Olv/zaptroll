import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// Public routes with brute force protection
router.post('/register', rateLimiter(30, 60000), AuthController.register);
router.post('/login', rateLimiter(30, 60000), AuthController.login);

// Protected route
router.get('/me', authMiddleware, AuthController.me);

export default router;
