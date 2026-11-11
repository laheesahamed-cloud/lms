import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { DashboardController } from './dashboard.controller';
import { XpModule } from '../xp/xp.module';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, CoursesModule, XpModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
