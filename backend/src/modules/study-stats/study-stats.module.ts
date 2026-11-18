import { Global, Module } from '@nestjs/common';
import { StudyStatsService } from './study-stats.service';

/** Global: the exam submit, XP, the activity log and the Study Hub all use it. */
@Global()
@Module({
  providers: [StudyStatsService],
  exports: [StudyStatsService],
})
export class StudyStatsModule {}
