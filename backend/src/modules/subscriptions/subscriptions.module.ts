import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlansModule } from '../plans/plans.module';
import { SettingsModule } from '../settings/settings.module';
import { AppleIapService } from './apple-iap.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule, PlansModule, SettingsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, AppleIapService],
})
export class SubscriptionsModule {}
