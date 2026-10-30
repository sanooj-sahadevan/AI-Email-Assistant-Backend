import { Module } from '@nestjs/common';
import { EmailManagementModule } from '../email-management/email-management.module.js';
import { FilteringModule } from '../filtering/filtering.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GmailConnectionRepository } from './gmail-connection.repository.js';
import { GmailController } from './gmail.controller.js';
import { GmailOAuthStateRepository } from './gmail-oauth-state.repository.js';
import { GmailService } from './gmail.service.js';
import { GoogleGmailProvider } from './google-gmail.provider.js';
import { PrismaGmailConnectionRepository } from './prisma-gmail-connection.repository.js';
import { PrismaGmailOAuthStateRepository } from './prisma-gmail-oauth-state.repository.js';
import { TokenEncryptionService } from './token-encryption.service.js';

@Module({
  imports: [EmailManagementModule, FilteringModule, NotificationsModule],
  controllers: [GmailController],
  providers: [
    GmailService,
    GoogleGmailProvider,
    TokenEncryptionService,
    PrismaGmailConnectionRepository,
    PrismaGmailOAuthStateRepository,
    {
      provide: GmailConnectionRepository,
      useExisting: PrismaGmailConnectionRepository,
    },
    {
      provide: GmailOAuthStateRepository,
      useExisting: PrismaGmailOAuthStateRepository,
    },
  ],
  exports: [GmailService],
})
export class GmailModule {}
