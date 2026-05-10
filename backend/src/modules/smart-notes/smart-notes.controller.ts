import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Headers,
} from '@nestjs/common';
import { SmartNotesService } from './smart-notes.service';
import { CreateSmartNoteDto } from './dto/create-smart-note.dto';
import { UpdateSmartNoteDto } from './dto/update-smart-note.dto';

function extractToken(authHeader: string | undefined): string {
  if (!authHeader?.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

@Controller('smart-notes')
export class SmartNotesController {
  constructor(private readonly smartNotesService: SmartNotesService) {}

  @Get()
  list(@Headers('authorization') auth: string) {
    return this.smartNotesService.list(extractToken(auth));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') auth: string,
  ) {
    return this.smartNotesService.findOne(id, extractToken(auth));
  }

  @Post()
  create(
    @Body() dto: CreateSmartNoteDto,
    @Headers('authorization') auth: string,
  ) {
    return this.smartNotesService.create(dto, extractToken(auth));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSmartNoteDto,
    @Headers('authorization') auth: string,
  ) {
    return this.smartNotesService.update(id, dto, extractToken(auth));
  }

  @Post(':id/process')
  processWithAi(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') auth: string,
  ) {
    return this.smartNotesService.processWithAi(id, extractToken(auth));
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') auth: string,
  ) {
    return this.smartNotesService.remove(id, extractToken(auth));
  }
}
