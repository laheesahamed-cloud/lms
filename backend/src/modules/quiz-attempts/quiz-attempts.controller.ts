import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { SavePracticeDto } from './dto/save-practice.dto';
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
    @Query('continue') continuePractice?: string,
    @Query('resetPractice') resetPractice?: string,
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.loadQuiz(authorization, quizId, mode, continuePractice === '1', resetPractice === '1');
  }

  @Post('practice/:quizId/save')
  savePractice(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() savePracticeDto: SavePracticeDto
  ) {
    return this.quizAttemptsService.savePractice(authorization, quizId, savePracticeDto);
  }

  @Post('exam/:quizId/submit')
  submitExam(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Headers('authorization') authorization: string | undefined,
    @Body() submitExamDto: SubmitExamDto
  ) {
    return this.quizAttemptsService.submitExam(authorization, quizId, submitExamDto);
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
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.review(authorization, attemptId);
  }

  @Get('practice-review/:quizId')
  practiceReview(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Query('complete') complete?: string,
    @Headers('authorization') authorization?: string
  ) {
    return this.quizAttemptsService.practiceReview(authorization, quizId, complete === '1');
  }
}
