import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StudentGuard } from './student.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminGuard, StudentGuard],
  exports: [AuthService, AdminGuard, StudentGuard],
})
export class AuthModule {}
