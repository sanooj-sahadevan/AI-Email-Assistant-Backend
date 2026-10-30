import { IsEnum } from 'class-validator';
import { EmailCategory } from '@prisma/client';

export class UpdateCategoryDto {
  @IsEnum(EmailCategory)
  category!: EmailCategory;
}
