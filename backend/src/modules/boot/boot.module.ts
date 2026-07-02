import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonsModule } from '../lessons/lessons.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { StudyBookmarksModule } from '../study-bookmarks/study-bookmarks.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { BootController } from './boot.controller';
import { BootService } from './boot.service';

@Module({
  imports: [AuthModule, DashboardModule, WorkspaceModule, QuizAttemptsModule, StudyBookmarksModule, LessonsModule],
  controllers: [BootController],
  providers: [BootService],
})
export class BootModule {}
