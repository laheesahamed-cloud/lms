import { Injectable } from '@nestjs/common';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';

@Injectable()
export class ResultsService {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  list(authorization?: string) {
    return this.quizAttemptsService.listResults(authorization);
  }

  detail(authorization: string | undefined, attemptId: number) {
    return this.quizAttemptsService.result(authorization, attemptId);
  }

  review(authorization: string | undefined, attemptId: number) {
    return this.quizAttemptsService.review(authorization, attemptId);
  }
}
