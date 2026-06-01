import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@Controller('topics')
@UseGuards(AdminGuard)
@RequirePermissions('content.manage')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(@Query('courseId') courseId?: string) {
    return this.topicsService.findAll(courseId ? parseInt(courseId, 10) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.topicsService.findOne(id);
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() createTopicDto: CreateTopicDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.create(createTopicDto, actor);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTopicDto: UpdateTopicDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.update(id, updateTopicDto, actor);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.remove(id, actor);
  }

  @Get(':id/versions')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.topicsService.listVersions(id);
  }

  @Post(':id/draft')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.publish(id, actor);
  }

  @Post(':id/rollback/:versionNumber')
  @RequirePermissions('content.review')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.topicsService.rollback(id, versionNumber, actor);
  }
}
