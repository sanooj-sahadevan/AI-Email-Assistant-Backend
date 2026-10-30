import { Module } from '@nestjs/common';
import { FilteringModule } from '../filtering/filtering.module.js';
import { EmailController } from './email.controller.js';
import { EmailRepository } from './email.repository.js';
import { EmailService } from './email.service.js';
import { PrismaEmailRepository } from './prisma-email.repository.js';

@Module({
  imports: [FilteringModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    PrismaEmailRepository,
    {
      provide: EmailRepository,
      useExisting: PrismaEmailRepository,
    },
  ],
  exports: [EmailService, EmailRepository],
})
export class EmailManagementModule {}
