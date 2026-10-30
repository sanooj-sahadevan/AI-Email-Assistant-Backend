import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Email } from '@prisma/client';
import {
  formatWhatsAppAlertMessage,
  sanitizeErrorDetails,
} from './notification-sanitizer.js';
import type {
  NotificationConfigData,
  NotificationRule,
} from './notification-rule.interface.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationProvider } from './providers/notification-provider.interface.js';
import { SendTestNotificationDto } from './dto/send-test-notification.dto.js';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly provider: NotificationProvider,
  ) {}

  async evaluateAndProcessEmail(
    email: Email,
    options?: { isInitialSync?: boolean },
  ) {
    // 1. Prevent duplicate notifications using Gmail message ID & notification type
    const existing = await this.repository.findByGmailMessageIdAndType(
      email.gmailMessageId,
      'WHATSAPP_ALERT',
    );
    if (existing) {
      this.logger.debug(
        `Duplicate notification prevented for Gmail ID ${email.gmailMessageId}`,
      );
      return existing;
    }

    const config = await this.repository.getConfig();

    // 2. Initial sync & historical email eligibility cutoff
    const emailAgeHours =
      (Date.now() - email.receivedAt.getTime()) / (1000 * 60 * 60);
    const isHistorical =
      options?.isInitialSync || emailAgeHours > config.initialSyncCutoffHours;

    if (isHistorical) {
      return this.repository.create({
        emailId: email.id,
        gmailMessageId: email.gmailMessageId,
        type: 'WHATSAPP_ALERT',
        recipient: config.recipientPhone,
        sender: email.senderEmail,
        subject: email.subject,
        category: email.category,
        preview: email.snippet?.slice(0, 100) ?? '',
        status: 'SKIPPED',
        errorDetails: options?.isInitialSync
          ? 'Skipped historical email during initial bulk sync.'
          : `Skipped historical email (${Math.round(emailAgeHours)}h old, cutoff is ${config.initialSyncCutoffHours}h).`,
        provider: this.provider.name,
      });
    }

    // 3. Category enable/disable check
    const isCategoryEnabled = config.enabledCategories.includes(email.category);
    if (!isCategoryEnabled) {
      return this.repository.create({
        emailId: email.id,
        gmailMessageId: email.gmailMessageId,
        type: 'WHATSAPP_ALERT',
        recipient: config.recipientPhone,
        sender: email.senderEmail,
        subject: email.subject,
        category: email.category,
        preview: email.snippet?.slice(0, 100) ?? '',
        status: 'SKIPPED',
        errorDetails: `Notifications disabled for category: ${email.category}`,
        provider: this.provider.name,
      });
    }

    // 4. Configurable rules check (sender, domain, keywords, priority)
    const ruleMatch = this.findMatchingRule(email, config.rules);
    if (ruleMatch && ruleMatch.action === 'IGNORE') {
      return this.repository.create({
        emailId: email.id,
        gmailMessageId: email.gmailMessageId,
        type: 'WHATSAPP_ALERT',
        recipient: config.recipientPhone,
        sender: email.senderEmail,
        subject: email.subject,
        category: email.category,
        preview: email.snippet?.slice(0, 100) ?? '',
        status: 'SKIPPED',
        errorDetails: `Ignored by notification rule: "${ruleMatch.name}"`,
        provider: this.provider.name,
      });
    }

    const recipient = ruleMatch?.customRecipient ?? config.recipientPhone;

    // 5. Create concise notification message without sensitive content or full bodies
    const conciseMessage = formatWhatsAppAlertMessage({
      category: email.category,
      senderName: email.senderName,
      senderEmail: email.senderEmail,
      subject: email.subject,
      snippet: email.snippet,
      maxSnippetLength: config.maxSnippetLength,
    });

    // 6. Send via provider
    const sendResult = await this.provider.sendNotification({
      recipient,
      sender: email.senderName ?? email.senderEmail ?? undefined,
      subject: email.subject,
      category: email.category,
      message: conciseMessage,
      emailId: email.id,
      gmailMessageId: email.gmailMessageId,
      metadata: {
        ruleId: ruleMatch?.id,
        ruleName: ruleMatch?.name,
      },
    });

    return this.repository.create({
      emailId: email.id,
      gmailMessageId: email.gmailMessageId,
      type: 'WHATSAPP_ALERT',
      recipient,
      sender: email.senderEmail,
      subject: email.subject,
      category: email.category,
      preview: conciseMessage,
      status: sendResult.success ? 'SENT' : 'FAILED',
      sentAt: sendResult.success ? sendResult.timestamp : null,
      errorDetails: sendResult.error
        ? sanitizeErrorDetails(sendResult.error)
        : null,
      provider: this.provider.name,
      metadata: {
        messageId: sendResult.messageId,
        ruleId: ruleMatch?.id,
      },
    });
  }

  async processBatch(emails: Email[], options?: { isInitialSync?: boolean }) {
    const results = [];
    for (const email of emails) {
      const processed = await this.evaluateAndProcessEmail(email, options);
      if (processed) results.push(processed);
    }
    return results;
  }

  async sendTestNotification(dto: SendTestNotificationDto) {
    const config = await this.repository.getConfig();
    const recipient = dto.recipient?.trim() || config.recipientPhone;
    const testMessage =
      dto.message?.trim() ||
      '🔔 *Test Alert from Inbox Signal*\nWhatsApp notification engine is operational and ready.';

    const sendResult = await this.provider.sendNotification({
      recipient,
      subject: 'Test Notification',
      message: testMessage,
    });

    return this.repository.create({
      type: 'TEST',
      recipient,
      subject: 'Manual Test Notification',
      preview: testMessage,
      status: sendResult.success ? 'SENT' : 'FAILED',
      sentAt: sendResult.success ? sendResult.timestamp : null,
      errorDetails: sendResult.error
        ? sanitizeErrorDetails(sendResult.error)
        : null,
      provider: this.provider.name,
      metadata: {
        test: true,
        messageId: sendResult.messageId,
      },
    });
  }

  async retryNotification(id: string) {
    const notification = await this.repository.findById(id);
    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found.`);
    }

    if (notification.status !== 'FAILED') {
      throw new BadRequestException(
        `Only failed notifications can be retried (current status is ${notification.status}).`,
      );
    }

    if (notification.retryCount >= notification.maxRetries) {
      throw new BadRequestException(
        `Notification has reached the maximum retry limit of ${notification.maxRetries}.`,
      );
    }

    const nextRetry = notification.retryCount + 1;

    const sendResult = await this.provider.sendNotification({
      recipient: notification.recipient,
      subject: notification.subject,
      category: notification.category ?? undefined,
      message: notification.preview,
      emailId: notification.emailId ?? undefined,
      gmailMessageId: notification.gmailMessageId ?? undefined,
    });

    if (sendResult.success) {
      return this.repository.update(id, {
        status: 'SENT',
        sentAt: sendResult.timestamp,
        retryCount: nextRetry,
        errorDetails: null,
      });
    }

    return this.repository.update(id, {
      status: 'FAILED',
      retryCount: nextRetry,
      errorDetails: sanitizeErrorDetails(sendResult.error),
    });
  }

  async getHistory(query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { notifications, total } = await this.repository.findMany({
      page,
      limit,
      status: query.status,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notifications,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getConfig(): Promise<NotificationConfigData> {
    return { ...(await this.repository.getConfig()), deliveryProvider: this.provider.name };
  }

  async updateConfig(
    dto: UpdateNotificationConfigDto,
  ): Promise<NotificationConfigData> {
    return { ...(await this.repository.saveConfig(dto)), deliveryProvider: this.provider.name };
  }

  private findMatchingRule(
    email: Email,
    rules: NotificationRule[],
  ): NotificationRule | null {
    if (!rules || rules.length === 0) return null;

    const sorted = [...rules]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    const senderEmail = (email.senderEmail ?? '').toLowerCase();
    const senderDomain = senderEmail.includes('@')
      ? senderEmail.slice(senderEmail.lastIndexOf('@') + 1)
      : '';
    const subject = email.subject.toLowerCase();
    const snippet = (email.snippet ?? '').toLowerCase();
    const content = `${subject} ${snippet}`;

    for (const rule of sorted) {
      const { match } = rule;

      // Category match
      if (match.categories && match.categories.length > 0) {
        if (!match.categories.includes(email.category)) {
          continue;
        }
      }

      // Sender addresses match
      if (match.senderAddresses && match.senderAddresses.length > 0) {
        const matches = match.senderAddresses.some((addr) =>
          senderEmail === addr.toLowerCase() || senderEmail.includes(addr.toLowerCase()),
        );
        if (!matches) continue;
      }

      // Sender domain match
      if (match.senderDomains && match.senderDomains.length > 0) {
        const matches = match.senderDomains.some((dom) =>
          senderDomain === dom.toLowerCase() || senderDomain.endsWith(`.${dom.toLowerCase()}`),
        );
        if (!matches) continue;
      }

      // Keywords match
      if (match.keywords && match.keywords.length > 0) {
        const matches = match.keywords.some((kw) =>
          content.includes(kw.toLowerCase()),
        );
        if (!matches) continue;
      }

      return rule;
    }

    return null;
  }
}
