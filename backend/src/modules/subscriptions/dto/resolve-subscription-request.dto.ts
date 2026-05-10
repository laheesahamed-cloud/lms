import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveSubscriptionRequestDto {
  @IsString()
  @IsIn(['approved', 'rejected', 'cancelled'])
  status!: 'approved' | 'rejected' | 'cancelled';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  adminNote?: string;
}
