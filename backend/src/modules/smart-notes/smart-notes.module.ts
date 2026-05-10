import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmartNotesController } from './smart-notes.controller';
import { SmartNotesService } from './smart-notes.service';
import { SmartNotesImageApiService } from './smart-notes-image-api.service';

@Module({
  imports: [ConfigModule],
  controllers: [SmartNotesController],
  providers: [SmartNotesService, SmartNotesImageApiService],
})
export class SmartNotesModule {}
