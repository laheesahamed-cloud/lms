import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'lms-api',
      timestamp: new Date().toISOString(),
    };
  }
}
