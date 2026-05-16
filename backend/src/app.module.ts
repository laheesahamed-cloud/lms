import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { TopicsModule } from './modules/topics/topics.module';
import { SubtopicsModule } from './modules/subtopics/subtopics.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { QuizAttemptsModule } from './modules/quiz-attempts/quiz-attempts.module';
import { ResultsModule } from './modules/results/results.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { UsersModule } from './modules/users/users.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PapersModule } from './modules/papers/papers.module';
import { SchemaModule } from './modules/schema/schema.module';
import { AiModule } from './modules/ai/ai.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SmartNotesModule } from './modules/smart-notes/smart-notes.module';
import { AiNotesModule } from './modules/ai-notes/ai-notes.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { StudyBookmarksModule } from './modules/study-bookmarks/study-bookmarks.module';
import { TheoryRecapModule } from './modules/theory-recap/theory-recap.module';
import { SetupModule } from './modules/setup/setup.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    SchemaModule,
    AiModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    TopicsModule,
    SubtopicsModule,
    LessonsModule,
    QuestionsModule,
    QuizzesModule,
    QuizAttemptsModule,
    ResultsModule,
    DashboardModule,
    UploadsModule,
    PapersModule,
    SmartNotesModule,
    AiNotesModule,
    PlansModule,
    SubscriptionsModule,
    StudyBookmarksModule,
    TheoryRecapModule,
    SetupModule,
    PushNotificationsModule,
    WorkspaceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
