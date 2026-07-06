import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '../../auth/role-permissions';

export class UpdateUserAccessDto {
  @IsString()
  @IsIn(['admin', 'staff'])
  role!: 'admin' | 'staff';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions?: string[];
}
