import type {
  Notification,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { NotificationConfigData } from './notification-rule.interface.js';

export interface NotificationFilterParams {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
}

export abstract class NotificationRepository {
  abstract findMany(
    params: NotificationFilterParams,
  ): Promise<{ notifications: Notification[]; total: number }>;
  abstract findById(id: string): Promise<Notification | null>;
  abstract findByGmailMessageIdAndType(
    gmailMessageId: string,
    type: NotificationType,
  ): Promise<Notification | null>;
  abstract create(data: Prisma.NotificationCreateInput): Promise<Notification>;
  abstract update(
    id: string,
    data: Prisma.NotificationUpdateInput,
  ): Promise<Notification | null>;
  abstract getConfig(): Promise<NotificationConfigData>;
  abstract saveConfig(
    data: Partial<NotificationConfigData>,
  ): Promise<NotificationConfigData>;
}
