import { Controller, Get, Headers, Query } from '@nestjs/common';
import { BootService } from './boot.service';

@Controller('boot')
export class BootController {
  constructor(private readonly bootService: BootService) {}

  @Get('student')
  getStudentBoot(
    @Headers('authorization') authorization?: string,
    @Query('engine') engine?: string
  ) {
    return this.bootService.getStudentBoot(authorization, engine);
  }
}
