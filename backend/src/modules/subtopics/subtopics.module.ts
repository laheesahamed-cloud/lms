import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubtopicsController } from './subtopics.controller';
import { SubtopicsService } from './subtopics.service';

@Module({
  imports: [AuthModule],
  controllers: [SubtopicsController],
  providers: [SubtopicsService],
})
export class SubtopicsModule {}
