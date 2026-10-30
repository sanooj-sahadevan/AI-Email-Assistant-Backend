import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { SendTestNotificationDto } from './dto/send-test-notification.dto.js';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getHistory(@Query() query: QueryNotificationsDto) {
    return this.notificationsService.getHistory(query);
  }

  @Get('config')
  getConfig() {
    return this.notificationsService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateNotificationConfigDto) {
    return this.notificationsService.updateConfig(dto);
  }

  @Post('test')
  sendTest(@Body() dto: SendTestNotificationDto) {
    return this.notificationsService.sendTestNotification(dto);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.notificationsService.retryNotification(id);
  }
}
