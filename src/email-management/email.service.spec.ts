import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Email } from '@prisma/client';
import { EmailService } from './email.service.js';
import { EmailRepository } from './email.repository.js';
import { ClassificationService } from '../filtering/classification.service.js';

describe('EmailService', () => {
  let service: EmailService;
  let mockRepository: Partial<Record<keyof EmailRepository, any>>;
  let mockClassificationService: Partial<Record<keyof ClassificationService, any>>;

  const dummyEmail: Email = {
    id: 'email-1',
    gmailMessageId: 'gmail-1',
    threadId: 'thread-1',
    senderEmail: 'alice@company.com',
    senderName: 'Alice',
    subject: 'Q3 All-Hands Meeting',
    snippet: 'Discussion of goals',
    body: 'Discussion of goals and planning',
    receivedAt: new Date('2026-10-18T10:00:00Z'),
    isRead: false,
    category: 'COMPANY',
    categorySource: 'RULE',
    classificationReason: 'Matched company communication',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findFiltered: vi.fn(),
      getCategoryCounts: vi.fn(),
      updateCategory: vi.fn(),
      updateReadStatus: vi.fn(),
      findAllForClassification: vi.fn(),
      updateManyClassification: vi.fn(),
      upsertMany: vi.fn(),
      deleteAll: vi.fn(),
    };

    mockClassificationService = {
      classify: vi.fn(),
    };

    service = new EmailService(
      mockRepository as unknown as EmailRepository,
      mockClassificationService as unknown as ClassificationService,
    );
  });

  describe('getByIdOrThrow', () => {
    it('returns email when found', async () => {
      mockRepository.findById.mockResolvedValue(dummyEmail);
      const email = await service.getByIdOrThrow('email-1');
      expect(email).toEqual(dummyEmail);
      expect(mockRepository.findById).toHaveBeenCalledWith('email-1');
    });

    it('throws NotFoundException when email is not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.getByIdOrThrow('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findFiltered', () => {
    it('delegates query parameters to repository and computes totalPages', async () => {
      mockRepository.findFiltered.mockResolvedValue({
        emails: [dummyEmail],
        total: 45,
      });

      const result = await service.findFiltered({
        page: 2,
        limit: 20,
        category: 'COMPANY',
        search: 'All-Hands',
        isRead: false,
        sortOrder: 'desc',
      });

      expect(result).toEqual({
        emails: [dummyEmail],
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
      expect(mockRepository.findFiltered).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        category: 'COMPANY',
        search: 'All-Hands',
        isRead: false,
        sortOrder: 'desc',
      });
    });
  });

  describe('getCategoryCounts', () => {
    it('returns category counts from repository', async () => {
      const counts = {
        total: 10,
        unreadTotal: 4,
        byCategory: {
          LINKEDIN_NOTIFICATION: 2,
          JOB_OPPORTUNITY: 3,
          RECRUITER: 1,
          COMPANY: 2,
          PERSONAL: 1,
          OTHER: 1,
        },
      };
      mockRepository.getCategoryCounts.mockResolvedValue(counts);

      const result = await service.getCategoryCounts();
      expect(result).toEqual(counts);
    });
  });

  describe('updateCategory', () => {
    it('updates email category manually with reason', async () => {
      const updated = {
        ...dummyEmail,
        category: 'JOB_OPPORTUNITY' as const,
        classificationReason: 'Manually categorized by user',
      };
      mockRepository.updateCategory.mockResolvedValue(updated);

      const result = await service.updateCategory('email-1', 'JOB_OPPORTUNITY');
      expect(result.category).toBe('JOB_OPPORTUNITY');
      expect(mockRepository.updateCategory).toHaveBeenCalledWith(
        'email-1',
        'JOB_OPPORTUNITY',
        'Manually categorized by user',
      );
    });

    it('throws NotFoundException if updating non-existent email', async () => {
      mockRepository.updateCategory.mockResolvedValue(null);
      await expect(
        service.updateCategory('unknown', 'OTHER'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReadStatus', () => {
    it('updates read status of an email', async () => {
      const readEmail = { ...dummyEmail, isRead: true };
      mockRepository.updateReadStatus.mockResolvedValue(readEmail);

      const result = await service.updateReadStatus('email-1', true);
      expect(result.isRead).toBe(true);
      expect(mockRepository.updateReadStatus).toHaveBeenCalledWith('email-1', true);
    });

    it('throws NotFoundException if email does not exist', async () => {
      mockRepository.updateReadStatus.mockResolvedValue(null);
      await expect(service.updateReadStatus('unknown', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reclassifyEmails', () => {
    it('reclassifies all stored emails using current rules', async () => {
      mockRepository.findAllForClassification.mockResolvedValue([dummyEmail]);
      mockClassificationService.classify.mockReturnValue({
        category: 'JOB_OPPORTUNITY',
        reason: 'Updated rule matched',
      });
      mockRepository.updateManyClassification.mockResolvedValue(1);

      const result = await service.reclassifyEmails();
      expect(result).toEqual({ updatedCount: 1 });
      expect(mockClassificationService.classify).toHaveBeenCalledWith({
        senderEmail: dummyEmail.senderEmail,
        senderName: dummyEmail.senderName,
        subject: dummyEmail.subject,
        snippet: dummyEmail.snippet,
        body: dummyEmail.body,
      });
      expect(mockRepository.updateManyClassification).toHaveBeenCalledWith([
        {
          id: dummyEmail.id,
          category: 'JOB_OPPORTUNITY',
          classificationReason: 'Updated rule matched',
        },
      ]);
    });
  });
});
