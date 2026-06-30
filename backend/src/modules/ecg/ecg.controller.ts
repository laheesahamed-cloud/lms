import { Controller, Get, Param, ParseIntPipe, Query, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { EcgService } from './ecg.service';

@Controller('ecg')
export class EcgController {
  constructor(
    private readonly svc: EcgService,
    private readonly authService: AuthService,
  ) {}

  // ── list numbered topics ──
  @Get('topics')
  async topics(@Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    const topics = await this.svc.listTopics();
    return { topics };
  }

  // ── one topic + its cards ──
  @Get('topics/:id')
  async topic(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireStudent(auth);
    const data = await this.svc.getTopicWithCards(id);
    if (!data) return { topic: null, cards: [] };
    return data;
  }

  // ── quiz batch ──
  @Get('quiz')
  async quiz(
    @Query('count') count = '10',
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireStudent(auth);
    return this.svc.getQuizBatch(Number(count));
  }
}
