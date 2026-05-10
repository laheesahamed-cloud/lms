import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AiService } from './ai.service';
import { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';
import { BeautifyLessonDto } from './dto/beautify-lesson.dto';
import { GenerateWhyIncorrectDto } from './dto/generate-why-incorrect.dto';
import { GenerateExplanationDto } from './dto/generate-explanation.dto';

@Controller('ai')
@UseGuards(AdminGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-quiz')
  generateQuiz(@Body() dto: GenerateAiQuizDto, @Query('engine') engine: string) {
    return this.aiService.generateQuiz(dto, engine);
  }

  @Post('beautify-lesson')
  beautifyLesson(@Body() dto: BeautifyLessonDto) {
    return this.aiService.beautifyLesson(dto);
  }

  @Post('generate-why-incorrect')
  generateWhyIncorrect(@Body() dto: GenerateWhyIncorrectDto) {
    return this.aiService.generateWhyIncorrect(dto);
  }

  @Post('generate-explanation')
  generateExplanation(@Body() dto: GenerateExplanationDto) {
    return this.aiService.generateExplanation(dto);
  }

  @Post('generate-theory-card')
  generateTheoryCard(@Body() dto: GenerateExplanationDto & { explanation?: string }) {
    return this.aiService.generateTheoryCardFromQuestion(dto);
  }
}
