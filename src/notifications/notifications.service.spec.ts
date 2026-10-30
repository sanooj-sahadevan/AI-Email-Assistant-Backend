import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Email, Notification } from '@prisma/client';
import { NotificationsService } from './notifications.service.js';
import { NotificationRepository } from './notification.repository.js';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider.js';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationConfigData,
} from './notification-rule.interface.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockRepo: Partial<Record<keyof NotificationRepository, any>>;
  let mockProvider: MockWhatsAppProvider;

  const sampleRecentEmail: Email = {
    id: 'email-123',
    gmailMessageId: 'gmail-msg-123',
    threadId: 'th-1',
    senderEmail: 'recruiter@techjobs.io',
    senderName: 'Sarah Jenkins',
    subject: 'Interview Invitation: Principal Engineer',
    snippet: 'We would love to invite you to discuss the role next week.',
    body: 'Confidential full body details',
    receivedAt: new Date(), // recent (age < 1 hour)
    isRead: false,
    category: 'JOB_OPPORTUNITY',
    categorySource: 'RULE',
    classificationReason: 'Job interview keyword matched',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const currentConfig: NotificationConfigData = {
    ...DEFAULT_NOTIFICATION_CONFIG,
    enabledCategories: ['JOB_OPPORTUNITY', 'RECRUITER'],
    recipientPhone: '+15559876543',
    initialSyncCutoffHours: 24,
  };

  beforeEach(() => {
    mockProvider = new MockWhatsAppProvider();

    mockRepo = {
      getConfig: vi.fn().mockResolvedValue(currentConfig),
      saveConfig: vi.fn(),
      findByGmailMessageIdAndType: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => ({
        id: 'notif-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        ...data,
      })),
      findById: vi.fn(),
      update: vi.fn().mockImplementation((id, data) => ({
        id,
        ...data,
      })),
      findMany: vi.fn(),
    };

    service = new NotificationsService(
      mockRepo as unknown as NotificationRepository,
      mockProvider,
    );
  });

  describe('category and rule filtering', () => {
    it('dispatches notification for enabled category (JOB_OPPORTUNITY)', async () => {
      const result = await service.evaluateAndProcessEmail(sampleRecentEmail);

      expect(result).toBeDefined();
      expect(result?.status).toBe('SENT');
      expect(result?.recipient).toBe('+15559876543');
      expect(result?.preview).toContain('Important Email Alert');
      expect(result?.preview).toContain('Job Opportunities');
      expect(result?.preview).not.toContain('Confidential full body details');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('skips notifications for disabled category', async () => {
      const personalEmail: Email = {
        ...sampleRecentEmail,
        id: 'email-personal',
        gmailMessageId: 'gmail-personal-1',
        category: 'PERSONAL',
      };

      const result = await service.evaluateAndProcessEmail(personalEmail);

      expect(result?.status).toBe('SKIPPED');
      expect(result?.errorDetails).toContain('Notifications disabled for category: PERSONAL');
    });

    it('skips notification when rule action is IGNORE', async () => {
      const configWithIgnore: NotificationConfigData = {
        ...currentConfig,
        rules: [
          {
            id: 'rule-ignore-spammer',
            name: 'Ignore specific recruiter',
            enabled: true,
            priority: 1,
            match: {
              senderAddresses: ['recruiter@techjobs.io'],
            },
            action: 'IGNORE',
          },
        ],
      };
      mockRepo.getConfig.mockResolvedValue(configWithIgnore);

      const result = await service.evaluateAndProcessEmail(sampleRecentEmail);
      expect(result?.status).toBe('SKIPPED');
      expect(result?.errorDetails).toContain('Ignored by notification rule');
    });
  });

  describe('duplicate prevention', () => {
    it('prevents duplicate notification for same Gmail message ID and type', async () => {
      const existingNotif: Notification = {
        id: 'existing-notif',
        emailId: sampleRecentEmail.id,
        gmailMessageId: sampleRecentEmail.gmailMessageId,
        type: 'WHATSAPP_ALERT',
        recipient: '+15559876543',
        sender: sampleRecentEmail.senderEmail,
        subject: sampleRecentEmail.subject,
        category: sampleRecentEmail.category,
        preview: 'Alert preview',
        status: 'SENT',
        retryCount: 0,
        maxRetries: 3,
        errorDetails: null,
        provider: 'mock_whatsapp',
        metadata: null,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findByGmailMessageIdAndType.mockResolvedValue(existingNotif);

      const providerSpy = vi.spyOn(mockProvider, 'sendNotification');
      const result = await service.evaluateAndProcessEmail(sampleRecentEmail);

      expect(result).toBe(existingNotif);
      expect(providerSpy).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('historical emails & initial sync cutoff', () => {
    it('skips emails older than cutoff hours', async () => {
      const oldEmail: Email = {
        ...sampleRecentEmail,
        id: 'email-old',
        gmailMessageId: 'gmail-old-1',
        receivedAt: new Date(Date.now() - 48 * 3600 * 1000), // 48 hours old (cutoff is 24h)
      };

      const result = await service.evaluateAndProcessEmail(oldEmail);
      expect(result?.status).toBe('SKIPPED');
      expect(result?.errorDetails).toContain('Skipped historical email');
    });

    it('skips emails when isInitialSync flag is set', async () => {
      const result = await service.evaluateAndProcessEmail(sampleRecentEmail, {
        isInitialSync: true,
      });
      expect(result?.status).toBe('SKIPPED');
      expect(result?.errorDetails).toContain('initial bulk sync');
    });
  });

  describe('failed notifications and retry behavior', () => {
    it('records failed status and sanitized error details when provider fails', async () => {
      mockProvider.setSimulateFailure(true);

      const result = await service.evaluateAndProcessEmail(sampleRecentEmail);
      expect(result?.status).toBe('FAILED');
      expect(result?.errorDetails).toContain('Simulated upstream gateway timeout');
    });

    it('retries a failed notification and updates status to SENT upon success', async () => {
      const failedNotif: Notification = {
        id: 'notif-failed-1',
        emailId: sampleRecentEmail.id,
        gmailMessageId: sampleRecentEmail.gmailMessageId,
        type: 'WHATSAPP_ALERT',
        recipient: '+15559876543',
        sender: sampleRecentEmail.senderEmail,
        subject: sampleRecentEmail.subject,
        category: sampleRecentEmail.category,
        preview: 'Concise alert message',
        status: 'FAILED',
        retryCount: 0,
        maxRetries: 3,
        errorDetails: 'Timeout error',
        provider: 'mock_whatsapp',
        metadata: null,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findById.mockResolvedValue(failedNotif);

      const result = await service.retryNotification('notif-failed-1');
      expect(result?.status).toBe('SENT');
      expect(result?.retryCount).toBe(1);
      expect(mockRepo.update).toHaveBeenCalledWith('notif-failed-1', expect.objectContaining({
        status: 'SENT',
        retryCount: 1,
      }));
    });

    it('rejects retrying an already SENT notification', async () => {
      const sentNotif = {
        id: 'notif-sent-1',
        status: 'SENT',
        retryCount: 0,
        maxRetries: 3,
      };
      mockRepo.findById.mockResolvedValue(sentNotif);

      await expect(service.retryNotification('notif-sent-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects retrying when max retries exceeded', async () => {
      const maxRetried = {
        id: 'notif-maxed',
        status: 'FAILED',
        retryCount: 3,
        maxRetries: 3,
      };
      mockRepo.findById.mockResolvedValue(maxRetried);

      await expect(service.retryNotification('notif-maxed')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if retried notification does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.retryNotification('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('test notification', () => {
    it('dispatches a manual test notification', async () => {
      const result = await service.sendTestNotification({
        recipient: '+15550001111',
        message: 'Hello test alert',
      });

      expect(result.type).toBe('TEST');
      expect(result.recipient).toBe('+15550001111');
      expect(result.status).toBe('SENT');
      expect(result.preview).toBe('Hello test alert');
    });
  });
});
