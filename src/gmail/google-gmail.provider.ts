import {
  ServiceUnavailableException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';

@Injectable()
export class GoogleGmailProvider {
  constructor(private readonly config: ConfigService) {}

  createOAuthClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GMAIL_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Google OAuth credentials are not configured.',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  createGmailClient(auth: OAuth2Client) {
    return google.gmail({ version: 'v1', auth });
  }

  getRedirectUri(): string {
    const redirectUri = this.config.get<string>('GMAIL_REDIRECT_URI');
    if (!redirectUri) {
      throw new ServiceUnavailableException(
        'Google OAuth redirect URI is not configured.',
      );
    }
    return redirectUri;
  }
}
