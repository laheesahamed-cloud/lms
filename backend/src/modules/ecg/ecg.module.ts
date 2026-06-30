import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EcgController } from './ecg.controller';
import { EcgAdminController } from './ecg-admin.controller';
import { EcgService } from './ecg.service';

@Module({
  imports: [AuthModule],
  controllers: [EcgController, EcgAdminController],
  providers: [EcgService],
  exports: [EcgService],
})
export class EcgModule {}
