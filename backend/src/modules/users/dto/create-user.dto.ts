import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { USER_ROLES, UserRole } from '../../auth/role-permissions';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include uppercase, lowercase, and number characters',
  })
  password!: string;

  @IsString()
  @IsIn(USER_ROLES)
  role!: UserRole;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
