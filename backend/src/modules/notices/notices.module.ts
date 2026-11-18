import { Global, Module } from '@nestjs/common';
import { NoticesService } from './notices.service';

/** Global: new-content publishing, admin messages, the start-up reply and the website list use it. */
@Global()
@Module({
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
