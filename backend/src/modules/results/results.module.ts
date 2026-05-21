import { Module } from '@nestjs/common';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [QuizAttemptsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
