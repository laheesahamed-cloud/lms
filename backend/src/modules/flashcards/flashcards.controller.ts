import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { FlashcardsService } from './flashcards.service';
import { SubmitReviewsDto } from './dto/submit-reviews.dto';

function rawToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function parseNoteIds(value: string | undefined): number[] {
  return String(value || '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

@Controller('flashcards')
export class FlashcardsController {
  constructor(
    private readonly svc: FlashcardsService,
    private readonly authService: AuthService,
  ) {}

  @Get('decks')
  async decks(@Headers('authorization') auth?: string) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.listDecks(student.id, rawToken(auth));
  }

  @Get('queue')
  async queue(
    @Query('noteIds') noteIds: string,
    @Query('limit') limit: string,
    @Query('newLimit') newLimit: string,
    @Headers('authorization') auth?: string,
  ) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.getQueue(student.id, rawToken(auth), {
      noteIds: parseNoteIds(noteIds),
      limit: limit ? Number(limit) : undefined,
      newLimit: newLimit ? Number(newLimit) : undefined,
    });
  }

  @Post('reviews')
  async submit(@Body() dto: SubmitReviewsDto, @Headers('authorization') auth?: string) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.submitReviews(student.id, dto.reviews);
  }

  @Post('reviews/undo')
  async undo(@Body('cardId', ParseIntPipe) cardId: number, @Headers('authorization') auth?: string) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.undo(student.id, cardId);
  }

  @Post('cards/:cardId/flags')
  async flags(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: { suspended?: boolean; buried?: boolean },
    @Headers('authorization') auth?: string,
  ) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.setCardFlags(student.id, cardId, {
      suspended: body?.suspended,
      buried: body?.buried,
    });
  }

  @Get('stats')
  async stats(@Headers('authorization') auth?: string) {
    const student = await this.authService.requireStudent(auth);
    return this.svc.stats(student.id);
  }

  @Get('settings')
  async getSettings(@Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    return this.svc.getSettings();
  }

  @Patch('settings')
  async patchSettings(@Body() body: Record<string, unknown>, @Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    return this.svc.updateSettings(body || {});
  }
}
