import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlansModule } from '../plans/plans.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [AuthModule, PlansModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
