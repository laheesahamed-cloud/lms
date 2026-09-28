import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OsceController } from './osce.controller';
import { OsceAdminController } from './osce-admin.controller';
import { OsceService } from './osce.service';
import { OsceGeneratorService } from './osce-generator.service';
import { SmartNotesImageApiService } from '../smart-notes/smart-notes-image-api.service';

@Module({
  imports: [AuthModule],
  controllers: [OsceController, OsceAdminController],
  providers: [OsceService, OsceGeneratorService, SmartNotesImageApiService],
  exports: [OsceService],
})
export class OsceModule {}
