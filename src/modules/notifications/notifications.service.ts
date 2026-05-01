import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { ConfigService } from '@/core/config';
import { MessagingService } from '@/infrastructure/messaging';

export type NotificationEvent = {
  type: 'deployment.success' | 'deployment.failed' | 'deployment.rollback';
  projectName: string;
  environmentName: string;
  deploymentId: string;
  message?: string;
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

  async onModuleInit() {
    await this.messaging.subscribe(
      'notifications',
      'control_plane',
      'deployment.*',
      async (payload) => {
        await this.notify(payload as NotificationEvent);
      },
    );
  }

  async notify(event: NotificationEvent): Promise<void> {
    await Promise.allSettled([
      this.sendEmail(event),
      this.sendTelegram(event),
      this.sendWebhook(event),
    ]);
  }

  private async sendEmail(event: NotificationEvent): Promise<void> {
    const host = this.configService.get('SMTP_HOST');
    if (!host) return;

    try {
      const transport = createTransport({
        host,
        port: this.configService.get('SMTP_PORT'),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });

      await transport.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: this.configService.get('ADMIN_EMAIL'),
        subject: `[Control Plane] ${event.type} — ${event.projectName}/${event.environmentName}`,
        text: JSON.stringify(event, null, 2),
      });
    } catch (err) {
      this.logger.error({ err }, 'sendEmail failed');
    }
  }

  private async sendTelegram(event: NotificationEvent): Promise<void> {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get('TELEGRAM_CHAT_ID');
    if (!token || !chatId) return;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `[Control Plane] ${event.type}\n${event.projectName}/${event.environmentName}\n${event.message ?? ''}`,
          parse_mode: 'HTML',
        }),
      });
    } catch (err) {
      this.logger.error({ err }, 'sendTelegram failed');
    }
  }

  private async sendWebhook(event: NotificationEvent): Promise<void> {
    const url = this.configService.get('NOTIFICATION_WEBHOOK_URL');
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (err) {
      this.logger.error({ err }, 'sendWebhook failed');
    }
  }
}
