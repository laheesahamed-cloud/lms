import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;

  // Sent by the onboarding screen (required there); Profile edits leave them out.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  universityCountry?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  university?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;
}
