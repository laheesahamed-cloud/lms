import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SubtopicsService } from './subtopics.service';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';

@Controller('subtopics')
@UseGuards(AdminGuard)
export class SubtopicsController {
  constructor(private readonly subtopicsService: SubtopicsService) {}

  @Get()
  findAll(@Query('topicId') topicId?: string) {
    return this.subtopicsService.findAll(topicId ? parseInt(topicId, 10) : undefined);
  }

  @Post()
  create(@Body() createSubtopicDto: CreateSubtopicDto) {
    return this.subtopicsService.create(createSubtopicDto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateSubtopicDto: UpdateSubtopicDto) {
    return this.subtopicsService.update(id, updateSubtopicDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subtopicsService.remove(id);
  }
}
