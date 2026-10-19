import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir requisições sem cabeçalho Origin (apps móveis, curl, chamadas de servidor)
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.trim().replace(/\/+$/, '');

        // Permitir se estiver explicitamente configurado na lista de origens
        if (config.corsOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        // Em desenvolvimento, permitir localhost e 127.0.0.1
        if (config.env === 'development') {
          if (
            normalizedOrigin.startsWith('http://localhost') ||
            normalizedOrigin.startsWith('http://127.0.0.1')
          ) {
            callback(null, true);
            return;
          }
        }

        // Rejeitar qualquer outra origem não autorizada
        callback(new Error('Origem não permitida pela política CORS.'));
      },
      credentials: true,
    })
  );

  // Body Parsers (support device camera/gallery high-res photo uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zaptroll-backend',
    });
  });

  // Ensure media directory exists
  fs.mkdirSync(config.mediaDir, { recursive: true });

  // Serve media files statically
  app.use('/api/media', express.static(config.mediaDir));
  app.use('/media', express.static(config.mediaDir));

  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use('/public', express.static(publicDir));
    app.use('/memes', express.static(path.join(publicDir, 'memes')));
    app.use('/api/memes-static', express.static(path.join(publicDir, 'memes')));
  }

  // Mount API router
  app.use('/api', apiRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}
