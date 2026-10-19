import { Op } from 'sequelize';
import { WaClient } from 'zapo-js';
import { WhatsAppConnection } from '../../database/models/index.js';
import { ZapoClientFactory } from './ZapoClientFactory.js';
import { ZapoEventHandler } from './ZapoEventHandler.js';

interface ActiveSession {
  client: WaClient;
  cleanup?: () => Promise<void>;
  connectionId: string;
  userId: string;
  isConnecting: boolean;
}

export class ZapoConnectionManager {
  private static instance: ZapoConnectionManager;
  private sessions = new Map<string, ActiveSession>();

  private constructor() {}

  public static getInstance(): ZapoConnectionManager {
    if (!ZapoConnectionManager.instance) {
      ZapoConnectionManager.instance = new ZapoConnectionManager();
    }
    return ZapoConnectionManager.instance;
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public getClient(connectionId: string): WaClient | null {
    const session = this.sessions.get(connectionId);
    return session ? session.client : null;
  }

  public async connect(connectionId: string, userId: string): Promise<WaClient> {
    const existing = this.sessions.get(connectionId);
    if (existing) {
      if (existing.isConnecting) {
        return existing.client;
      }
      return existing.client;
    }

    const connection = await WhatsAppConnection.findOne({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new Error('Conexão não encontrada ou não pertence a este usuário.');
    }

    await connection.update({ status: 'connecting', lastError: null });

    const { client, cleanup } = await ZapoClientFactory.createClient(connection.sessionId);

    const session: ActiveSession = {
      client,
      cleanup,
      connectionId,
      userId,
      isConnecting: true,
    };
    this.sessions.set(connectionId, session);

    // Attach event listeners for real-time socket events & database updates
    ZapoEventHandler.attach(client, connectionId, userId);

    // Listen to pairing required in case of pairing code
    client.on('auth_pairing_required', () => {
      console.log(`[Zapo ${connectionId}] auth_pairing_required`);
    });

    try {
      // Connect to WhatsApp Web protocol asynchronously
      client.connect().catch(async (err: any) => {
        console.error(`[Zapo ${connectionId}] Error in connection loop:`, err);
        session.isConnecting = false;
        await WhatsAppConnection.update(
          { status: 'error', lastError: err?.message || 'Falha de conexão com WhatsApp' },
          { where: { id: connectionId } }
        );
      });

      session.isConnecting = false;
      return client;
    } catch (err: any) {
      session.isConnecting = false;
      this.sessions.delete(connectionId);
      await WhatsAppConnection.update(
        { status: 'error', lastError: err?.message || 'Erro ao inicializar conexão' },
        { where: { id: connectionId } }
      );
      throw err;
    }
  }

  public async requestPairingCode(connectionId: string, userId: string, phoneNumber: string): Promise<string> {
    let session = this.sessions.get(connectionId);
    if (!session) {
      await this.connect(connectionId, userId);
      session = this.sessions.get(connectionId);
    }

    if (!session) {
      throw new Error('Não foi possível inicializar a sessão para gerar o código de pareamento.');
    }

    // Clean phone number (digits only)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Número de telefone inválido. Informe o DDI + DDD + Número (ex: 5511999999999).');
    }

    try {
      // Aguardar o socket handshake estar pronto para pareamento
      if (!(session.client.auth as any).isConnected?.()) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 8000);
          session!.client.once('auth_pairing_required', () => {
            clearTimeout(timeout);
            resolve();
          });
          session!.client.once('auth_qr', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      const code = await session.client.auth.requestPairingCode(cleanPhone);
      await WhatsAppConnection.update(
        { pairingCode: code, status: 'awaiting_auth', phoneNumber: cleanPhone },
        { where: { id: connectionId } }
      );
      return code;
    } catch (error: any) {
      console.error(`[Zapo ${connectionId}] Pairing code request failed:`, error);
      throw new Error(`Falha ao solicitar código de pareamento: ${error?.message || 'Verifique se o número é válido'}`);
    }
  }

  public async disconnect(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (session) {
      try {
        await session.client.disconnect();
      } catch (err) {
        console.warn(`Error disconnecting client ${connectionId}:`, err);
      }
      if (session.cleanup) {
        await session.cleanup();
      }
      this.sessions.delete(connectionId);
    }

    await WhatsAppConnection.update(
      {
        status: 'disconnected',
        qrCode: null,
        pairingCode: null,
        lastDisconnectedAt: new Date(),
      },
      { where: { id: connectionId } }
    );
  }

  public async logout(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (session) {
      try {
        await session.client.logout();
      } catch (err) {
        console.warn(`Error logging out client ${connectionId}:`, err);
      }
      if (session.cleanup) {
        await session.cleanup();
      }
      this.sessions.delete(connectionId);
    }

    await WhatsAppConnection.update(
      {
        status: 'disconnected',
        phoneNumber: null,
        qrCode: null,
        pairingCode: null,
        lastDisconnectedAt: new Date(),
      },
      { where: { id: connectionId } }
    );
  }

  public async restoreConnectedSessions(): Promise<void> {
    try {
      const connections = await WhatsAppConnection.findAll({
        where: {
          [Op.or]: [
            { status: 'connected' },
            { phoneNumber: { [Op.ne]: null } },
          ],
        },
      });

      console.log(`🔄 Restoring ${connections.length} active WhatsApp sessions...`);
      for (const conn of connections) {
        try {
          await this.connect(conn.id, conn.userId);
          console.log(`✅ Session restored: ${conn.name} (${conn.id})`);
        } catch (err) {
          console.error(`❌ Failed to restore session ${conn.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Error during session restoration on startup:', err);
    }
  }

  public async destroyAll(): Promise<void> {
    console.log('🛑 Shutting down all active WhatsApp sessions cleanly...');
    const promises = Array.from(this.sessions.values()).map(async (session) => {
      try {
        await session.client.disconnect();
        if (session.cleanup) await session.cleanup();
      } catch (e) {
        // ignore on exit
      }
    });
    await Promise.all(promises);
    this.sessions.clear();
  }
}

export const zapoManager = ZapoConnectionManager.getInstance();
