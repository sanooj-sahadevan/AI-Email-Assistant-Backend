import { Injectable } from '@nestjs/common';
import type { Email, EmailCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import {
  CategoryCounts,
  EmailFilterParams,
  EmailRepository,
} from './email.repository.js';

@Injectable()
export class PrismaEmailRepository implements EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Email | null> {
    return this.prisma.email.findUnique({ where: { id } });
  }

  findRecent(limit: number, cursor?: string): Promise<Email[]> {
    return this.prisma.email.findMany({
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findFiltered(
    params: EmailFilterParams,
  ): Promise<{ emails: Email[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {};

    if (params.category) {
      where.category = params.category;
    }

    if (typeof params.isRead === 'boolean') {
      where.isRead = params.isRead;
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim();
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        { senderEmail: { contains: term, mode: 'insensitive' } },
        { senderName: { contains: term, mode: 'insensitive' } },
        { snippet: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortOrder = params.sortOrder ?? 'desc';

    const [emails, total] = await Promise.all([
      this.prisma.email.findMany({
        where,
        take: limit,
        skip,
        orderBy: [{ receivedAt: sortOrder }, { id: 'desc' }],
      }),
      this.prisma.email.count({ where }),
    ]);

    return { emails, total };
  }

  async getCategoryCounts(): Promise<CategoryCounts> {
    const byCategory: Record<EmailCategory, number> = {
      LINKEDIN_NOTIFICATION: 0,
      JOB_OPPORTUNITY: 0,
      RECRUITER: 0,
      COMPANY: 0,
      PERSONAL: 0,
      OTHER: 0,
    };

    const [grouped, total, unreadTotal] = await Promise.all([
      this.prisma.email.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
      this.prisma.email.count(),
      this.prisma.email.count({ where: { isRead: false } }),
    ]);

    for (const group of grouped) {
      if (group.category in byCategory) {
        byCategory[group.category] = group._count.id;
      }
    }

    return { total, unreadTotal, byCategory };
  }

  async updateCategory(
    id: string,
    category: EmailCategory,
    reason?: string,
  ): Promise<Email | null> {
    try {
      return await this.prisma.email.update({
        where: { id },
        data: {
          category,
          categorySource: 'MANUAL',
          classificationReason: reason ?? 'Manually categorized by user',
        },
      });
    } catch {
      return null;
    }
  }

  async updateReadStatus(id: string, isRead: boolean): Promise<Email | null> {
    try {
      return await this.prisma.email.update({
        where: { id },
        data: { isRead },
      });
    } catch {
      return null;
    }
  }

  async upsertMany(emails: Prisma.EmailCreateManyInput[]): Promise<number> {
    if (emails.length === 0) {
      return 0;
    }

    const result = await this.prisma.email.createMany({
      data: emails,
      skipDuplicates: true,
    });
    return result.count;
  }

  findAllForClassification(): Promise<Email[]> {
    return this.prisma.email.findMany({
      where: { categorySource: { not: 'MANUAL' } },
    });
  }

  findByGmailMessageIds(ids: string[]): Promise<Email[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.email.findMany({
      where: { gmailMessageId: { in: ids } },
    });
  }

  async updateManyClassification(
    updates: { id: string; category: EmailCategory; classificationReason: string }[],
  ): Promise<number> {
    if (updates.length === 0) return 0;

    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.email.update({
          where: { id: update.id },
          data: {
            category: update.category,
          categorySource: 'RULE',
            classificationReason: update.classificationReason,
          },
        }),
      ),
    );

    return updates.length;
  }

  async deleteAll(): Promise<number> {
    const result = await this.prisma.email.deleteMany();
    return result.count;
  }
}
