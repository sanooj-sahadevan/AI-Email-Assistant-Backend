import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/app-session.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ListEmailsDto } from './dto/list-emails.dto.js';
import { SyncEmailsDto } from './dto/sync-emails.dto.js';
import { GmailService } from './gmail.service.js';

@Controller('gmail')
@UseGuards(SessionGuard)
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly config: ConfigService,
  ) {}

  @Get('connect')
  async connect(@Req() request: AuthenticatedRequest) {
    const authorizationUrl = await this.gmailService.createAuthorizationUrl(
      request.appSession!.sessionId,
    );
    return { authorizationUrl };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const returnToDashboard = (result: 'connected' | 'error') => {
      response.redirect(
        `${frontendUrl.replace(/\/+$/, '')}/?gmail=${result}`,
      );
    };

    if (oauthError) {
      returnToDashboard('error');
      return;
    }
    if (!code || !state) {
      throw new BadRequestException('Google callback is missing code or state.');
    }

    await this.gmailService.completeAuthorization(
      code,
      state,
      request.appSession!.sessionId,
    );
    returnToDashboard('connected');
  }

  @Get('status')
  getStatus() {
    return this.gmailService.getStatus();
  }

  @Get('emails')
  listEmails(@Query() query: ListEmailsDto) {
    return this.gmailService.listEmails(query.limit, query.cursor);
  }

  @Post('sync')
  sync(@Body() query: SyncEmailsDto) {
    return this.gmailService.sync(query.limit, query.pageToken);
  }

  @Delete('disconnect')
  disconnect() {
    return this.gmailService.disconnect();
  }
}
