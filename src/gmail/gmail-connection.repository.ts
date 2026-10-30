import type { GmailConnection } from '@prisma/client';

export interface GmailConnectionInput {
  accountEmail: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
}

export abstract class GmailConnectionRepository {
  abstract get(): Promise<GmailConnection | null>;
  abstract save(input: GmailConnectionInput): Promise<GmailConnection>;
  abstract delete(): Promise<void>;
}
