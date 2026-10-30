import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service.js';
import { RuleRegistryService } from './rule-registry.service.js';

@Module({
  providers: [RuleRegistryService, ClassificationService],
  exports: [RuleRegistryService, ClassificationService],
})
export class FilteringModule {}
