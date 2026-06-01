"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
const permissions_decorator_1 = require("./permissions.decorator");
const role_permissions_1 = require("./role-permissions");
let PermissionGuard = class PermissionGuard {
    constructor(authService, reflector) {
        this.authService = authService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const permissions = this.reflector.getAllAndOverride(permissions_decorator_1.REQUIRED_PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) || [];
        if (permissions.length === 0)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = await this.authService.requireAuthenticatedUser(request.headers?.authorization);
        if ((0, role_permissions_1.isStaffRole)(user.role) && user.status !== 'active') {
            throw new common_1.UnauthorizedException('Admin access is required');
        }
        const missing = permissions.filter((permission) => !(0, role_permissions_1.roleHasPermission)(user.role, permission));
        if (missing.length) {
            throw new common_1.ForbiddenException('Your role does not have permission for this action');
        }
        return true;
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        core_1.Reflector])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map