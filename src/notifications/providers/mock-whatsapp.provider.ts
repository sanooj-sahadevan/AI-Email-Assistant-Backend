import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  NotificationProvider,
  NotificationProviderResult,
  WhatsAppNotificationPayload,
} from './notification-provider.interface.js';

@Injectable()
export class MockWhatsAppProvider implements NotificationProvider {
  readonly name = 'mock_whatsapp';
  private readonly logger = new Logger(MockWhatsAppProvider.name);

  // Testing flag to verify failure and retry handling
  private shouldFailNext = false;

  setSimulateFailure(fail: boolean): void {
    this.shouldFailNext = fail;
  }

  async sendNotification(
    payload: WhatsAppNotificationPayload,
  ): Promise<NotificationProviderResult> {
    const timestamp = new Date();

    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      this.logger.warn(
        `[MOCK WHATSAPP] Simulated delivery failure to ${payload.recipient} for subject: "${payload.subject}"`,
      );
      return {
        success: false,
        error: 'Simulated upstream gateway timeout (Mock failure for retry test)',
        provider: this.name,
        timestamp,
      };
    }

    const messageId = `mock_wa_${randomUUID()}`;

    // Log simulated delivery safely without sensitive body or credentials
    this.logger.log(
      `[MOCK WHATSAPP] Successfully dispatched alert to ${payload.recipient} | ID: ${messageId} | Subject: "${payload.subject}" | Category: ${payload.category ?? 'N/A'}`,
    );

    return {
      success: true,
      messageId,
      provider: this.name,
      timestamp,
    };
  }
}
