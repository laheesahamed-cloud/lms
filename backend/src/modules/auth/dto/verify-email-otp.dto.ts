import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your email' })
  code!: string;
}
