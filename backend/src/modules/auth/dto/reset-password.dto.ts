import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'New password must include uppercase, lowercase, and number characters',
  })
  newPassword!: string;

  @IsString()
  @MinLength(10)
  confirmPassword!: string;
}
