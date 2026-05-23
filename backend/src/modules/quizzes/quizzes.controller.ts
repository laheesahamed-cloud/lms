import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { StudentGuard } from '../auth/student.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
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
  @RequirePermissions('quizzes.manage')
  meta(@Query('includeQuestions') includeQuestions?: string) {
    return this.quizzesService.meta({
      includeQuestions: includeQuestions === '1' || includeQuestions === 'true',
    });
  }

  @Get(':id/cards')
  @UseGuards(StudentGuard)
  getCards(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authorization?: string) {
    return this.quizzesService.getCards(authorization, id);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  create(@Body() createQuizDto: CreateQuizDto) {
    return this.quizzesService.create(createQuizDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateQuizDto: UpdateQuizDto) {
    return this.quizzesService.update(id, updateQuizDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.remove(id);
  }
}
