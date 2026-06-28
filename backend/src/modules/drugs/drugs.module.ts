import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { DrugsController } from './drugs.controller';
import { DrugsAdminController } from './drugs-admin.controller';
import { DrugsService } from './drugs.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [DrugsController, DrugsAdminController],
  providers: [DrugsService],
  exports: [DrugsService],
})
export class DrugsModule {}
