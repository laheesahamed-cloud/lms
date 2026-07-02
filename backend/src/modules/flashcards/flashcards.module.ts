import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonsModule } from '../lessons/lessons.module';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { FlashcardSchedulerService } from './flashcard-scheduler.service';

@Module({
  imports: [AuthModule, LessonsModule],
  controllers: [FlashcardsController],
  providers: [FlashcardsService, FlashcardSchedulerService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
