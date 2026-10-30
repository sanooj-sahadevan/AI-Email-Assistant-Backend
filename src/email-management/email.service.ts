import { Injectable, NotFoundException } from '@nestjs/common';
import type { Email, EmailCategory, Prisma } from '@prisma/client';
import { ClassificationService } from '../filtering/classification.service.js';
import { QueryEmailsDto } from './dto/query-emails.dto.js';
import { CategoryCounts, EmailRepository } from './email.repository.js';

export interface PaginatedEmailsResponse {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly emailRepository: EmailRepository,
    private readonly classificationService: ClassificationService,
  ) {}

  findById(id: string): Promise<Email | null> {
    return this.emailRepository.findById(id);
  }

  async getByIdOrThrow(id: string): Promise<Email> {
    const email = await this.emailRepository.findById(id);
    if (!email) {
      throw new NotFoundException(`Email with ID "${id}" was not found.`);
    }
    return email;
  }

  findRecent(limit: number, cursor?: string): Promise<Email[]> {
    return this.emailRepository.findRecent(limit, cursor);
  }

  async findFiltered(query: QueryEmailsDto): Promise<PaginatedEmailsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { emails, total } = await this.emailRepository.findFiltered({
      page,
      limit,
      category: query.category,
      search: query.search,
      isRead: query.isRead,
      sortOrder: query.sortOrder,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      emails,
      total,
      page,
      limit,
      totalPages,
    };
  }

  getCategoryCounts(): Promise<CategoryCounts> {
    return this.emailRepository.getCategoryCounts();
  }

  async updateCategory(
    id: string,
    category: EmailCategory,
    reason = 'Manually categorized by user',
  ): Promise<Email> {
    const email = await this.emailRepository.updateCategory(id, category, reason);
    if (!email) {
      throw new NotFoundException(`Email with ID "${id}" was not found.`);
    }
    return email;
  }

  async updateReadStatus(id: string, isRead: boolean): Promise<Email> {
    const email = await this.emailRepository.updateReadStatus(id, isRead);
    if (!email) {
      throw new NotFoundException(`Email with ID "${id}" was not found.`);
    }
    return email;
  }

  async reclassifyEmails(): Promise<{ updatedCount: number }> {
    const emails = await this.emailRepository.findAllForClassification();
    const updates = emails.map((email) => {
      const classification = this.classificationService.classify({
        senderEmail: email.senderEmail,
        senderName: email.senderName,
        subject: email.subject,
        snippet: email.snippet,
        body: email.body,
      });
      return {
        id: email.id,
        category: classification.category,
        classificationReason: classification.reason,
      };
    });

    const updatedCount =
      await this.emailRepository.updateManyClassification(updates);
    return { updatedCount };
  }

  saveSyncedEmails(emails: Prisma.EmailCreateManyInput[]): Promise<number> {
    return this.emailRepository.upsertMany(emails);
  }

  findByGmailMessageIds(ids: string[]): Promise<Email[]> {
    return this.emailRepository.findByGmailMessageIds(ids);
  }

  deleteAll(): Promise<number> {
    return this.emailRepository.deleteAll();
  }
}
