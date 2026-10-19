import crypto from 'crypto';
import { RpgBattleAccessCode, AccessRole } from '../models/RpgBattleAccessCode.js';
import { RpgAuditLog } from '../models/RpgAuditLog.js';

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface ValidateCodeResult {
  valid: boolean;
  record?: RpgBattleAccessCode;
  reason?: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'MISMATCH' | 'MALFORMED';
}

export class RpgAccessCodeService {
  /**
   * Gera uma string criptograficamente segura em Base62
   */
  public static generateCode(length = 11): string {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
    }
    return result;
  }

  /**
   * Cria um código de acesso seguro no banco de dados
   */
  public static async createAccessCode(params: {
    battleId: string;
    role: AccessRole;
    participantId?: string | null;
    playerId?: string | null;
    phone?: string | null;
    ttlHours?: number;
  }): Promise<RpgBattleAccessCode> {
    const { battleId, role, participantId, playerId, phone, ttlHours = 4 } = params;

    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      code = this.generateCode(11);
      const existing = await RpgBattleAccessCode.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      // Fallback seguro caso improvável de colisão múltipla
      code = this.generateCode(14);
    }

    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const record = await RpgBattleAccessCode.create({
      code,
      battleId,
      participantId: participantId || null,
      playerId: playerId || null,
      phone: phone || null,
      role,
      expiresAt,
      revoked: false,
    });

    await this.recordAudit({
      action: 'ACCESS_CODE_CREATED',
      code,
      battleId,
      targetId: participantId || battleId,
      details: { role, phone, expiresAt },
    });

    return record;
  }

  /**
   * Obtém ou gera código de espectador para a batalha
   */
  public static async getOrCreateSpectatorCode(battleId: string): Promise<string> {
    const existing = await RpgBattleAccessCode.findOne({
      where: {
        battleId,
        role: 'spectator',
        revoked: false,
      },
      order: [['createdAt', 'DESC']],
    });

    if (existing && existing.expiresAt > new Date()) {
      return existing.code;
    }

    const newCode = await this.createAccessCode({
      battleId,
      role: 'spectator',
      ttlHours: 6,
    });

    return newCode.code;
  }

  /**
   * Obtém ou gera código de lutador para um participante específico
   */
  public static async getOrCreateFighterCode(params: {
    battleId: string;
    participantId: string;
    playerId?: string | null;
    phone?: string | null;
  }): Promise<string> {
    const { battleId, participantId, playerId, phone } = params;

    const existing = await RpgBattleAccessCode.findOne({
      where: {
        battleId,
        participantId,
        role: 'fighter',
        revoked: false,
      },
      order: [['createdAt', 'DESC']],
    });

    if (existing && existing.expiresAt > new Date()) {
      return existing.code;
    }

    const newCode = await this.createAccessCode({
      battleId,
      participantId,
      playerId,
      phone,
      role: 'fighter',
      ttlHours: 4,
    });

    return newCode.code;
  }

  /**
   * Validação com comparação em tempo constante, checagem de expiração e revogação
   */
  public static async validateCode(
    rawCode: string,
    ip?: string,
    userAgent?: string
  ): Promise<ValidateCodeResult> {
    if (!rawCode || typeof rawCode !== 'string' || rawCode.length < 8 || rawCode.length > 20) {
      await this.recordAudit({
        action: 'ACCESS_CODE_MALFORMED',
        code: rawCode ? rawCode.slice(0, 12) : '',
        details: { ip, userAgent },
      });
      return { valid: false, reason: 'MALFORMED' };
    }

    const record = await RpgBattleAccessCode.findOne({
      where: { code: rawCode },
    });

    if (!record) {
      await this.recordAudit({
        action: 'ACCESS_CODE_NOT_FOUND',
        code: rawCode,
        details: { ip, userAgent },
      });
      return { valid: false, reason: 'NOT_FOUND' };
    }

    // Comparação em tempo constante para mitigar timing attacks
    const codeBuf = Buffer.from(record.code, 'utf8');
    const inputBuf = Buffer.from(rawCode, 'utf8');

    if (codeBuf.length !== inputBuf.length || !crypto.timingSafeEqual(codeBuf, inputBuf)) {
      await this.recordAudit({
        action: 'ACCESS_CODE_MISMATCH',
        code: rawCode,
        battleId: record.battleId,
        details: { ip, userAgent },
      });
      return { valid: false, reason: 'MISMATCH' };
    }

    if (record.revoked) {
      await this.recordAudit({
        action: 'ACCESS_CODE_REVOKED',
        code: rawCode,
        battleId: record.battleId,
        details: { ip, userAgent, participantId: record.participantId },
      });
      return { valid: false, reason: 'REVOKED' };
    }

    if (new Date() > record.expiresAt) {
      await this.recordAudit({
        action: 'ACCESS_CODE_EXPIRED',
        code: rawCode,
        battleId: record.battleId,
        details: { ip, userAgent, expiresAt: record.expiresAt },
      });
      return { valid: false, reason: 'EXPIRED' };
    }

    // Atualiza estatísticas de acesso de forma assíncrona
    record.lastUsedAt = new Date();
    if (ip) record.ipAddress = ip;
    if (userAgent) record.userAgent = userAgent.slice(0, 255);
    record.save().catch(() => {});

    return { valid: true, record };
  }

  /**
   * Revoga um código específico
   */
  public static async revokeCode(code: string, reason?: string): Promise<boolean> {
    const record = await RpgBattleAccessCode.findOne({ where: { code } });
    if (!record) return false;

    record.revoked = true;
    await record.save();

    await this.recordAudit({
      action: 'ACCESS_CODE_REVOKED_MANUALLY',
      code,
      battleId: record.battleId,
      targetId: record.participantId || record.battleId,
      details: { reason },
    });

    return true;
  }

  /**
   * Revoga todos os códigos de uma batalha quando finalizada ou cancelada
   */
  public static async revokeBattleCodes(battleId: string): Promise<void> {
    await RpgBattleAccessCode.update(
      { revoked: true },
      { where: { battleId, revoked: false } }
    );

    await this.recordAudit({
      action: 'ALL_BATTLE_CODES_REVOKED',
      code: 'ALL',
      battleId,
      targetId: battleId,
    });
  }

  /**
   * Registro no log de auditoria
   */
  public static async recordAudit(params: {
    action: string;
    code: string;
    battleId?: string;
    targetId?: string;
    details?: any;
  }): Promise<void> {
    try {
      await RpgAuditLog.create({
        action: params.action,
        targetType: 'ARENA_ACCESS_CODE',
        targetId: params.targetId || params.battleId || params.code,
        details: {
          code: params.code,
          battleId: params.battleId,
          ...params.details,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      console.warn('[RpgAccessCodeService] Falha ao registrar log de auditoria:', e.message);
    }
  }
}
