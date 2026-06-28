import { IsString, IsOptional } from 'class-validator';

export class CreateDrugDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() drug_class?: string;
  @IsOptional() @IsString() uses?: string;
  @IsOptional() @IsString() dosage_adult?: string;
  @IsOptional() @IsString() dosage_pediatric?: string;
  @IsOptional() @IsString() side_effects?: string;
  @IsOptional() @IsString() warnings?: string;
  @IsOptional() @IsString() drug_interactions?: string;
  @IsOptional() @IsString() pregnancy_info?: string;
  @IsOptional() @IsString() sl_brand_names?: string;
}
