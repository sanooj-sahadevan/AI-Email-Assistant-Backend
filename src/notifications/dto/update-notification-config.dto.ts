import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { EmailCategory } from '@prisma/client';
import type { NotificationRule } from '../notification-rule.interface.js';

export class UpdateNotificationConfigDto {
  @IsOptional()
  @IsArray()
  @IsEnum(EmailCategory, { each: true })
  enabledCategories?: EmailCategory[];

  @IsOptional()
  @IsArray()
  rules?: NotificationRule[];

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'recipientPhone must be an international number in E.164 format (for example, +917994811405).',
  })
  recipientPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(500)
  maxSnippetLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  initialSyncCutoffHours?: number;
}
