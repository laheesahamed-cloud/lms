import { join } from 'path';
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
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { StudyBookmarksModule } from './modules/study-bookmarks/study-bookmarks.module';
import { TheoryRecapModule } from './modules/theory-recap/theory-recap.module';
import { SetupModule } from './modules/setup/setup.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import { ContentGovernanceModule } from './modules/content-governance/content-governance.module';
import { BootModule } from './modules/boot/boot.module';
import { DrugsModule } from './modules/drugs/drugs.module';
import { EcgModule } from './modules/ecg/ecg.module';
import { AuscultationModule } from './modules/auscultation/auscultation.module';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      // No path here defaults to dotenv looking for '.env' relative to
      // process.cwd() — whatever directory the process manager happened to
      // launch node from, not necessarily this backend's own directory. On
      // this server that meant every edit to backend/.env (NODE_ENV,
      // SCHEMA_SYNC, and the APNs key) was silently never read: the running
      // process was loading a DIFFERENT (or no) .env the whole time, so
      // ConfigService just returned whatever it already had, restart after
      // restart. Pointing directly at this file by an absolute path (derived
      // from this module's own location, so it's correct in dist/ too) means
      // it no longer depends on how or from where the process was started.
      envFilePath: join(__dirname, '..', '.env'),
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
    FlashcardsModule,
    PlansModule,
    SubscriptionsModule,
    StudyBookmarksModule,
    TheoryRecapModule,
    SetupModule,
    PushNotificationsModule,
    ContentGovernanceModule,
    WorkspaceModule,
    BootModule,
    DrugsModule,
    EcgModule,
    AuscultationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
