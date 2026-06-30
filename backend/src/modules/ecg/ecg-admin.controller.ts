import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Put, Headers,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { EcgService, EcgTopicInput, EcgCardInput, EcgQuizInput } from './ecg.service';

@Controller('admin/ecg')
export class EcgAdminController {
  constructor(
    private readonly svc: EcgService,
    private readonly authService: AuthService,
  ) {}

  private async requireAdmin(auth?: string) {
    return this.authService.requireAdmin(auth);
  }

  // ──────────────── TOPICS ────────────────

  @Get('topics')
  async listTopics(@Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const topics = await this.svc.listTopicsAdmin();
    return { topics };
  }

  @Post('topics')
  async createTopic(@Body() body: EcgTopicInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    if (!body?.title?.trim()) throw new BadRequestException('Title is required');
    return this.svc.createTopic(body);
  }

  @Put('topics/reorder')
  async reorderTopics(@Body() body: { ids: number[] }, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.reorderTopics(body?.ids || []);
    return { ok: true };
  }

  @Get('topics/:id')
  async getTopic(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.getTopic(id);
  }

  @Put('topics/:id')
  async updateTopic(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EcgTopicInput,
    @Headers('authorization') auth?: string,
  ) {
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

  @Post('cards')
  async createCard(@Body() body: EcgCardInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    if (!body?.topic_id) throw new BadRequestException('topic_id is required');
    if (!body?.title?.trim()) throw new BadRequestException('Title is required');
    return this.svc.createCard(body);
  }

  @Put('cards/reorder')
  async reorderCards(@Body() body: { ids: number[] }, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.reorderCards(body?.ids || []);
    return { ok: true };
  }

  @Get('cards/:id')
  async getCard(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.getCard(id);
  }

  @Put('cards/:id')
  async updateCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<EcgCardInput>,
    @Headers('authorization') auth?: string,
  ) {
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
  async listQuiz(@Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    const questions = await this.svc.listQuizQuestions();
    return { questions };
  }

  @Post('quiz')
  async createQuiz(@Body() body: EcgQuizInput, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
      throw new BadRequestException('At least 2 options are required');
    }
    if (!body.options.some((o) => o?.correct)) {
      throw new BadRequestException('Mark one option as the correct answer');
    }
    return this.svc.createQuizQuestion(body);
  }

  @Get('quiz/:id')
  async getQuiz(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.getQuizQuestion(id);
  }

  @Put('quiz/:id')
  async updateQuiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EcgQuizInput,
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    if (!Array.isArray(body?.options) || body.options.filter((o) => o?.text?.trim()).length < 2) {
      throw new BadRequestException('At least 2 options are required');
    }
    if (!body.options.some((o) => o?.correct)) {
      throw new BadRequestException('Mark one option as the correct answer');
    }
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
}
