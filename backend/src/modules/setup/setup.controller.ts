import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SetupService } from './setup.service';

@Controller('setup')
@UseGuards(AdminGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get()
  getSetupStatus() {
    return this.setupService.getSetupStatus();
  }
}
