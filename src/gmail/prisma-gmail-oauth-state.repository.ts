import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GmailOAuthStateRepository } from './gmail-oauth-state.repository.js';

@Injectable()
export class PrismaGmailOAuthStateRepository
  implements GmailOAuthStateRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    stateHash: string,
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.gmailOAuthState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
      this.prisma.gmailOAuthState.create({
        data: { stateHash, sessionId, expiresAt },
      }),
    ]);
  }

  async consume(stateHash: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.gmailOAuthState.deleteMany({
      where: {
        stateHash,
        sessionId,
        expiresAt: { gt: new Date() },
      },
    });
    return result.count === 1;
  }
}
