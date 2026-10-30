import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  NotificationProviderResult,
  WhatsAppNotificationPayload,
} from './notification-provider.interface.js';

export interface MetaWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
  templateName?: string;
  templateLanguage?: string;
}

/**
 * WhatsAppCloudApiProvider
 *
 * Sends WhatsApp template messages through Meta's official Cloud API.
 * Every alert uses a pre-approved template because email alerts can arrive
 * outside WhatsApp's customer-service window.
 */
@Injectable()
export class WhatsAppCloudApiProvider implements NotificationProvider {
  readonly name = 'whatsapp_cloud_api';
  private readonly logger = new Logger(WhatsAppCloudApiProvider.name);

  // E.164 international phone number format: +[country code][number]
  private static readonly PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

  constructor(private readonly config: ConfigService) {}

  validatePhoneNumber(phone: string): boolean {
    return WhatsAppCloudApiProvider.PHONE_REGEX.test(phone.trim());
  }

  buildMetaPayload(
    payload: WhatsAppNotificationPayload,
    templateName = 'email_alert_notification',
    templateLanguage = 'en_US',
  ): Record<string, unknown> {
    const cleanPhone = payload.recipient.replace(/[^\d+]/g, '');

    // Standard Meta Cloud API template message format
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: payload.category ?? 'Important' },
              { type: 'text', text: payload.sender ?? 'Unknown Sender' },
              { type: 'text', text: payload.subject.slice(0, 80) },
              { type: 'text', text: payload.message.slice(0, 150) },
            ],
          },
        ],
      },
    };
  }

  async sendNotification(
    payload: WhatsAppNotificationPayload,
  ): Promise<NotificationProviderResult> {
    const timestamp = new Date();
    const config: MetaWhatsAppConfig = {
      phoneNumberId: this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
      accessToken: this.config.get<string>('WHATSAPP_ACCESS_TOKEN'),
      apiVersion: this.config.get<string>('WHATSAPP_API_VERSION'),
      templateName: this.config.get<string>('WHATSAPP_TEMPLATE_NAME'),
      templateLanguage: this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE'),
    };

    if (!this.validatePhoneNumber(payload.recipient)) {
      return {
        success: false,
        error: `Invalid recipient phone format (${payload.recipient}). Must be E.164 (e.g. +15551234567).`,
        provider: this.name,
        timestamp,
      };
    }

    if (
      !config.phoneNumberId ||
      !config.accessToken ||
      !config.apiVersion ||
      !config.templateName ||
      !config.templateLanguage
    ) {
      return {
        success: false,
        error: 'WhatsApp Cloud API is not fully configured.',
        provider: this.name,
        timestamp,
      };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(
            this.buildMetaPayload(payload, config.templateName, config.templateLanguage),
          ),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { messages?: Array<{ id?: string }>; error?: { message?: string } }
        | null;

      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message ?? `Meta WhatsApp API returned HTTP ${response.status}.`,
          provider: this.name,
          timestamp,
        };
      }

      const messageId = data?.messages?.[0]?.id;
      this.logger.log(`WhatsApp alert accepted by Meta for ${payload.recipient}.`);
      return {
        success: true,
        ...(messageId ? { messageId } : {}),
        provider: this.name,
        timestamp,
      };
    } catch (error) {
      this.logger.warn(
        `WhatsApp Cloud API request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        success: false,
        error: 'Could not reach the WhatsApp Cloud API.',
        provider: this.name,
        timestamp,
      };
    }
  }
}
