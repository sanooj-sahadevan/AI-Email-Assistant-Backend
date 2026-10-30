import { Injectable } from '@nestjs/common';
import type {
  EmailCategory,
  Notification,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationConfigData,
  NotificationRule,
} from './notification-rule.interface.js';
import {
  NotificationFilterParams,
  NotificationRepository,
} from './notification.repository.js';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    params: NotificationFilterParams,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};
    if (params.status) {
      where.status = params.status;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  findByGmailMessageIdAndType(
    gmailMessageId: string,
    type: NotificationType,
  ): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where: {
        gmailMessageId_type: {
          gmailMessageId,
          type,
        },
      },
    });
  }

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async update(
    id: string,
    data: Prisma.NotificationUpdateInput,
  ): Promise<Notification | null> {
    try {
      return await this.prisma.notification.update({
        where: { id },
        data,
      });
    } catch {
      return null;
    }
  }

  async getConfig(): Promise<NotificationConfigData> {
    const record = await this.prisma.notificationConfig.findUnique({
      where: { id: 'primary' },
    });

    if (!record) {
      return DEFAULT_NOTIFICATION_CONFIG;
    }

    return {
      enabledCategories: record.enabledCategories as EmailCategory[],
      rules: (record.rules as unknown as NotificationRule[]) ?? DEFAULT_NOTIFICATION_CONFIG.rules,
      recipientPhone: record.recipientPhone,
      maxSnippetLength: record.maxSnippetLength,
      initialSyncCutoffHours: record.initialSyncCutoffHours,
    };
  }

  async saveConfig(
    data: Partial<NotificationConfigData>,
  ): Promise<NotificationConfigData> {
    const current = await this.getConfig();
    const updated: NotificationConfigData = {
      ...current,
      ...data,
      enabledCategories: data.enabledCategories ?? current.enabledCategories,
      rules: data.rules ?? current.rules,
      recipientPhone: data.recipientPhone ?? current.recipientPhone,
      maxSnippetLength: data.maxSnippetLength ?? current.maxSnippetLength,
      initialSyncCutoffHours:
        data.initialSyncCutoffHours ?? current.initialSyncCutoffHours,
    };

    await this.prisma.notificationConfig.upsert({
      where: { id: 'primary' },
      create: {
        id: 'primary',
        enabledCategories: updated.enabledCategories,
        rules: updated.rules as unknown as Prisma.InputJsonValue,
        recipientPhone: updated.recipientPhone,
        maxSnippetLength: updated.maxSnippetLength,
        initialSyncCutoffHours: updated.initialSyncCutoffHours,
      },
      update: {
        enabledCategories: updated.enabledCategories,
        rules: updated.rules as unknown as Prisma.InputJsonValue,
        recipientPhone: updated.recipientPhone,
        maxSnippetLength: updated.maxSnippetLength,
        initialSyncCutoffHours: updated.initialSyncCutoffHours,
      },
    });

    return updated;
  }
}
