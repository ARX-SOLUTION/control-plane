import { Controller, Post, HttpCode, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@/core/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  @HttpCode(200)
  async test(@Req() req: Request) {
    await this.notificationsService.notify({
      type: 'deployment.success',
      projectName: 'test-project',
      environmentName: 'test',
      deploymentId: 'test-id',
      message: 'This is a test notification',
    });
    return { ok: true };
  }
}
