import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { PlansModule } from '../plans/plans.module';
import { AiNotesController } from './ai-notes.controller';
import { AiNotesService } from './ai-notes.service';

@Module({
  imports: [ConfigModule, DatabaseModule, PlansModule],
  controllers: [AiNotesController],
  providers: [AiNotesService],
})
export class AiNotesModule {}
