import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { SaveExamProgressDto } from './dto/save-exam-progress.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

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

  // x-app-client is forwarded here for the same reason loadQuiz forwards it:
  // the access check treats a premium quiz as app-only, and a request without
  // the header looks like the website. Omitting it meant a student could open
  // and sit an exam in the app and then be refused at the very end — a 403 on
  // submit, with the answers still unsaved.
  @Post('exam/:quizId/submit')
  submitExam(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() submitExamDto: SubmitExamDto,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.submitExam(authorization, quizId, submitExamDto, appClient);
  }

  @Post('exam/:quizId/save')
  saveExamProgress(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() saveExamProgressDto: SaveExamProgressDto,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.saveExamProgress(authorization, quizId, saveExamProgressDto, appClient);
  }

  @Get('result/:attemptId')
  result(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.result(authorization, attemptId);
  }

  @Get('review/:attemptId')
  review(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.quizAttemptsService.review(authorization, attemptId, appClient);
  }

  @Post('review/:attemptId/complete')
  completeReview(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.completeReview(authorization, attemptId);
  }

}
