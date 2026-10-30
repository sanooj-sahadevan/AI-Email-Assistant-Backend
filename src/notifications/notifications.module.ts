import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationRepository } from './notification.repository.js';
import { PrismaNotificationRepository } from './prisma-notification.repository.js';
import { NotificationProvider } from './providers/notification-provider.interface.js';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider.js';
import { WhatsAppCloudApiProvider } from './providers/whatsapp-cloud-api.provider.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PrismaNotificationRepository,
    {
      provide: NotificationRepository,
      useExisting: PrismaNotificationRepository,
    },
    MockWhatsAppProvider,
    WhatsAppCloudApiProvider,
    {
      provide: NotificationProvider,
      useFactory: (
        config: ConfigService,
        mockProvider: MockWhatsAppProvider,
        cloudProvider: WhatsAppCloudApiProvider,
      ) => {
        const provider = config.get<string>('WHATSAPP_PROVIDER') ?? 'mock';
        return provider === 'cloud_api' ? cloudProvider : mockProvider;
      },
      inject: [ConfigService, MockWhatsAppProvider, WhatsAppCloudApiProvider],
    },
  ],
  exports: [NotificationsService, NotificationProvider],
})
export class NotificationsModule {}
