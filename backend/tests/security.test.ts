import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cors from 'cors';
import { validateConfig, config } from '../src/config/index.js';
import { AutoDestructService } from '../src/modules/messages/AutoDestructService.js';
import { MessagesController } from '../src/modules/messages/messages.controller.js';
import { MemesController } from '../src/modules/memes/memes.controller.js';
import { MemeFlowService } from '../src/modules/memes/MemeFlowService.js';
import { WhatsAppConnection, Conversation, Message } from '../src/database/models/index.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../src/integrations/zapo/ZapoMessageAdapter.js';

describe('Security & Production Configuration (validateConfig)', () => {
  it('rejects default JWT_SECRET placeholder in production', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'zaptroll_super_secure_jwt_secret_change_in_production_32chars', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'StrongPassword123!' },
      db: { ...config.db, password: 'StrongDbPassword2026!' },
      corsOrigins: ['https://app.zaptroll.com'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'zaptroll_super_secure_jwt_secret_change_in_production_32chars',
        FIRST_ADMIN_PASSWORD: 'StrongPassword123!',
        DB_PASSWORD: 'StrongDbPassword2026!',
      });
    }).toThrow(/JWT_SECRET é obrigatório e não pode ser o valor padrão/);
  });

  it('rejects short JWT_SECRET (< 32 chars) in production', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'short-secret-12345', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'StrongPassword123!' },
      db: { ...config.db, password: 'StrongDbPassword2026!' },
      corsOrigins: ['https://app.zaptroll.com'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'short-secret-12345',
        FIRST_ADMIN_PASSWORD: 'StrongPassword123!',
        DB_PASSWORD: 'StrongDbPassword2026!',
      });
    }).toThrow(/no mínimo 32 caracteres/);
  });

  it('rejects weak or default FIRST_ADMIN_PASSWORD in production', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'super_secure_random_jwt_key_with_more_than_32_characters_12345', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'Admin@SecurePass2026!' },
      db: { ...config.db, password: 'StrongDbPassword2026!' },
      corsOrigins: ['https://app.zaptroll.com'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'super_secure_random_jwt_key_with_more_than_32_characters_12345',
        FIRST_ADMIN_PASSWORD: 'Admin@SecurePass2026!',
        DB_PASSWORD: 'StrongDbPassword2026!',
      });
    }).toThrow(/não pode ser uma senha padrão ou fraca/);
  });

  it('rejects default database password in production', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'super_secure_random_jwt_key_with_more_than_32_characters_12345', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'StrongPassword123!' },
      db: { ...config.db, dialect: 'postgres' as const, password: 'zaptroll_secret_pass' },
      corsOrigins: ['https://app.zaptroll.com'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'super_secure_random_jwt_key_with_more_than_32_characters_12345',
        FIRST_ADMIN_PASSWORD: 'StrongPassword123!',
        DB_PASSWORD: 'zaptroll_secret_pass',
      });
    }).toThrow(/DB_PASSWORD é obrigatório e não pode ser a senha padrão/);
  });

  it('rejects wildcard "*" in CORS_ORIGIN in production', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'super_secure_random_jwt_key_with_more_than_32_characters_12345', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'StrongPassword123!' },
      db: { ...config.db, dialect: 'postgres' as const, password: 'StrongDbPassword2026!' },
      corsOrigins: ['*'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'super_secure_random_jwt_key_with_more_than_32_characters_12345',
        FIRST_ADMIN_PASSWORD: 'StrongPassword123!',
        DB_PASSWORD: 'StrongDbPassword2026!',
      });
    }).toThrow(/CORS_ORIGIN não pode conter "\*"/);
  });

  it('accepts strong, explicit production configuration', () => {
    const prodConfig = {
      ...config,
      env: 'production',
      jwt: { secret: 'super_secure_random_jwt_key_with_more_than_32_characters_12345', expiresIn: '7d' },
      firstAdmin: { name: 'Admin', email: 'admin@domain.com', password: 'StrongPassword123!' },
      db: { ...config.db, dialect: 'postgres' as const, password: 'StrongDbPassword2026!' },
      corsOrigins: ['https://app.zaptroll.com', 'https://admin.zaptroll.com'],
    };

    expect(() => {
      validateConfig(prodConfig as any, {
        JWT_SECRET: 'super_secure_random_jwt_key_with_more_than_32_characters_12345',
        FIRST_ADMIN_PASSWORD: 'StrongPassword123!',
        DB_PASSWORD: 'StrongDbPassword2026!',
      });
    }).not.toThrow();
  });
});

