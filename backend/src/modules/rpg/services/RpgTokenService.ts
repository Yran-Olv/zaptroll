import jwt from 'jsonwebtoken';
import { config } from '../../../config/index.js';

export interface BattleTokenPayload {
  battleId: string;
  phone?: string;
  isSpectator: boolean;
  role: 'fighter' | 'spectator';
}

export class RpgTokenService {
  /**
   * Gera um token de acesso temporário assinado exclusivo para a batalha e usuário
   */
  public static generateBattleToken(battleId: string, phone?: string, isSpectator = false): string {
    const payload: BattleTokenPayload = {
      battleId,
      phone,
      isSpectator,
      role: isSpectator ? 'spectator' : 'fighter',
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '3h',
    });
  }

  /**
   * Valida e decodifica o token de batalha da WebView
   */
  public static verifyBattleToken(token: string): BattleTokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as BattleTokenPayload;
    } catch (err: any) {
      throw new Error('Token de acesso à batalha inválido ou expirado.');
    }
  }
}
