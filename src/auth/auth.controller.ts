import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './app-session.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SessionGuard } from './session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    this.authService.login(body.passphrase, response);
    return { authenticated: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    this.authService.logout(response);
  }

  @Get('session')
  @UseGuards(SessionGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    return {
      authenticated: true,
      expiresAt: new Date(request.appSession!.expiresAt).toISOString(),
    };
  }
}
