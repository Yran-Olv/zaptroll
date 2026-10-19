import http from 'http';
import { createApp } from './app.js';
import { config, validateConfig } from './config/index.js';
import { initDatabase } from './database/models/index.js';
import { RpgSeedService } from './modules/rpg/services/RpgSeedService.js';
import { initSocket } from './modules/realtime/socket.js';
import { zapoManager } from './integrations/zapo/ZapoConnectionManager.js';
import { AutoDestructService } from './modules/messages/AutoDestructService.js';

async function bootstrap() {
  try {
    console.log('🚀 Starting Zaptroll Backend...');

    // 0. Security pre-flight validation
    validateConfig();

    // 1. Initialize Database & Seed RPG
    await initDatabase();
    await RpgSeedService.seedDefaults();

    // 2. Setup Express & HTTP Server
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    initSocket(server);
    console.log('⚡ Socket.IO initialized.');

    // 4. Restore any existing connected sessions
    await zapoManager.restoreConnectedSessions();

    // 5. Initialize AutoDestruct recovery for temporary messages
    await AutoDestructService.init();

    // 5. Start listening
    server.listen(config.port, () => {
      console.log(`📡 Zaptroll Backend listening on port ${config.port} (${config.env})`);
      console.log(`🔗 API Base: http://localhost:${config.port}/api`);
    });

    // 6. Graceful Shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      await zapoManager.destroyAll();
      server.close(() => {
        console.log('👋 HTTP server closed. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('💥 Fatal error during backend bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();
