import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuscultationController } from './auscultation.controller';
import { AuscultationAdminController } from './auscultation-admin.controller';
import { AuscultationService } from './auscultation.service';

@Module({
  imports: [AuthModule],
  controllers: [AuscultationController, AuscultationAdminController],
  providers: [AuscultationService],
  exports: [AuscultationService],
})
export class AuscultationModule {}
