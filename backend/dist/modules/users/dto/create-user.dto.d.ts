import { UserRole } from '../../auth/role-permissions';
export declare class CreateUserDto {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    status?: 'active' | 'inactive';
}
