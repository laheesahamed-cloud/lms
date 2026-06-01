import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
