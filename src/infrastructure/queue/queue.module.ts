import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@/core/config';
import {
  REDIS_CLIENT_TOKEN,
  DEPLOYMENT_QUEUE_TOKEN,
  DEPLOYMENT_QUEUE_NAME,
} from './queue.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: DEPLOYMENT_QUEUE_TOKEN,
      inject: [REDIS_CLIENT_TOKEN],
      useFactory: (redis: Redis) =>
        new Queue(DEPLOYMENT_QUEUE_NAME, {
          connection: redis,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        }),
    },
  ],
  exports: [REDIS_CLIENT_TOKEN, DEPLOYMENT_QUEUE_TOKEN],
})
export class QueueModule {}
