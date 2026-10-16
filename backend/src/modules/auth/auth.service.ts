import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../../database/models/index.js';
import { config } from '../../config/index.js';

export const registerSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export class AuthService {
  static async register(data: z.infer<typeof registerSchema>) {
    const existing = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      role: 'user',
      status: 'active',
      maxConnections: config.limits.defaultMaxConnections,
      rateLimit: config.limits.defaultRateLimitPerMin,
    });

    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        maxConnections: user.maxConnections,
        rateLimit: user.rateLimit,
      },
      token,
    };
  }

  static async login(data: z.infer<typeof loginSchema>) {
    const user = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (!user) {
      throw new Error('E-mail ou senha incorretos.');
    }

    if (user.status === 'suspended') {
      throw new Error('Esta conta foi suspensa. Entre em contato com a administração.');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        maxConnections: user.maxConnections,
        rateLimit: user.rateLimit,
      },
      token,
    };
  }

  static generateToken(userId: string): string {
    return jwt.sign({ id: userId }, config.jwt.secret, {
      expiresIn: '7d',
    });
  }
}
