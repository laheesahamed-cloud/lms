import { UserRole } from '../../auth/role-permissions';
export declare class UpdateUserDto {
    fullName?: string;
    email?: string;
    password?: string;
    role?: UserRole;
}
