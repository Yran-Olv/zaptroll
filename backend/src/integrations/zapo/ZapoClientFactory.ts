import { WaClient, createStore, createPinoLogger } from 'zapo-js';
import { createPostgresStore, createPgPool } from '@zapo-js/store-postgres';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { config } from '../../config/index.js';

export class ZapoClientFactory {
  static async createClient(sessionId: string): Promise<{ client: WaClient; cleanup?: () => Promise<void> }> {
    const logger = await createPinoLogger({
      level: config.env === 'production' ? 'info' : 'debug',
      pretty: config.env !== 'production',
    });

    let store: any;
    let poller: any = null;
    let pgBackend: any = null;

    if (config.db.dialect === 'sqlite') {
      const sqliteBackend = createSqliteStore({
        path: `./.auth_${sessionId}.sqlite`,
        driver: 'auto',
      });

      store = createStore({
        backends: { sqlite: sqliteBackend },
        providers: {
          auth: 'sqlite',
          signal: 'sqlite',
          preKey: 'sqlite',
          session: 'sqlite',
          identity: 'sqlite',
          senderKey: 'sqlite',
          appState: 'sqlite',
          privacyToken: 'sqlite',
          messages: 'sqlite',
          threads: 'sqlite',
          contacts: 'sqlite',
        },
      } as any);
    } else {
      // PostgreSQL Store
      const pool = createPgPool({
        connectionString: config.db.url,
      });

      pgBackend = createPostgresStore({
        pool,
        tablePrefix: config.zapo.storePrefix,
        cleanup: {
          intervalMs: config.zapo.cleanupIntervalMs,
          onError: (e) => logger.warn(`Zapo PG cache cleanup warning: ${e.message}`),
        },
      });

      store = createStore({
        backends: { pg: pgBackend },
        providers: {
          auth: 'pg',
          signal: 'pg',
          preKey: 'pg',
          session: 'pg',
          identity: 'pg',
          senderKey: 'pg',
          appState: 'pg',
          privacyToken: 'pg',
          messages: 'pg',
          threads: 'pg',
          contacts: 'pg',
        },
      } as any);

      try {
        poller = pgBackend.startCleanup(sessionId);
      } catch (err: any) {
        logger.warn(`Could not start PG cleanup poller: ${err?.message}`);
      }
    }

    const client = new WaClient(
      {
        store,
        sessionId,
        connectTimeoutMs: 25_000,
        nodeQueryTimeoutMs: 35_000,
        history: { enabled: true, requireFullSync: false },
      },
      logger
    );

    const cleanup = async () => {
      try {
        if (poller?.stop) poller.stop();
        if (pgBackend?.destroy) await pgBackend.destroy();
        if (store?.destroy) await store.destroy();
      } catch (e) {
        console.warn('Error during store cleanup:', e);
      }
    };

    return { client, cleanup };
  }
}
