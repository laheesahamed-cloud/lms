import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LessonsModule } from '../lessons/lessons.module';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { CoursesModule } from '../courses/courses.module';
import { SamplesController } from './samples.controller';
import { SamplesService } from './samples.service';

@Module({
  imports: [DatabaseModule, LessonsModule, QuizAttemptsModule, CoursesModule],
  controllers: [SamplesController],
  providers: [SamplesService],
})
export class SamplesModule {}
