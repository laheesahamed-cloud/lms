import { Permission } from './role-permissions';
export declare const REQUIRED_PERMISSIONS_KEY = "required_permissions";
export declare const RequirePermissions: (...permissions: Permission[]) => import("@nestjs/common").CustomDecorator<string>;
