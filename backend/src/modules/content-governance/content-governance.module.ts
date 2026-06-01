import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentGovernanceController } from './content-governance.controller';
import { ContentGovernanceService } from './content-governance.service';

@Module({
  imports: [AuthModule],
  controllers: [ContentGovernanceController],
  providers: [ContentGovernanceService],
})
export class ContentGovernanceModule {}
