import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PapersService } from './papers.service';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';

@Controller('papers')
@UseGuards(AdminGuard)
@RequirePermissions('content.manage')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

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
  create(@Body() createPaperDto: CreatePaperDto) {
    return this.papersService.create(createPaperDto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePaperDto: UpdatePaperDto) {
    return this.papersService.update(id, updatePaperDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.papersService.remove(id);
  }
}
