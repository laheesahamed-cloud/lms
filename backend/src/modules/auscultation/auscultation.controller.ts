import { Controller, Get, Param, ParseIntPipe, Query, Headers, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuscultationService, SoundCategory } from './auscultation.service';

@Controller('auscultation')
export class AuscultationController {
  constructor(
    private readonly svc: AuscultationService,
    private readonly authService: AuthService,
  ) {}

  private cat(c?: string): SoundCategory {
    return c === 'lung' ? 'lung' : 'heart';
  }

  @Get('topics')
  async topics(@Query('category') category?: string, @Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    const topics = await this.svc.listTopics(this.cat(category));
    return { topics };
  }

  @Get('topics/:id')
  async topic(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    const data = await this.svc.getTopicWithCards(id);
    if (!data) return { topic: null, cards: [] };
    return data;
  }

  @Get('quiz')
  async quiz(
    @Query('category') category?: string,
    @Query('count') count = '10',
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireStudent(auth);
    return this.svc.getQuizBatch(this.cat(category), Number(count));
  }

  // ── audio streaming (auth via Bearer or bridged session cookie) ──
  @Get('cards/:id/audio')
  async cardAudio(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireStudent(auth);
    const audio = await this.svc.getCardAudio(id);
    if (!audio) throw new NotFoundException('Audio not found');
    this.sendAudio(res, audio);
  }

  @Get('quiz/:id/audio')
  async quizAudio(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireStudent(auth);
    const audio = await this.svc.getQuizAudio(id);
    if (!audio) throw new NotFoundException('Audio not found');
    this.sendAudio(res, audio);
  }

  private sendAudio(res: Response, audio: { buffer: Buffer; mime: string }) {
    res.setHeader('Content-Type', audio.mime || 'audio/mpeg');
    res.setHeader('Content-Length', audio.buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(audio.buffer);
  }
}
