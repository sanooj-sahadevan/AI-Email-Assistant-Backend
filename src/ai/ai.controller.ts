import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { AiService } from './ai.service.js';

@Controller('ai/emails')
@UseGuards(SessionGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post(':id/category-suggestion')
  suggestCategory(@Param('id') id: string) {
    return this.ai.suggestCategory(id);
  }

  @Post(':id/summary')
  summarize(@Param('id') id: string) {
    return this.ai.summarizeEmail(id);
  }
}
