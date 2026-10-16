import fs from 'node:fs';
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
        // Allow requests with no origin (like mobile apps, curl) or allowed origins
        if (!origin || config.corsOrigins.includes(origin) || config.env === 'development') {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev/local setups
        }
      },
      credentials: true,
    })
  );

  // Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // Mount API router
  app.use('/api', apiRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}
