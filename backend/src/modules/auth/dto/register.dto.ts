import { IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  // 2026-11-17: the university's country (picked from a list) and its name (typed), required.
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  universityCountry!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  university!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include uppercase, lowercase, and number characters',
  })
  password!: string;

  @IsString()
  @MinLength(10)
  confirmPassword!: string;

  @IsBoolean()
  acceptedTerms!: boolean;
}
