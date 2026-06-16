import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { AiNotesController } from './ai-notes.controller';
import { AiNotesService } from './ai-notes.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [AiNotesController],
  providers: [AiNotesService],
  exports: [AiNotesService],
})
export class AiNotesModule {}
