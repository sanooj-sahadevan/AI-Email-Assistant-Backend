import type { EmailCategory } from '@prisma/client';

export interface WhatsAppNotificationPayload {
  recipient: string;
  sender?: string;
  subject: string;
  category?: EmailCategory;
  message: string;
  emailId?: string;
  gmailMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProviderResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: Date;
}

export abstract class NotificationProvider {
  abstract readonly name: string;
  abstract sendNotification(
    payload: WhatsAppNotificationPayload,
  ): Promise<NotificationProviderResult>;
}
