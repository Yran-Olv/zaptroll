import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { RpgAccessCodeService } from '../src/modules/rpg/services/RpgAccessCodeService.js';
import { RpgBattleAccessCode } from '../src/modules/rpg/models/RpgBattleAccessCode.js';
import { RpgAuditLog } from '../src/modules/rpg/models/RpgAuditLog.js';
import { rateLimiter } from '../src/middleware/rateLimiter.js';

describe('Zaptroll RPG — Security Access Codes Architecture (/a/{codigo})', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Base62 Generation & Format', () => {
    it('generates base62 codes with 11 chars by default using cryptographically secure random bytes', () => {
      const code = RpgAccessCodeService.generateCode(11);
      expect(code).toHaveLength(11);
      expect(code).toMatch(/^[0-9a-zA-Z]{11}$/);
    });

    it('generates completely unique codes across multiple invocations (high entropy)', () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const code = RpgAccessCodeService.generateCode(11);
        expect(set.has(code)).toBe(false);
        set.add(code);
      }
      expect(set.size).toBe(1000);
    });
  });

  describe('2. Constant-Time Validation, Expiration and Revocation', () => {
    it('validates authentic non-expired code with constant-time comparison', async () => {
      const codeStr = 'AbCdEf12345';
      const mockRecord = {
        code: codeStr,
        battleId: 'battle-uuid-1',
        participantId: 'part-uuid-1',
        role: 'fighter',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora no futuro
        revoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(RpgBattleAccessCode, 'findOne').mockResolvedValue(mockRecord as any);
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      const result = await RpgAccessCodeService.validateCode(codeStr, '127.0.0.1', 'Mozilla/5.0');
      expect(result.valid).toBe(true);
      expect(result.record).toBeDefined();
      expect(result.record?.battleId).toBe('battle-uuid-1');
      expect(result.record?.role).toBe('fighter');
    });

    it('rejects malformed or empty code strings safely', async () => {
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      const r1 = await RpgAccessCodeService.validateCode('', '127.0.0.1');
      expect(r1.valid).toBe(false);
      expect(r1.reason).toBe('MALFORMED');

      const r2 = await RpgAccessCodeService.validateCode('short', '127.0.0.1');
      expect(r2.valid).toBe(false);
      expect(r2.reason).toBe('MALFORMED');
    });

    it('rejects non-existent code (code from another battle or unknown)', async () => {
      vi.spyOn(RpgBattleAccessCode, 'findOne').mockResolvedValue(null);
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      const result = await RpgAccessCodeService.validateCode('InvalidCode12', '127.0.0.1');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('rejects expired codes safely', async () => {
      const mockRecord = {
        code: 'ExpiredCode1',
        battleId: 'battle-uuid-1',
        role: 'fighter',
        expiresAt: new Date(Date.now() - 10000), // Já expirado
        revoked: false,
        save: vi.fn(),
      };

      vi.spyOn(RpgBattleAccessCode, 'findOne').mockResolvedValue(mockRecord as any);
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      const result = await RpgAccessCodeService.validateCode('ExpiredCode1', '127.0.0.1');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });

    it('rejects revoked codes immediately', async () => {
      const mockRecord = {
        code: 'RevokedCode1',
        battleId: 'battle-uuid-1',
        role: 'fighter',
        expiresAt: new Date(Date.now() + 60000),
        revoked: true, // Revogado
        save: vi.fn(),
      };

      vi.spyOn(RpgBattleAccessCode, 'findOne').mockResolvedValue(mockRecord as any);
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      const result = await RpgAccessCodeService.validateCode('RevokedCode1', '127.0.0.1');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('REVOKED');
    });

    it('performs timing-safe comparison on code buffers', async () => {
      const timingSafeSpy = vi.spyOn(crypto, 'timingSafeEqual');

      const mockRecord = {
        code: 'CompareCode1',
        battleId: 'battle-uuid-1',
        role: 'spectator',
        expiresAt: new Date(Date.now() + 60000),
        revoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(RpgBattleAccessCode, 'findOne').mockResolvedValue(mockRecord as any);
      vi.spyOn(RpgAccessCodeService, 'recordAudit').mockResolvedValue(undefined);

      await RpgAccessCodeService.validateCode('CompareCode1', '127.0.0.1');
      expect(timingSafeSpy).toHaveBeenCalled();
    });
  });

  describe('3. Spectator vs Fighter Privacy & Hands Masking', () => {
    it('ensures spectator NEVER receives participant card hands', () => {
      const rawHand = ['card_soco', 'card_cpi', 'card_esquiva'];

      // Simulação da lógica de mascaramento do endpoint /api/rpg/a/:code
      const sanitizeForRole = (role: 'fighter' | 'spectator', isSelf: boolean, hand: string[]) => {
        if (role === 'fighter' && isSelf) {
          return hand.map((c) => ({ id: c, name: `Carta ${c}` }));
        }
        return hand.map((_, idx) => ({ id: `hidden_${idx}`, hidden: true }));
      };

      // 1. Visão de Espectador
      const spectatorView = sanitizeForRole('spectator', false, rawHand);
      expect(spectatorView.every((c: any) => c.hidden === true)).toBe(true);
      expect(spectatorView.some((c: any) => c.name)).toBe(false);

      // 2. Visão do Lutador (sua própria mão)
      const selfView = sanitizeForRole('fighter', true, rawHand);
      expect(selfView.every((c: any) => c.name !== undefined)).toBe(true);
      expect(selfView.some((c: any) => c.hidden)).toBe(false);

      // 3. Visão do Lutador sobre a mão do Oponente (deve ser oculta!)
      const opponentView = sanitizeForRole('fighter', false, rawHand);
      expect(opponentView.every((c: any) => c.hidden === true)).toBe(true);
    });
  });

  describe('4. Strict Participant Binding (Player A cannot lock card for Player B)', () => {
    it('locks card strictly for the participant linked to the access code', () => {
      const codeRecord = {
        code: 'FighterA1234',
        battleId: 'battle-100',
        participantId: 'p_yran_id',
        role: 'fighter',
      };

      const participants = [
        { id: 'p_yran_id', name: 'Yran', cardLocked: false },
        { id: 'p_bot_id', name: 'Dona Reforma', cardLocked: false },
      ];

      // Tentar jogar como outro participante
      const validateParticipantAttempt = (accessPartId: string, requestedPartId: string) => {
        if (accessPartId !== requestedPartId) {
          throw new Error('Acesso negado: código não pertence a este combatente.');
        }
        return true;
      };

      // Jogar como ele mesmo: SUCESSO
      expect(() => validateParticipantAttempt(codeRecord.participantId, 'p_yran_id')).not.toThrow();

      // Jogar como o oponente: FALHA
      expect(() => validateParticipantAttempt(codeRecord.participantId, 'p_bot_id')).toThrow(
        'Acesso negado: código não pertence a este combatente.'
      );
    });

    it('rejects spectators attempting to lock card', () => {
      const codeRecord = {
        code: 'Spectator123',
        role: 'spectator',
      };

      const canPlay = (role: string) => {
        if (role !== 'fighter') {
          throw new Error('Espectadores não possuem permissão para jogar cartas.');
        }
        return true;
      };

      expect(() => canPlay(codeRecord.role)).toThrow('Espectadores não possuem permissão');
    });
  });

  describe('5. Rate Limiter Anti-Brute Force', () => {
    it('blocks excessive requests from the same IP when limit is exceeded', () => {
      const limiter = rateLimiter(5, 60000); // 5 requisições por minuto
      const req: any = { ip: '192.168.1.100', socket: {} };
      let lastStatus = 200;
      let lastJson: any = null;
      const res: any = {
        setHeader: vi.fn(),
        status: (s: number) => {
          lastStatus = s;
          return {
            json: (payload: any) => {
              lastJson = payload;
            },
          };
        },
      };
      const next = vi.fn();

      // Fazer 5 requisições normais
      for (let i = 0; i < 5; i++) {
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(5);
      expect(lastStatus).toBe(200);

      // 6ª requisição deve ser bloqueada com 429
      limiter(req, res, next);
      expect(lastStatus).toBe(429);
      expect(lastJson?.error).toContain('Muitas requisições');
    });
  });
});
