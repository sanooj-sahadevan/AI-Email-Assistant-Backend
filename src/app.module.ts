import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailManagementModule } from './email-management/email-management.module.js';
import { FilteringModule } from './filtering/filtering.module.js';
import { GmailModule } from './gmail/gmail.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const port = Number(config.PORT ?? 3001);
  const databaseUrl = config.DATABASE_URL;
  const appPassphrase = config.APP_PASSPHRASE;
  const sessionSecret = config.APP_SESSION_SECRET;
  const encryptionKey = config.GMAIL_TOKEN_ENCRYPTION_KEY;
  const frontendUrl = config.FRONTEND_URL;
  const redirectUri = config.GMAIL_REDIRECT_URI;
  const defaultSyncLimit = Number(config.GMAIL_SYNC_DEFAULT_LIMIT ?? 25);
  const maxSyncLimit = Number(config.GMAIL_SYNC_MAX_LIMIT ?? 100);
  const autoSyncLimit = Number(
    config.GMAIL_AUTO_SYNC_LIMIT ?? Math.min(defaultSyncLimit, maxSyncLimit),
  );
  const autoSyncInterval = Number(config.GMAIL_AUTO_SYNC_INTERVAL_MS ?? 60_000);
  const aiEnabled = config.AI_ENABLED ?? 'false';
  const ollamaBaseUrl = config.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const ollamaModel = config.OLLAMA_MODEL ?? 'llama3.2:3b';
  const ollamaTimeout = Number(config.OLLAMA_TIMEOUT_MS ?? 10000);
  const whatsappProvider = config.WHATSAPP_PROVIDER ?? 'mock';
  const whatsappApiVersion = config.WHATSAPP_API_VERSION;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  if (
    typeof databaseUrl !== 'string' ||
    (!databaseUrl.startsWith('postgresql://') &&
      !databaseUrl.startsWith('postgres://'))
  ) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }

  if (aiEnabled !== 'true' && aiEnabled !== 'false') {
    throw new Error('AI_ENABLED must be true or false.');
  }

  let ollamaUrl: URL;
  if (typeof ollamaBaseUrl !== 'string') {
    throw new Error('OLLAMA_BASE_URL must be a local absolute URL.');
  }
  try {
    ollamaUrl = new URL(ollamaBaseUrl);
  } catch {
    throw new Error('OLLAMA_BASE_URL must be a local absolute URL.');
  }
  const host = ollamaUrl.hostname.toLowerCase();
  const localHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === 'host.docker.internal' ||
    host === 'ollama' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (
    !['http:', 'https:'].includes(ollamaUrl.protocol) ||
    !localHost ||
    ollamaUrl.username ||
    ollamaUrl.password
  ) {
    throw new Error('OLLAMA_BASE_URL must point to a local Ollama service.');
  }

  if (
    typeof ollamaModel !== 'string' ||
    ollamaModel.trim().length < 1 ||
    ollamaModel.length > 128
  ) {
    throw new Error('OLLAMA_MODEL must be a model name no longer than 128 characters.');
  }

  if (!Number.isInteger(ollamaTimeout) || ollamaTimeout < 1000 || ollamaTimeout > 120000) {
    throw new Error('OLLAMA_TIMEOUT_MS must be between 1000 and 120000.');
  }

  if (typeof appPassphrase !== 'string' || appPassphrase.length < 12) {
    throw new Error('APP_PASSPHRASE must contain at least 12 characters.');
  }

  if (typeof sessionSecret !== 'string' || !/^[\da-f]{64}$/i.test(sessionSecret)) {
    throw new Error('APP_SESSION_SECRET must be 32 bytes encoded as 64 hex characters.');
  }

  if (typeof encryptionKey !== 'string' || !/^[\da-f]{64}$/i.test(encryptionKey)) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters.');
  }

  for (const [name, value] of [
    ['FRONTEND_URL', frontendUrl],
    ['GMAIL_REDIRECT_URI', redirectUri],
  ] as const) {
    if (typeof value !== 'string' || !URL.canParse(value)) {
      throw new Error(`${name} must be an absolute URL.`);
    }
  }

  if (
    !Number.isInteger(defaultSyncLimit) ||
    !Number.isInteger(maxSyncLimit) ||
    defaultSyncLimit < 1 ||
    !Number.isInteger(autoSyncLimit) ||
    autoSyncLimit < 1 ||
    autoSyncLimit > maxSyncLimit ||
    maxSyncLimit < defaultSyncLimit ||
    maxSyncLimit > 500
  ) {
    throw new Error('GMAIL_SYNC_DEFAULT_LIMIT and GMAIL_SYNC_MAX_LIMIT must be valid limits (max 500).');
  }

  if (!Number.isInteger(autoSyncInterval) || autoSyncInterval < 15_000 || autoSyncInterval > 3_600_000) {
    throw new Error('GMAIL_AUTO_SYNC_INTERVAL_MS must be between 15000 and 3600000.');
  }

  if (whatsappProvider !== 'mock' && whatsappProvider !== 'cloud_api') {
    throw new Error('WHATSAPP_PROVIDER must be mock or cloud_api.');
  }

  if (whatsappProvider === 'cloud_api') {
    for (const name of ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_TEMPLATE_NAME', 'WHATSAPP_TEMPLATE_LANGUAGE']) {
      if (typeof config[name] !== 'string' || !(config[name] as string).trim()) {
        throw new Error(`${name} is required when WHATSAPP_PROVIDER=cloud_api.`);
      }
    }
    if (typeof whatsappApiVersion !== 'string' || !/^v\d+\.\d+$/.test(whatsappApiVersion)) {
      throw new Error('WHATSAPP_API_VERSION must be set to a Meta Graph API version such as v23.0.');
    }
  }

  return {
    ...config,
    PORT: port,
    GMAIL_SYNC_DEFAULT_LIMIT: defaultSyncLimit,
    GMAIL_SYNC_MAX_LIMIT: maxSyncLimit,
    GMAIL_AUTO_SYNC_LIMIT: autoSyncLimit,
    GMAIL_AUTO_SYNC_INTERVAL_MS: autoSyncInterval,
    WHATSAPP_PROVIDER: whatsappProvider,
    AI_ENABLED: aiEnabled,
    OLLAMA_BASE_URL: ollamaUrl.toString(),
    OLLAMA_MODEL: ollamaModel.trim(),
    OLLAMA_TIMEOUT_MS: ollamaTimeout,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AuthModule,
    DatabaseModule,
    HealthModule,
    GmailModule,
    AiModule,
    EmailManagementModule,
    FilteringModule,
    NotificationsModule,
  ],
})
export class AppModule {}
