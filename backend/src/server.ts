import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { initDatabase } from './database/models/index.js';
import { initSocket } from './modules/realtime/socket.js';
import { zapoManager } from './integrations/zapo/ZapoConnectionManager.js';

async function bootstrap() {
  try {
    console.log('🚀 Starting Zaptroll Backend...');

    // 1. Initialize Database
    await initDatabase();

    // 2. Setup Express & HTTP Server
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    initSocket(server);
    console.log('⚡ Socket.IO initialized.');

    // 4. Restore any existing connected sessions
    await zapoManager.restoreConnectedSessions();

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
