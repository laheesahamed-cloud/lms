import { IsEmail } from 'class-validator';

export class TestSmtpSettingsDto {
  @IsEmail()
  toEmail!: string;
}
