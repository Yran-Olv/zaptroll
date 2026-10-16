import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../database/models/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  maxConnections: number;
  rateLimit: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
    const user = await User.findByPk(decoded.id);

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Esta conta está suspensa. Entre em contato com o suporte.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      maxConnections: user.maxConnections,
      rateLimit: user.rateLimit,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }
}
