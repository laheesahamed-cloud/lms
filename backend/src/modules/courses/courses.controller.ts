import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('student')
  findStudentCourses(@Headers('authorization') authorization?: string) {
    return this.coursesService.findStudentCourses(authorization);
  }

  @Get('student/:id')
  findStudentCourseDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.coursesService.findStudentCourseDetail(id, authorization);
  }

  @Patch('student/lessons/:lessonId/progress')
  updateStudentLessonProgress(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() dto: UpdateStudentLessonProgressDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.coursesService.updateStudentLessonProgress(lessonId, dto, authorization);
  }

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.coursesService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }
}
