import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLandingPageSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  heroKicker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  heroTitleLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  heroTitleAccent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  heroTitleLine3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  heroPrimaryLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  heroSecondaryLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  featuresEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  featuresTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  featuresText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  howEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  howTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  howText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  whyEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  whyTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  whyText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  testimonialsEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  testimonialsTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  testimonialsText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  faqEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  faqTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  faqText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  pricingEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pricingTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  pricingText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  customPlanTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  customPlanText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(130)
  ctaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaPrimaryLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaSecondaryLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  footerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  footerTagline?: string;
}
