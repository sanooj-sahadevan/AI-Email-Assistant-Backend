import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { Response } from 'express';
import type { AppSession } from './app-session.js';

const SESSION_COOKIE = 'app_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly expectedPassphraseHash: Buffer;
  private readonly sessionSecret: string;

  constructor(private readonly config: ConfigService) {
    this.expectedPassphraseHash = this.hashPassphrase(
      this.config.getOrThrow<string>('APP_PASSPHRASE'),
    );
    this.sessionSecret = this.config.getOrThrow<string>('APP_SESSION_SECRET');
  }

  login(passphrase: string, response: Response): void {
    const actualHash = this.hashPassphrase(passphrase);

    if (!timingSafeEqual(actualHash, this.expectedPassphraseHash)) {
      throw new UnauthorizedException('Invalid passphrase.');
    }

    const expiresAt = Date.now() + SESSION_DURATION_MS;
    const payload = Buffer.from(
      JSON.stringify({ sessionId: randomUUID(), expiresAt }),
    ).toString('base64url');
    const signature = this.sign(payload);

    response.cookie(SESSION_COOKIE, `${payload}.${signature}`, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    });
  }

  logout(response: Response): void {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  getSession(cookieHeader: string | undefined): AppSession | null {
    const token = this.readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) {
      return null;
    }

    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) {
      return null;
    }

    const expectedSignature = this.sign(payload);
    const suppliedSignatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (
      suppliedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(suppliedSignatureBuffer, expectedSignatureBuffer)
    ) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('sessionId' in parsed) ||
        typeof parsed.sessionId !== 'string' ||
        !('expiresAt' in parsed) ||
        typeof parsed.expiresAt !== 'number' ||
        parsed.expiresAt <= Date.now()
      ) {
        return null;
      }

      return {
        sessionId: parsed.sessionId,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  requireSession(cookieHeader: string | undefined): AppSession {
    const session = this.getSession(cookieHeader);
    if (!session) {
      throw new UnauthorizedException('Sign in to use Gmail features.');
    }
    return session;
  }

  private hashPassphrase(value: string): Buffer {
    return createHash('sha256').update(value, 'utf8').digest();
  }

  private sign(value: string): string {
    return createHmac('sha256', this.sessionSecret)
      .update(value)
      .digest('base64url');
  }

  private readCookie(
    cookieHeader: string | undefined,
    name: string,
  ): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
        continue;
      }
      return cookie.slice(separator + 1).trim();
    }

    return undefined;
  }
}
