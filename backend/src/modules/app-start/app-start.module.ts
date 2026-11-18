import { FlashcardsModule } from '../flashcards/flashcards.module';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { CoursesModule } from '../courses/courses.module';
import { AppStartController } from './app-start.controller';
import { START_PAYLOAD, StartPayloadService } from './start-payload.service';

@Module({
  imports: [AuthModule, DashboardModule, CoursesModule, QuizAttemptsModule, FlashcardsModule],
  controllers: [AppStartController],
  providers: [StartPayloadService, { provide: START_PAYLOAD, useExisting: StartPayloadService }],
  exports: [StartPayloadService, START_PAYLOAD],
})
export class AppStartModule {}
