import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('meta')
  @UseGuards(AdminGuard)
  getMeta() {
    return this.lessonsService.getMeta();
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  findAdminList(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('topicId') topicId?: string,
    @Query('subtopicId') subtopicId?: string,
    @Query('status') status?: string
  ) {
    return this.lessonsService.findAdminList({
      search,
      courseId: courseId ? Number(courseId) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      subtopicId: subtopicId ? Number(subtopicId) : undefined,
      status,
    });
  }

  @Get('student')
  findStudentList(@Headers('authorization') authorization?: string) {
    return this.lessonsService.findStudentList(authorization);
  }

  @Get('student/:id')
  findStudentLesson(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authorization?: string) {
    return this.lessonsService.findStudentLesson(id, authorization);
  }

  @Get(':lessonId/annotations')
  findStudentAnnotations(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.findStudentAnnotations(lessonId, authorization);
  }

  @Post(':lessonId/annotations')
  createStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() createLessonAnnotationDto: CreateLessonAnnotationDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.createStudentAnnotation(lessonId, createLessonAnnotationDto, authorization);
  }

  @Patch(':lessonId/annotations/:annotationId')
  updateStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Body() updateLessonAnnotationDto: UpdateLessonAnnotationDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.updateStudentAnnotation(lessonId, annotationId, updateLessonAnnotationDto, authorization);
  }

  @Delete(':lessonId/annotations/:annotationId')
  removeStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.removeStudentAnnotation(lessonId, annotationId, authorization);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.create(createLessonDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.remove(id);
  }
}
