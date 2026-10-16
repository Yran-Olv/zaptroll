import { Request, Response } from 'express';
import { AuthService, registerSchema, loginSchema } from './auth.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await AuthService.register(validated);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login(validated);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async me(req: AuthRequest, res: Response): Promise<void> {
    res.json({ user: req.user });
  }
}
