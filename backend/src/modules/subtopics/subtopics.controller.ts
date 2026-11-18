import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SubtopicsService } from './subtopics.service';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';

@Controller('subtopics')
@UseGuards(AdminGuard)
@RequirePermissions('content.manage')
export class SubtopicsController {
  constructor(
    private readonly subtopicsService: SubtopicsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(@Query('topicId') topicId?: string) {
    return this.subtopicsService.findAll(topicId ? parseInt(topicId, 10) : undefined);
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() createSubtopicDto: CreateSubtopicDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.create(createSubtopicDto, actor);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubtopicDto: UpdateSubtopicDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.update(id, updateSubtopicDto, actor);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.remove(id, actor);
  }

  @Get(':id/versions')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.subtopicsService.listVersions(id);
  }

  @Post(':id/draft')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.publish(id, actor);
  }

  @Post(':id/rollback/:versionNumber')
  @RequirePermissions('content.review')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.subtopicsService.rollback(id, versionNumber, actor);
  }
}
