import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  // The JWT identity token returned by native Sign in with Apple.
  @IsString()
  @MinLength(20)
  identityToken!: string;

  // Apple only sends the user's name on the FIRST authorization, so the client
  // forwards it here (optional). Used only when creating a brand-new account.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
