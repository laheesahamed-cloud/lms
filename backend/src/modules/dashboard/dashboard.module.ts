import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { DashboardController } from './dashboard.controller';
import { XpModule } from '../xp/xp.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, CoursesModule, XpModule, UsersModule, SubscriptionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
