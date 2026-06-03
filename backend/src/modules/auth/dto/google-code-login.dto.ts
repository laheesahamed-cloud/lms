import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleCodeLoginDto {
  @IsString()
  @MinLength(10)
  code!: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;
}
