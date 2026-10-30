import { Module } from '@nestjs/common';
import { EmailManagementModule } from '../email-management/email-management.module.js';
import { FilteringModule } from '../filtering/filtering.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { OllamaProvider } from './ollama.provider.js';

@Module({
  imports: [EmailManagementModule, FilteringModule],
  controllers: [AiController],
  providers: [AiService, OllamaProvider],
})
export class AiModule {}
