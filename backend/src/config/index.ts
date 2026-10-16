import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback to current dir .env

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  
  db: {
    url: process.env.DATABASE_URL || 'postgres://zaptroll_user:zaptroll_secret_pass@localhost:5432/zaptroll_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'zaptroll_user',
    password: process.env.DB_PASSWORD || 'zaptroll_secret_pass',
    database: process.env.DB_NAME || 'zaptroll_db',
    dialect: (process.env.DB_DIALECT || 'postgres') as 'postgres' | 'sqlite',
    storage: process.env.DB_STORAGE || './zaptroll_dev.sqlite',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'zaptroll_super_secure_jwt_secret_change_in_production_32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  firstAdmin: {
    name: process.env.FIRST_ADMIN_NAME || 'Admin Zaptroll',
    email: process.env.FIRST_ADMIN_EMAIL || 'admin@zaptroll.local',
    password: process.env.FIRST_ADMIN_PASSWORD || 'Admin@SecurePass2026!',
  },

  limits: {
    defaultMaxConnections: parseInt(process.env.DEFAULT_MAX_CONNECTIONS_PER_USER || '3', 10),
    defaultRateLimitPerMin: parseInt(process.env.DEFAULT_RATE_LIMIT_PER_MINUTE || '120', 10),
  },

  zapo: {
    storePrefix: process.env.ZAPO_STORE_PREFIX || 'wa_',
    cleanupIntervalMs: parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS || '60000', 10),
  },

  mediaDir: process.env.MEDIA_DIR || path.resolve(process.cwd(), 'uploads/media'),

  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:80').split(','),
};
