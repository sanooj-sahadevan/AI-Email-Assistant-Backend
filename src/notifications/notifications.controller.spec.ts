import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification } from '@prisma/client';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockService: Partial<Record<keyof NotificationsService, any>>;

  const sampleNotif: Notification = {
    id: 'notif-123',
    emailId: 'email-1',
    gmailMessageId: 'gmail-1',
    type: 'WHATSAPP_ALERT',
    recipient: '+15551234567',
    sender: 'recruiter@hays.com',
    subject: 'New Job Offer',
    category: 'JOB_OPPORTUNITY',
    preview: '🔔 *Important Email Alert*\n*Subject:* New Job Offer',
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

  beforeEach(() => {
    mockService = {
      getHistory: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      sendTestNotification: vi.fn(),
      retryNotification: vi.fn(),
    };

    controller = new NotificationsController(
      mockService as unknown as NotificationsService,
    );
  });

  it('retrieves notification history', async () => {
    const history = {
      notifications: [sampleNotif],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockService.getHistory.mockResolvedValue(history);

    const result = await controller.getHistory({ page: 1, limit: 20 });
    expect(result).toEqual(history);
    expect(mockService.getHistory).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('retrieves notification configuration', async () => {
    const config = {
      enabledCategories: ['JOB_OPPORTUNITY'],
      rules: [],
      recipientPhone: '+15551234567',
      maxSnippetLength: 150,
      initialSyncCutoffHours: 24,
    };
    mockService.getConfig.mockResolvedValue(config);

    const result = await controller.getConfig();
    expect(result).toEqual(config);
    expect(mockService.getConfig).toHaveBeenCalled();
  });

  it('updates notification configuration', async () => {
    const updateDto = { recipientPhone: '+15559998888' };
    mockService.updateConfig.mockResolvedValue(updateDto);

    const result = await controller.updateConfig(updateDto);
    expect(result).toEqual(updateDto);
    expect(mockService.updateConfig).toHaveBeenCalledWith(updateDto);
  });

  it('triggers manual test notification', async () => {
    mockService.sendTestNotification.mockResolvedValue(sampleNotif);

    const result = await controller.sendTest({ message: 'Test ping' });
    expect(result).toEqual(sampleNotif);
    expect(mockService.sendTestNotification).toHaveBeenCalledWith({
      message: 'Test ping',
    });
  });

  it('retries a failed notification', async () => {
    const retried = { ...sampleNotif, status: 'SENT' as const, retryCount: 1 };
    mockService.retryNotification.mockResolvedValue(retried);

    const result = await controller.retry('notif-123');
    expect(result).toEqual(retried);
    expect(mockService.retryNotification).toHaveBeenCalledWith('notif-123');
  });
});