describe('CORS Security Policy Enforcement', () => {
  function createTestApp(env: string, allowedOrigins: string[]) {
    const app = express();
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }
          const normalized = origin.trim().replace(/\/+$/, '');
          if (allowedOrigins.includes(normalized)) {
            callback(null, true);
            return;
          }
          if (env === 'development') {
            if (normalized.startsWith('http://localhost') || normalized.startsWith('http://127.0.0.1')) {
              callback(null, true);
              return;
            }
          }
          callback(new Error('Origem não permitida pela política CORS.'));
        },
        credentials: true,
      })
    );
    app.get('/test', (req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows request with origin matching whitelist', async () => {
    const app = createTestApp('production', ['https://trusted-domain.com']);
    const res = await request(app).get('/test').set('Origin', 'https://trusted-domain.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://trusted-domain.com');
  });

  it('allows request when origin has trailing slash by normalising', async () => {
    const app = createTestApp('production', ['https://trusted-domain.com']);
    const res = await request(app).get('/test').set('Origin', 'https://trusted-domain.com/');
    expect(res.status).toBe(200);
  });

  it('allows requests without origin header (mobile/curl)', async () => {
    const app = createTestApp('production', ['https://trusted-domain.com']);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('blocks unauthorized origin in production', async () => {
    const app = createTestApp('production', ['https://trusted-domain.com']);
    const res = await request(app).get('/test').set('Origin', 'https://malicious-site.com');
    expect(res.status).toBe(500); // Express default error handler on CORS reject
  });
});

describe('Multi-user & Cross-connection Authorization', () => {
  const mockUser = { id: 'user-1', email: 'user1@example.com', role: 'user' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('MessagesController.send', () => {
    it('rejects sending when conversation belongs to another connection', async () => {
      // Conexão pertence ao usuário autenticado
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      } as any);

      // Cliente Zapo ativo
      vi.spyOn(zapoManager, 'getClient').mockReturnValue({} as any);

      // Conversa NÃO encontrada para a conexão conn-1 (pertence a conn-2)
      vi.spyOn(Conversation, 'findOne').mockResolvedValue(null);

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-1',
          conversationId: 'conv-belongs-to-conn-2',
          type: 'text',
          payload: { text: 'Olá!' },
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.send(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Conversa não encontrada ou não autorizada.' })
      );
    });

    it('rejects when recipientJid does not match conversation.jid', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      } as any);

      vi.spyOn(zapoManager, 'getClient').mockReturnValue({} as any);

      // Conversa encontrada, mas com JID diferente
      vi.spyOn(Conversation, 'findOne').mockResolvedValue({
        id: 'conv-1',
        connectionId: 'conn-1',
        jid: '5511999999999@s.whatsapp.net',
      } as any);

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-1',
          conversationId: 'conv-1',
          recipientJid: '5521888888888@s.whatsapp.net', // Destinatário discrepante
          type: 'text',
          payload: { text: 'Olá' },
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.send(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'O destinatário não corresponde à conversa.' })
      );
    });
  });

  describe('MessagesController.revoke', () => {
    it('rejects revoking message when connection is not owned by user', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue(null);

      const cancelSpy = vi.spyOn(AutoDestructService, 'cancel');

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-not-mine',
          stanzaId: 'stanza-123',
          conversationId: 'conv-1',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.revoke(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Conexão não encontrada ou não autorizada.' })
      );
      // Timer NÃO deve ser cancelado se a conexão não for autorizada
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('rejects revoking when conversation does not belong to the connection', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      } as any);

      // Conversa não pertence à conexão
      vi.spyOn(Conversation, 'findOne').mockResolvedValue(null);
      const cancelSpy = vi.spyOn(AutoDestructService, 'cancel');

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-1',
          stanzaId: 'stanza-123',
          conversationId: 'conv-other-conn',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.revoke(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Conversa não encontrada ou não autorizada para esta conexão.' })
      );
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('rejects revoking a message received from someone else (fromMe: false)', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      } as any);

      vi.spyOn(Conversation, 'findOne').mockResolvedValue({
        id: 'conv-1',
        connectionId: 'conn-1',
        jid: '5511999999999@s.whatsapp.net',
      } as any);

      vi.spyOn(Message, 'findOne').mockResolvedValue({
        id: 'msg-1',
        connectionId: 'conn-1',
        conversationId: 'conv-1',
        stanzaId: 'stanza-123',
        fromMe: false, // Mensagem de terceiro
      } as any);

      const cancelSpy = vi.spyOn(AutoDestructService, 'cancel');

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-1',
          stanzaId: 'stanza-123',
          conversationId: 'conv-1',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.revoke(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Apenas mensagens enviadas por você podem ser revogadas.' })
      );
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('cancels timer and completes revocation successfully when authorized', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      } as any);

      vi.spyOn(Conversation, 'findOne').mockResolvedValue({
        id: 'conv-1',
        connectionId: 'conn-1',
        jid: '5511999999999@s.whatsapp.net',
      } as any);

      const mockMsg = {
        id: 'msg-1',
        connectionId: 'conn-1',
        conversationId: 'conv-1',
        stanzaId: 'stanza-123',
        fromMe: true,
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Message, 'findOne').mockResolvedValue(mockMsg as any);

      vi.spyOn(zapoManager, 'getClient').mockReturnValue({} as any);
      vi.spyOn(ZapoMessageAdapter, 'revokeMessage').mockResolvedValue(undefined as any);

      const cancelSpy = vi.spyOn(AutoDestructService, 'cancel');

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-1',
          stanzaId: 'stanza-123',
          conversationId: 'conv-1',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MessagesController.revoke(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      // Timer cancelado com connectionId e stanzaId APÓS autorização e sucesso
      expect(cancelSpy).toHaveBeenCalledWith('conn-1', 'stanza-123');
    });
  });

  describe('MemesController & MemeFlowService', () => {
    it('rejects triggering meme flow if connection does not belong to user', async () => {
      vi.spyOn(WhatsAppConnection, 'findOne').mockResolvedValue(null);

      const req: any = {
        user: mockUser,
        body: {
          connectionId: 'conn-foreign',
          conversationId: 'conv-1',
          flowId: 'jacare',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await MemesController.triggerFlow(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Conexão não encontrada ou não autorizada.' })
      );
    });

    it('rejects triggerJacareFlow if conversationId belongs to another connection', async () => {
      vi.spyOn(zapoManager, 'getClient').mockReturnValue({} as any);
      vi.spyOn(Conversation, 'findOne').mockResolvedValue(null);

      await expect(
        MemeFlowService.triggerJacareFlow({
          connectionId: 'conn-1',
          conversationId: 'conv-from-conn-2',
        })
      ).rejects.toThrow(/Conversa não encontrada ou não autorizada para esta conexão/);
    });
  });
});

