import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ResultsService } from './results.service';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  list(@Headers('authorization') authorization?: string) {
    return this.resultsService.list(authorization);
  }

  @Get('review/:attemptId')
  review(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.resultsService.review(authorization, attemptId);
  }

  @Get(':attemptId')
  detail(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.resultsService.detail(authorization, attemptId);
  }
}
