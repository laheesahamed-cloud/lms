import { Body, Controller, Delete, Get, Headers, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push')
export class PushNotificationsController {
  constructor(private readonly pushNotificationsService: PushNotificationsService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.pushNotificationsService.getPublicConfig();
  }

  @Get('settings')
  getSettings(@Headers('authorization') authorization?: string) {
    return this.pushNotificationsService.getSettings(authorization);
  }

  @Get('admin/status')
  @RequirePermissions('notifications.manage')
  getAdminStatus(@Headers('authorization') authorization?: string) {
    return this.pushNotificationsService.getAdminStatus(authorization);
  }

  @Put('settings')
  updateSettings(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.pushNotificationsService.updateSettings(authorization, body);
  }

  @Post('subscribe')
  subscribe(
    @Headers('authorization') authorization: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Body() body: any
  ) {
    return this.pushNotificationsService.subscribe(authorization, body, userAgent);
  }

  @Delete('subscribe')
  unsubscribe(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.pushNotificationsService.unsubscribe(authorization, body);
  }

  @Post('native-token')
  saveNativeToken(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.pushNotificationsService.saveNativeToken(authorization, body);
  }

  @Delete('native-token')
  deleteNativeToken(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.pushNotificationsService.deleteNativeToken(authorization, body);
  }

  @Post('admin/send')
  @RequirePermissions('notifications.manage')
  sendAdminNotification(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.pushNotificationsService.sendAdminNotification(authorization, body);
  }
}
