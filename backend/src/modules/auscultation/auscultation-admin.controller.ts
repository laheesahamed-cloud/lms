import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Put, Query, Headers,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuscultationService, AuscTopicInput, AuscCardInput, AuscQuizInput, SoundCategory } from './auscultation.service';

@Controller('admin/auscultation')
export class AuscultationAdminController {
  constructor(
    private readonly svc: AuscultationService,
    private readonly authService: AuthService,
  ) {}

  private async requireAdmin(auth?: string) {
    return this.authService.requireAdmin(auth);
  }

  private cat(c?: string): SoundCategory | undefined {
    if (c === 'heart' || c === 'lung') return c;
    return undefined;
  }

  // ──────────────── TOPICS ────────────────

  @Get('topics')
  async listTopics(@Query('category') category?: string, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const topics = await this.svc.listTopicsAdmin(this.cat(category));
    return { topics };
  }

  @Post('topics')
  async createTopic(@Body() body: AuscTopicInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    if (!body?.title?.trim()) throw new BadRequestException('Title is required');
    return this.svc.createTopic(body);
  }

  @Get('topics/:id')
  async getTopic(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.getTopic(id);
  }

  @Put('topics/:id')
  async updateTopic(@Param('id', ParseIntPipe) id: number, @Body() body: AuscTopicInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.updateTopic(id, body);
    return { ok: true };
  }

  @Patch('topics/:id/toggle')
  async toggleTopic(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.toggleTopic(id);
    return { ok: true };
  }

  @Delete('topics/:id')
  async deleteTopic(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.deleteTopic(id);
    return { ok: true };
  }

  // ──────────────── CARDS ────────────────

  @Get('topics/:id/cards')
  async listCards(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const cards = await this.svc.listCards(id);
    return { cards };
  }

  // All sounds across topics (for the quiz "reuse existing sound" picker)
  @Get('sounds')
  async listAllSounds(@Query('category') category?: string, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const sounds = await this.svc.listAllCards(this.cat(category));
    return { sounds };
  }

  @Post('cards')
  async createCard(@Body() body: AuscCardInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    if (!body?.topic_id) throw new BadRequestException('topic_id is required');
    if (!body?.title?.trim()) throw new BadRequestException('Title is required');
    return this.svc.createCard(body);
  }

  @Put('cards/:id')
  async updateCard(@Param('id', ParseIntPipe) id: number, @Body() body: AuscCardInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.updateCard(id, body);
    return { ok: true };
  }

  @Patch('cards/:id/toggle')
  async toggleCard(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.toggleCard(id);
    return { ok: true };
  }

  @Delete('cards/:id')
  async deleteCard(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.deleteCard(id);
    return { ok: true };
  }

  // ──────────────── QUIZ ────────────────

  @Get('quiz')
  async listQuiz(@Query('category') category?: string, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const questions = await this.svc.listQuizQuestions(this.cat(category));
    return { questions };
  }

  @Post('quiz')
  async createQuiz(@Body() body: AuscQuizInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    this.validateQuiz(body);
    if (!body.audio_data_url && !body.source_card_id) {
      throw new BadRequestException('Attach an audio clip or reuse an existing sound');
    }
    return this.svc.createQuizQuestion(body);
  }

  @Put('quiz/:id')
  async updateQuiz(@Param('id', ParseIntPipe) id: number, @Body() body: AuscQuizInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    this.validateQuiz(body);
    await this.svc.updateQuizQuestion(id, body);
    return { ok: true };
  }

  @Patch('quiz/:id/toggle')
  async toggleQuiz(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.toggleQuizQuestion(id);
    return { ok: true };
  }

  @Delete('quiz/:id')
  async deleteQuiz(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.deleteQuizQuestion(id);
    return { ok: true };
  }

  private validateQuiz(body: AuscQuizInput) {
    if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
      throw new BadRequestException('At least 2 options are required');
    }
    if (!body.options.some((o) => o?.correct)) {
      throw new BadRequestException('Mark one option as the correct answer');
    }
  }
}
