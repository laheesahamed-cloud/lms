import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { CoursesModule } from '../courses/courses.module';
import { XpModule } from '../xp/xp.module';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';

@Module({
  imports: [PlansModule, XpModule, CoursesModule],
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService],
  exports: [QuizAttemptsService],
})
export class QuizAttemptsModule {}
