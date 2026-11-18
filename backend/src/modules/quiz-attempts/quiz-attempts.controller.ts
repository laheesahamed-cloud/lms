import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';

@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Get('quizzes')
  listQuizzes(@Headers('authorization') authorization?: string) {
    return this.quizAttemptsService.listQuizzes(authorization);
  }

  @Get('results')
  listResults(@Headers('authorization') authorization?: string) {
    return this.quizAttemptsService.listResults(authorization);
  }

  @Get('quiz/:quizId')
  loadQuiz(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Query('mode') mode: string,
    @Query('questionId') questionId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.loadQuiz(authorization, quizId, mode, questionId ? Number(questionId) : null, appClient);
  }

  // Exams on the progress row (OPTIMIZE 10.16): start = 1 statement, submit = 1.
  @Post('exam/:quizId/start')
  startExam(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.startExam(authorization, quizId, appClient);
  }

  @Post('exam/:quizId/finish')
  finishExam(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { examToken?: string; answers?: Record<string, unknown>; lean?: boolean },
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.finishExam(authorization, quizId, body, appClient);
  }

  @Get('recent/:quizId/review')
  recentReview(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string,
    @Query('part') part?: string,
    @Query('lean') lean?: string,
  ) {
    return this.quizAttemptsService.recentReview(authorization, quizId, appClient, part, lean === '1');
  }

  @Post('recent/:quizId/reviewed')
  markRecentReviewed(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.markRecentReviewed(authorization, quizId);
  }

}
