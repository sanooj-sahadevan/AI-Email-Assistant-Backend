import type { Email, EmailCategory, Prisma } from '@prisma/client';

export interface EmailFilterParams {
  page?: number;
  limit?: number;
  category?: EmailCategory;
  search?: string;
  isRead?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryCounts {
  total: number;
  unreadTotal: number;
  byCategory: Record<EmailCategory, number>;
}

export abstract class EmailRepository {
  abstract findById(id: string): Promise<Email | null>;
  abstract findRecent(limit: number, cursor?: string): Promise<Email[]>;
  abstract findFiltered(
    params: EmailFilterParams,
  ): Promise<{ emails: Email[]; total: number }>;
  abstract getCategoryCounts(): Promise<CategoryCounts>;
  abstract updateCategory(
    id: string,
    category: EmailCategory,
    reason?: string,
  ): Promise<Email | null>;
  abstract updateReadStatus(id: string, isRead: boolean): Promise<Email | null>;
  abstract upsertMany(emails: Prisma.EmailCreateManyInput[]): Promise<number>;
  abstract findAllForClassification(): Promise<Email[]>;
  abstract findByGmailMessageIds(ids: string[]): Promise<Email[]>;
  abstract updateManyClassification(
    updates: { id: string; category: EmailCategory; classificationReason: string }[],
  ): Promise<number>;
  abstract deleteAll(): Promise<number>;
}
