import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GmailConnection } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../email-management/email.service.js';
import { ClassificationService } from '../filtering/classification.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { GmailConnectionRepository } from './gmail-connection.repository.js';
import {
  GMAIL_READONLY_SCOPE,
  GoogleGmailProvider,
} from './google-gmail.provider.js';
import { GmailOAuthStateRepository } from './gmail-oauth-state.repository.js';
import { mapGmailMessage } from './gmail-message.mapper.js';
import { TokenEncryptionService } from './token-encryption.service.js';

const OAUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;

interface ErrorResponse {
  status?: number;
  code?: string;
  response?: {
    status?: number;
    data?: {
      error?: string | {
        status?: string;
        errors?: Array<{ reason?: string }>;
      };
      error_description?: string;
    };
  };
}

function errorResponse(error: unknown): ErrorResponse | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return error as ErrorResponse;
}

function isInvalidGrant(error: unknown): boolean {
  const value = errorResponse(error);
  return (
    value?.response?.data?.error === 'invalid_grant' ||
    value?.response?.data?.error === 'invalid_token'
  );
}

@Injectable()
export class GmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GmailService.name);
  private autoSyncTimer: ReturnType<typeof setInterval> | undefined;
  private autoSyncInProgress = false;

  constructor(
    private readonly config: ConfigService,
    private readonly googleProvider: GoogleGmailProvider,
    private readonly connectionRepository: GmailConnectionRepository,
    private readonly stateRepository: GmailOAuthStateRepository,
    private readonly encryption: TokenEncryptionService,
    private readonly emailService: EmailService,
    private readonly classificationService: ClassificationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get<number>('GMAIL_AUTO_SYNC_INTERVAL_MS') ?? 60_000;
    this.autoSyncTimer = setInterval(() => {
      void this.syncRecentEmailsAutomatically();
    }, intervalMs);
    this.autoSyncTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
  }

  private async syncRecentEmailsAutomatically(): Promise<void> {
    if (this.autoSyncInProgress) return;

    const connection = await this.connectionRepository.get().catch(() => null);
    if (!connection) return;

    this.autoSyncInProgress = true;
    try {
      const limit = this.config.getOrThrow<number>('GMAIL_AUTO_SYNC_LIMIT');
      const result = await this.sync(limit, undefined);
      this.logger.log(
        `Automatic Gmail check fetched ${result.fetchedCount} messages and saved ${result.savedCount} new messages.`,
      );
    } catch (error) {
      this.logger.warn(
        `Automatic Gmail check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.autoSyncInProgress = false;
    }
  }

  async createAuthorizationUrl(sessionId: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    const stateHash = createHash('sha256').update(state).digest('hex');
    const expiresAt = new Date(Date.now() + OAUTH_STATE_LIFETIME_MS);
    await this.stateRepository.create(stateHash, sessionId, expiresAt);

    const oauth = this.googleProvider.createOAuthClient();
    return oauth.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      prompt: 'consent',
      scope: [GMAIL_READONLY_SCOPE],
      state,
    });
  }

  async completeAuthorization(
    code: string,
    state: string,
    sessionId: string,
  ): Promise<void> {
    const stateHash = createHash('sha256').update(state).digest('hex');
    const stateIsValid = await this.stateRepository.consume(
      stateHash,
      sessionId,
    );
    if (!stateIsValid) {
      throw new BadRequestException(
        'OAuth state is invalid or expired. Start the connection again.',
      );
    }

    const oauth = this.googleProvider.createOAuthClient();
    let tokens;
    try {
      ({ tokens } = await oauth.getToken(code));
    } catch {
      throw new BadGatewayException(
        'Google authorization could not be completed. Start the connection again.',
      );
    }

    if (!tokens.access_token) {
      throw new BadGatewayException(
        'Google did not return an access token. Start the connection again.',
      );
    }

    oauth.setCredentials(tokens);
    let accountEmail: string;
    try {
      const profile = await this.googleProvider
        .createGmailClient(oauth)
        .users.getProfile({ userId: 'me' });
      if (!profile.data.emailAddress) {
        throw new Error('Google profile does not include an email address.');
      }
      accountEmail = profile.data.emailAddress;
    } catch {
      throw new BadGatewayException(
        'Google account details could not be read. Check Gmail API access and try again.',
      );
    }

    const previous = await this.connectionRepository.get();
    const refreshToken =
      tokens.refresh_token ??
      (previous?.refreshTokenEncrypted
        ? this.encryption.decrypt(previous.refreshTokenEncrypted)
        : null);
    await this.saveTokens(accountEmail, tokens.access_token, refreshToken, tokens.expiry_date);
  }

  async getStatus() {
    const connection = await this.connectionRepository.get();
    return {
      connected: connection !== null,
      accountEmail: connection?.accountEmail ?? null,
      connectedAt: connection?.createdAt.toISOString() ?? null,
    };
  }

  async sync(
    limit: number | undefined,
    pageToken: string | undefined,
  ): Promise<{ fetchedCount: number; savedCount: number; nextPageToken: string | null }> {
    const defaultLimit = this.config.getOrThrow<number>(
      'GMAIL_SYNC_DEFAULT_LIMIT',
    );
    const maxLimit = this.config.getOrThrow<number>('GMAIL_SYNC_MAX_LIMIT');
    const pageSize = limit ?? defaultLimit;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxLimit) {
      throw new BadRequestException(
        `limit must be between 1 and ${maxLimit}.`,
      );
    }

    const gmail = await this.getGmailClient();
    try {
      const list = await gmail.users.messages.list({
        userId: 'me',
        maxResults: pageSize,
        ...(pageToken ? { pageToken } : {}),
      });
      const messageIds = (list.data.messages ?? [])
        .map((message) => message.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const messages = [];
      for (let index = 0; index < messageIds.length; index += 5) {
        const batch = await Promise.all(
          messageIds.slice(index, index + 5).map(async (id) => {
            const result = await gmail.users.messages.get({
              userId: 'me',
              id,
              format: 'full',
            });
            return mapGmailMessage(result.data);
          }),
        );
        messages.push(...batch);
      }
      const records = messages.filter(
        (message): message is NonNullable<typeof message> => message !== null,
      );
      for (const record of records) {
        const classification = this.classificationService.classify({
          senderEmail: record.senderEmail,
          senderName: record.senderName,
          subject: record.subject,
          snippet: record.snippet,
          body: record.body,
        });
        record.category = classification.category;
        record.classificationReason = classification.reason;
      }
      const alreadyStored = await this.emailService.findByGmailMessageIds(
        records.map((record) => record.gmailMessageId),
      );
      const previouslyStoredIds = new Set(
        alreadyStored.map((email) => email.gmailMessageId),
      );
      const savedCount = await this.emailService.saveSyncedEmails(records);

      const newMessageIds = records
        .map((record) => record.gmailMessageId)
        .filter((id) => !previouslyStoredIds.has(id));
      if (savedCount > 0 && newMessageIds.length > 0) {
        const isInitialSync = Boolean(pageToken);
        const storedEmails = await this.emailService.findByGmailMessageIds(
          newMessageIds,
        );
        await Promise.allSettled(
          storedEmails.map((email) =>
            this.notificationsService.evaluateAndProcessEmail(email, {
              isInitialSync,
            }),
          ),
        );
      }

      return {
        fetchedCount: records.length,
        savedCount,
        nextPageToken: list.data.nextPageToken ?? null,
      };
    } catch (error) {
      return this.handleGmailError(error);
    }
  }

  async listEmails(limit: number, cursor?: string) {
    const emails = await this.emailService.findRecent(limit + 1, cursor);
    const hasMore = emails.length > limit;
    const page = hasMore ? emails.slice(0, limit) : emails;
    return {
      emails: page,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async disconnect(): Promise<{ deletedMessages: number; googleAccessRevoked: boolean }> {
    const connection = await this.connectionRepository.get();
    let googleAccessRevoked = connection === null;

    if (connection) {
      const oauth = this.googleProvider.createOAuthClient();
      const token = connection.refreshTokenEncrypted
        ? this.encryption.decrypt(connection.refreshTokenEncrypted)
        : this.encryption.decrypt(connection.accessTokenEncrypted);
      try {
        await oauth.revokeToken(token);
        googleAccessRevoked = true;
      } catch {
        googleAccessRevoked = false;
      }
    }

    const [deletedMessages] = await Promise.all([
      this.emailService.deleteAll(),
      this.connectionRepository.delete(),
    ]);
    return { deletedMessages, googleAccessRevoked };
  }

  private async getGmailClient() {
    const connection = await this.connectionRepository.get();
    if (!connection) {
      throw new UnauthorizedException(
        'Gmail is not connected. Connect your account before syncing.',
      );
    }

    const oauth = this.createAuthorizedClient(connection);
    try {
      const accessToken = await oauth.getAccessToken();
      if (!accessToken.token) {
        throw new UnauthorizedException(
          'Gmail access has expired. Reconnect your Google account.',
        );
      }
    } catch (error) {
      if (isInvalidGrant(error)) {
        await this.connectionRepository.delete();
        throw new UnauthorizedException(
          'Google access has expired or was revoked. Reconnect your Google account.',
        );
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadGatewayException(
        'Google access could not be refreshed. Reconnect your Google account.',
      );
    }

    const credentials = oauth.credentials;
    const accessToken = credentials.access_token;
    if (!accessToken) {
      throw new UnauthorizedException(
        'Gmail access has expired. Reconnect your Google account.',
      );
    }

    const refreshToken = credentials.refresh_token
      ? credentials.refresh_token
      : connection.refreshTokenEncrypted
        ? this.encryption.decrypt(connection.refreshTokenEncrypted)
        : null;
    await this.saveTokens(
      connection.accountEmail,
      accessToken,
      refreshToken,
      credentials.expiry_date ?? null,
    );
    return this.googleProvider.createGmailClient(oauth);
  }

  private createAuthorizedClient(connection: GmailConnection): OAuth2Client {
    const oauth = this.googleProvider.createOAuthClient();
    oauth.setCredentials({
      access_token: this.encryption.decrypt(connection.accessTokenEncrypted),
      refresh_token: connection.refreshTokenEncrypted
        ? this.encryption.decrypt(connection.refreshTokenEncrypted)
        : undefined,
      expiry_date: connection.expiresAt?.getTime(),
    });
    return oauth;
  }

  private async saveTokens(
    accountEmail: string,
    accessToken: string,
    refreshToken: string | null,
    expiryDate: number | null | undefined,
  ): Promise<void> {
    await this.connectionRepository.save({
      accountEmail,
      accessTokenEncrypted: this.encryption.encrypt(accessToken),
      refreshTokenEncrypted: refreshToken
        ? this.encryption.encrypt(refreshToken)
        : null,
      expiresAt:
        typeof expiryDate === 'number' && Number.isFinite(expiryDate)
          ? new Date(expiryDate)
          : null,
    });
  }

  private async handleGmailError(error: unknown): Promise<never> {
    const value = errorResponse(error);
    const responseError = value?.response?.data?.error;
    const reason =
      typeof responseError === 'object' && responseError !== null
        ? responseError.errors?.[0]?.reason ?? responseError.status
        : typeof responseError === 'string'
          ? responseError
          : value?.code;
    const safeReason =
      typeof reason === 'string' && /^[\w.-]{1,80}$/.test(reason)
        ? reason
        : 'unknown';
    const logStatus = value?.response?.status ?? value?.status;
    this.logger.warn(
      `Gmail API request failed (HTTP ${logStatus ?? 'unknown'}, reason ${safeReason}).`,
    );

    if (isInvalidGrant(error) || errorResponse(error)?.response?.status === 401) {
      await this.connectionRepository.delete();
      throw new UnauthorizedException(
        'Google access has expired or was revoked. Reconnect your Google account.',
      );
    }

    const status =
      errorResponse(error)?.response?.status ?? errorResponse(error)?.status;
    if (status === 400) {
      throw new BadRequestException(
        'The Gmail page token is invalid. Restart synchronization from the newest page.',
      );
    }

    throw new BadGatewayException(
      'The Gmail API request failed. Try again later.',
    );
  }
}
