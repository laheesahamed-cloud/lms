import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { StudentGuard } from '../auth/student.guard';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  @UseGuards(AdminGuard)
  findAll(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('topicId') topicId?: string,
    @Query('status') status?: string
  ) {
    return this.quizzesService.findAll({
      search,
      courseId: courseId ? parseInt(courseId, 10) : undefined,
      topicId: topicId || undefined,
      status,
    });
  }

  @Get('meta')
  @UseGuards(AdminGuard)
  meta(@Query('includeQuestions') includeQuestions?: string) {
    return this.quizzesService.meta({
      includeQuestions: includeQuestions === '1' || includeQuestions === 'true',
    });
  }

  @Get(':id/cards')
  @UseGuards(StudentGuard)
  getCards(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.getCards(id);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createQuizDto: CreateQuizDto) {
    return this.quizzesService.create(createQuizDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateQuizDto: UpdateQuizDto) {
    return this.quizzesService.update(id, updateQuizDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.remove(id);
  }
}
