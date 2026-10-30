import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Email } from '@prisma/client';
import { EmailController } from './email.controller.js';
import { EmailService } from './email.service.js';

describe('EmailController', () => {
  let controller: EmailController;
  let mockEmailService: Partial<Record<keyof EmailService, any>>;

  const sampleEmail: Email = {
    id: 'email-1',
    gmailMessageId: 'msg-1',
    threadId: 'th-1',
    senderEmail: 'test@recruiter.com',
    senderName: 'Test Recruiter',
    subject: 'Opportunity',
    snippet: 'Hey there',
    body: 'Details here',
    receivedAt: new Date(),
    isRead: false,
    category: 'RECRUITER',
    categorySource: 'RULE',
    classificationReason: 'Recruiter domain matched',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockEmailService = {
      findFiltered: vi.fn(),
      getCategoryCounts: vi.fn(),
      getByIdOrThrow: vi.fn(),
      updateCategory: vi.fn(),
      updateReadStatus: vi.fn(),
      reclassifyEmails: vi.fn(),
    };

    controller = new EmailController(mockEmailService as unknown as EmailService);
  });

  it('lists emails via findFiltered', async () => {
    const paginated = {
      emails: [sampleEmail],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockEmailService.findFiltered.mockResolvedValue(paginated);

    const result = await controller.listEmails({ page: 1, limit: 20, sortOrder: 'desc' });
    expect(result).toEqual(paginated);
    expect(mockEmailService.findFiltered).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      sortOrder: 'desc',
    });
  });

  it('gets category counts', async () => {
    const counts = {
      total: 1,
      unreadTotal: 1,
      byCategory: {
        LINKEDIN_NOTIFICATION: 0,
        JOB_OPPORTUNITY: 0,
        RECRUITER: 1,
        COMPANY: 0,
        PERSONAL: 0,
        OTHER: 0,
      },
    };
    mockEmailService.getCategoryCounts.mockResolvedValue(counts);

    const result = await controller.getCategoryCounts();
    expect(result).toEqual(counts);
    expect(mockEmailService.getCategoryCounts).toHaveBeenCalled();
  });

  it('retrieves an email by ID', async () => {
    mockEmailService.getByIdOrThrow.mockResolvedValue(sampleEmail);
    const result = await controller.getEmailById('email-1');
    expect(result).toEqual(sampleEmail);
    expect(mockEmailService.getByIdOrThrow).toHaveBeenCalledWith('email-1');
  });

  it('updates email category', async () => {
    const updated = { ...sampleEmail, category: 'COMPANY' as const };
    mockEmailService.updateCategory.mockResolvedValue(updated);

    const result = await controller.updateCategory('email-1', { category: 'COMPANY' });
    expect(result).toEqual(updated);
    expect(mockEmailService.updateCategory).toHaveBeenCalledWith('email-1', 'COMPANY');
  });

  it('updates email read status', async () => {
    const updated = { ...sampleEmail, isRead: true };
    mockEmailService.updateReadStatus.mockResolvedValue(updated);

    const result = await controller.updateReadStatus('email-1', { isRead: true });
    expect(result).toEqual(updated);
    expect(mockEmailService.updateReadStatus).toHaveBeenCalledWith('email-1', true);
  });

  it('triggers reclassification', async () => {
    mockEmailService.reclassifyEmails.mockResolvedValue({ updatedCount: 5 });
    const result = await controller.reclassify();
    expect(result).toEqual({ updatedCount: 5 });
    expect(mockEmailService.reclassifyEmails).toHaveBeenCalled();
  });
});
