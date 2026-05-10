import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TheoryRecapService } from './theory-recap.service';
import { UpsertTheoryRecapDto } from './dto/upsert-theory-recap.dto';

@Controller('theory-recap')
export class TheoryRecapController {
  constructor(
    private readonly theoryRecapService: TheoryRecapService,
    private readonly authService: AuthService
  ) {}

  @Get('question/:questionId')
  async getByQuestionId(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAuthenticatedUser(authorization);
    return this.theoryRecapService.getByQuestionId(questionId);
  }

  @Put('question/:questionId')
  async upsert(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: UpsertTheoryRecapDto,
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.theoryRecapService.upsert(questionId, dto, 'manual');
  }

  @Post('question/:questionId/generate')
  async generate(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.theoryRecapService.generateForQuestion(questionId);
  }

  @Post('question/:questionId/regenerate')
  async regenerate(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAdmin(authorization);
    await this.theoryRecapService.delete(questionId);
    return this.theoryRecapService.generateForQuestion(questionId);
  }

  @Delete('question/:questionId')
  async deleteRecap(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.theoryRecapService.delete(questionId);
  }

  @Post('bulk-generate')
  async bulkGenerate(
    @Body() body: { questionIds: number[] },
    @Headers('authorization') authorization?: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.theoryRecapService.bulkGenerate(body.questionIds || []);
  }
}
