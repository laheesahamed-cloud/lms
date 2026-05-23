import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { USER_ROLES, UserRole } from '../../auth/role-permissions';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include uppercase, lowercase, and number characters',
  })
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
