import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, ChannelModel, Channel } from 'amqplib';
import { ConfigService } from '@/core/config';

@Injectable()
export class MessagingService implements OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerChannel: Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
    const url = this.configService.get('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RABBITMQ_URL not set, skipping publish');
      return;
    }

    try {
      if (!this.channel) {
        this.connection = await connect(url);
        this.channel = await this.connection.createChannel();
      }

      const ch = this.channel;
      await ch.assertExchange(exchange, 'topic', { durable: true });
      ch.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
    } catch (err) {
      this.logger.error(`publish failed: ${(err as Error).message}`);
      await this.channel?.close().catch(() => {});
      await this.connection?.close().catch(() => {});
      this.channel = null;
      this.connection = null;
    }
  }

  async subscribe(
    queue: string,
    exchange: string,
    routingKey: string,
    handler: (payload: unknown) => Promise<void>,
  ): Promise<void> {
    const url = this.configService.get('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RABBITMQ_URL not set, skipping subscription');
      return;
    }

    try {
      const conn = await connect(url);
      this.consumerChannel = await conn.createChannel();
      await this.consumerChannel.assertExchange(exchange, 'topic', { durable: true });
      await this.consumerChannel.assertQueue(queue, { durable: true });
      await this.consumerChannel.bindQueue(queue, exchange, routingKey);
      await this.consumerChannel.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await handler(payload);
          this.consumerChannel?.ack(msg);
        } catch (err) {
          this.logger.error(`consumer handler error: ${(err as Error).message}`);
          this.consumerChannel?.nack(msg, false, false);
        }
      });
    } catch (err) {
      this.logger.error(`subscribe failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.consumerChannel?.close().catch(() => {});
    await this.channel?.close().catch(() => {});
    await this.connection?.close().catch(() => {});
  }
}
