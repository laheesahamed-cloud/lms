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

  @Post('exam/:quizId/submit')
  submitExam(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() submitExamDto: SubmitExamDto
  ) {
    return this.quizAttemptsService.submitExam(authorization, quizId, submitExamDto);
  }

  @Post('exam/:quizId/save')
  saveExamProgress(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() saveExamProgressDto: SaveExamProgressDto
  ) {
    return this.quizAttemptsService.saveExamProgress(authorization, quizId, saveExamProgressDto);
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
