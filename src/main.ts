import './tracing';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { Redis } from 'ioredis';
import { ConfigService } from '@/core/config';
import { HttpExceptionFilter } from '@/shared/exceptions';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  const redisClient = new Redis(config.get('REDIS_URL'));
  app.use(
    session({
      name: config.get('SESSION_NAME'),
      secret: config.get('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
      cookie: {
        httpOnly: true,
        secure: config.isProduction(),
        sameSite: 'strict',
        maxAge: config.get('SESSION_MAX_AGE'),
      },
    }),
  );

  app.useWebSocketAdapter(new WsAdapter(app));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.get('PORT'));
}
bootstrap();
