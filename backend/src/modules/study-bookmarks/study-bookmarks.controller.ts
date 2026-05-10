import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ToggleStudyBookmarkDto } from './dto/toggle-study-bookmark.dto';
import { StudyBookmarksService } from './study-bookmarks.service';

@Controller('study-bookmarks')
export class StudyBookmarksController {
  constructor(
    private readonly studyBookmarksService: StudyBookmarksService,
    private readonly authService: AuthService
  ) {}

  @Get()
  async list(@Headers('authorization') authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    return this.studyBookmarksService.list(student.id);
  }

  @Post('toggle')
  async toggle(@Headers('authorization') authorization: string | undefined, @Body() dto: ToggleStudyBookmarkDto) {
    const student = await this.authService.requireStudent(authorization);
    return this.studyBookmarksService.toggle(student.id, dto);
  }
}
