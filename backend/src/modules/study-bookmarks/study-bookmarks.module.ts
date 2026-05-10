import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudyBookmarksController } from './study-bookmarks.controller';
import { StudyBookmarksService } from './study-bookmarks.service';

@Module({
  imports: [AuthModule],
  controllers: [StudyBookmarksController],
  providers: [StudyBookmarksService],
})
export class StudyBookmarksModule {}
