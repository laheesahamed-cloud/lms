import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PapersController } from './papers.controller';
import { PapersService } from './papers.service';

@Module({
  imports: [AuthModule, PushNotificationsModule],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
