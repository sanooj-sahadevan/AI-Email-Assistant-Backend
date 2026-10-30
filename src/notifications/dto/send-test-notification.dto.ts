import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestNotificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  recipient?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}
