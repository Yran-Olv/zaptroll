import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback to current dir .env

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  db: {
    url: process.env.DATABASE_URL || (isProduction ? '' : 'postgres://zaptroll_user:zaptroll_secret_pass@localhost:5432/zaptroll_db'),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'zaptroll_user',
    password: process.env.DB_PASSWORD || (isProduction ? '' : 'zaptroll_secret_pass'),
    database: process.env.DB_NAME || 'zaptroll_db',
    dialect: (process.env.DB_DIALECT || 'postgres') as 'postgres' | 'sqlite',
    storage: process.env.DB_STORAGE || './zaptroll_dev.sqlite',
  },

  jwt: {
    secret: process.env.JWT_SECRET || (isProduction ? '' : 'zaptroll_dev_fallback_secret_32chars_long!!'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  firstAdmin: {
    name: process.env.FIRST_ADMIN_NAME || 'Admin Zaptroll',
    email: process.env.FIRST_ADMIN_EMAIL || 'admin@zaptroll.local',
    password: process.env.FIRST_ADMIN_PASSWORD || (isProduction ? '' : 'Admin@SecurePass2026!'),
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

  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:80')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};

/**
 * Validação rigorosa de configurações essenciais para impedir que o sistema suba em produção
 * com credenciais padrão, JWT_SECRET inseguro ou CORS excessivamente permissivo.
 */
export function validateConfig(customConfig = config, env = process.env): void {
  if (customConfig.env === 'production') {
    const errors: string[] = [];
    const jwtSecret = env.JWT_SECRET || customConfig.jwt.secret;
    const adminPass = env.FIRST_ADMIN_PASSWORD || customConfig.firstAdmin.password;
    const dbPass = env.DB_PASSWORD || customConfig.db.password;

    // 1. Validação do JWT Secret
    const defaultJwtPlaceholder = 'zaptroll_super_secure_jwt_secret_change_in_production_32chars';
    if (!jwtSecret || jwtSecret === defaultJwtPlaceholder || jwtSecret === 'zaptroll_dev_fallback_secret_32chars_long!!') {
      errors.push('JWT_SECRET é obrigatório e não pode ser o valor padrão/placeholder em ambiente de produção.');
    } else if (jwtSecret.length < 32) {
      errors.push(`JWT_SECRET deve ter no mínimo 32 caracteres em produção (atual: ${jwtSecret.length}).`);
    }

    // 2. Validação da senha do Administrador inicial
    const weakPasswords = ['Admin@SecurePass2026!', 'admin123', 'admin', '123456', 'password', 'root'];
    if (!adminPass) {
      errors.push('FIRST_ADMIN_PASSWORD é obrigatório em ambiente de produção para provisionamento seguro.');
    } else if (weakPasswords.includes(adminPass) || adminPass.length < 8) {
      errors.push('FIRST_ADMIN_PASSWORD não pode ser uma senha padrão ou fraca (mínimo de 8 caracteres).');
    }

    // 3. Validação de senha do banco em produção (PostgreSQL)
    if (customConfig.db.dialect === 'postgres') {
      if (!dbPass || dbPass === 'zaptroll_secret_pass') {
        errors.push('DB_PASSWORD é obrigatório e não pode ser a senha padrão em ambiente de produção.');
      }
    }

    // 4. Validação de política CORS
    if (customConfig.corsOrigins.includes('*')) {
      errors.push('CORS_ORIGIN não pode conter "*" em produção quando credentials estiver ativado.');
    }

    if (errors.length > 0) {
      console.error('\n❌ [CONFIG ERROR] O servidor foi bloqueado por falha nas verificações de segurança de produção:');
      errors.forEach((err) => console.error(`   - ${err}`));
      console.error('\nConfigure variáveis de ambiente válidas no arquivo .env antes de iniciar o Zaptroll.\n');
      throw new Error(`Configurações de produção inválidas:\n${errors.join('\n')}`);
    }
  }
}
