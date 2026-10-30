import type { Request } from 'express';

export interface AppSession {
  sessionId: string;
  expiresAt: number;
}

export interface AuthenticatedRequest extends Request {
  appSession?: AppSession;
}
