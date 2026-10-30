import { Injectable } from '@nestjs/common';
import type { GmailConnection } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import {
  GmailConnectionInput,
  GmailConnectionRepository,
} from './gmail-connection.repository.js';

@Injectable()
export class PrismaGmailConnectionRepository
  implements GmailConnectionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  get(): Promise<GmailConnection | null> {
    return this.prisma.gmailConnection.findUnique({
      where: { id: 'primary' },
    });
  }

  save(input: GmailConnectionInput): Promise<GmailConnection> {
    return this.prisma.gmailConnection.upsert({
      where: { id: 'primary' },
      create: { id: 'primary', ...input },
      update: input,
    });
  }

  async delete(): Promise<void> {
    await this.prisma.gmailConnection.deleteMany({
      where: { id: 'primary' },
    });
  }
}
