import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AI_PROVIDER_KEYS } from '../../../common/utils/ai-provider.utils';

export class CreateAiProviderDto {
  @IsString()
  @IsIn(AI_PROVIDER_KEYS)
  providerKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  runCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  apiCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