describe('AutoDestructService Reliability & Collision Resistance', () => {
  afterEach(() => {
    AutoDestructService.cancel('conn-1', 'stanza-dup');
    AutoDestructService.cancel('conn-2', 'stanza-dup');
  });

  it('maintains independent tasks for the same stanzaId across two different connections', () => {
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      stanzaId: 'stanza-dup',
      delaySeconds: 100,
    });

    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-2',
      conversationId: 'conv-2',
      stanzaId: 'stanza-dup',
      delaySeconds: 100,
    });

    // Ambas as tarefas coexistem sem colisão
    expect(AutoDestructService.getTaskKey('conn-1', 'stanza-dup')).not.toBe(
      AutoDestructService.getTaskKey('conn-2', 'stanza-dup')
    );
  });

  it('cancelling connection A task does not remove connection B task with same stanzaId', () => {
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      stanzaId: 'stanza-dup',
      delaySeconds: 100,
    });

    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-2',
      conversationId: 'conv-2',
      stanzaId: 'stanza-dup',
      delaySeconds: 100,
    });

    const countBefore = AutoDestructService.getActiveTimersCount();

    // Cancela apenas para conn-1
    AutoDestructService.cancel('conn-1', 'stanza-dup');

    const countAfter = AutoDestructService.getActiveTimersCount();
    expect(countBefore - countAfter).toBe(1);

    // Cancela conn-2
    AutoDestructService.cancel('conn-2', 'stanza-dup');
    expect(AutoDestructService.getActiveTimersCount()).toBe(countAfter - 1);
  });

  it('safely handles delays longer than MAX_TIMEOUT_MS (~24.8 days)', () => {
    // 30 dias em segundos (2.592.000s)
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;

    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-long',
      conversationId: 'conv-long',
      stanzaId: 'stanza-long',
      delaySeconds: thirtyDaysSeconds,
    });

    expect(AutoDestructService.getActiveTimersCount()).toBeGreaterThan(0);
    AutoDestructService.cancel('conn-long', 'stanza-long');
  });
});
