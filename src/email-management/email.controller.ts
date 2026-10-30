import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { QueryEmailsDto } from './dto/query-emails.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateReadStatusDto } from './dto/update-read-status.dto.js';
import { EmailService } from './email.service.js';

@Controller('emails')
@UseGuards(SessionGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  listEmails(@Query() query: QueryEmailsDto) {
    return this.emailService.findFiltered(query);
  }

  @Get('counts')
  getCategoryCounts() {
    return this.emailService.getCategoryCounts();
  }

  @Get(':id')
  getEmailById(@Param('id') id: string) {
    return this.emailService.getByIdOrThrow(id);
  }

  @Patch(':id/category')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.emailService.updateCategory(id, dto.category);
  }

  @Patch(':id/read')
  updateReadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReadStatusDto,
  ) {
    return this.emailService.updateReadStatus(id, dto.isRead);
  }

  @Post('reclassify')
  reclassify() {
    return this.emailService.reclassifyEmails();
  }
}
