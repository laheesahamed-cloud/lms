import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SetupService } from './setup.service';

@Controller('setup')
@UseGuards(AdminGuard)
@RequirePermissions('settings.manage')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get()
  getSetupStatus() {
    return this.setupService.getSetupStatus();
  }
}
