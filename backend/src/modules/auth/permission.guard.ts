import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';
import { Permission, roleHasPermission } from './role-permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const permissions = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || [];

    if (permissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
    const user = await this.authService.requireAuthenticatedUser(request.headers?.authorization);
    const missing = permissions.filter((permission) => !roleHasPermission(user.role, permission));

    if (missing.length) {
      throw new ForbiddenException('Your role does not have permission for this action');
    }

    return true;
  }
}
