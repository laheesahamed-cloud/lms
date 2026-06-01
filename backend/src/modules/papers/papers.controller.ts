import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PapersService } from './papers.service';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';

@Controller('papers')
@UseGuards(AdminGuard)
@RequirePermissions('content.manage')
export class PapersController {
  constructor(
    private readonly papersService: PapersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(@Query('search') search?: string, @Query('status') status?: string) {
    return this.papersService.findAll({ search, status });
  }

  @Get('keywords')
  keywordSuggestions(@Query('query') query?: string) {
    return this.papersService.keywordSuggestions(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.papersService.findOne(id);
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() createPaperDto: CreatePaperDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.create(createPaperDto, actor);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaperDto: UpdatePaperDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.update(id, updatePaperDto, actor);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.remove(id, actor);
  }

  @Get(':id/versions')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.papersService.listVersions(id);
  }

  @Post(':id/draft')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.publish(id, actor);
  }

  @Post(':id/rollback/:versionNumber')
  @RequirePermissions('content.review')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.papersService.rollback(id, versionNumber, actor);
  }
}
