import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { TheoryRecapController } from './theory-recap.controller';
import { TheoryRecapService } from './theory-recap.service';

@Module({
  imports: [DatabaseModule, AiModule, AuthModule],
  controllers: [TheoryRecapController],
  providers: [TheoryRecapService],
  exports: [TheoryRecapService],
})
export class TheoryRecapModule {}
