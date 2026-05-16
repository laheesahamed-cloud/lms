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
  generateQuiz(
    @Body() dto: GenerateAiQuizDto,
    @Query('engine') engine: string,
    @Query('includeExplanations') includeExplanations?: string,
    @Query('includeWhyIncorrect') includeWhyIncorrect?: string,
  ) {
    return this.aiService.generateQuiz({
      ...dto,
      includeExplanations: parseQueryBoolean(includeExplanations, dto.includeExplanations),
      includeWhyIncorrect: parseQueryBoolean(includeWhyIncorrect, dto.includeWhyIncorrect),
    }, engine);
  }

  @Post('beautify-lesson')
  beautifyLesson(@Body() dto: BeautifyLessonDto) {
    return this.aiService.beautifyLesson(dto);
  }

  @Post('generate-why-incorrect')
  generateWhyIncorrect(
    @Body() dto: GenerateWhyIncorrectDto,
    @Query('questionType') questionType?: 'sba' | 'true_false',
  ) {
    return this.aiService.generateWhyIncorrect({
      ...dto,
      questionType: questionType || dto.questionType,
    });
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

function parseQueryBoolean(value: string | undefined, fallback: boolean | undefined) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}
