import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionGuard } from './permission.guard';
import { StudentGuard } from './student.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminGuard,
    StudentGuard,
    PermissionGuard,
    Reflector,
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [AuthService, AdminGuard, StudentGuard, PermissionGuard],
})
export class AuthModule {}
