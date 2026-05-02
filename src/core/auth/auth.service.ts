import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { promisify } from 'util';
import type { Request } from 'express';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { REDIS_CLIENT_TOKEN } from '@/infrastructure/queue/queue.constants';
import { users } from '@/infrastructure/persistence/main.schema';
import { AuditService } from '@/core/audit';
import { ConfigService } from '@/core/config';
import {
  UnauthorizedException,
  NotFoundException,
  TooManyRequestsException,
} from '@/shared/exceptions';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    await this.bootstrapAdmin();
  }

  async bootstrapAdmin(): Promise<void> {
    const adminEmail = this.configService.get('ADMIN_EMAIL');
    const adminPassword = this.configService.get('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) return;

    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existing.length > 0) return;

    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
    });

    await this.db.insert(users).values({
      email: adminEmail,
      passwordHash,
    });
  }

  async login(
    dto: LoginDto,
    req: Request,
  ): Promise<{ id: string; email: string }> {
    const ip = req.ip ?? 'unknown';
    const key = `rate:login:${ip}:${dto.email}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, 900);
    }
    if (attempts > 5) {
      throw new TooManyRequestsException(
        'Too many login attempts, try again later',
      );
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.redis.del(key);
    await promisify(req.session.regenerate.bind(req.session))();
    req.session.userId = user.id;
    // Explicitly save session before responding — required in async NestJS context
    // because express-session's auto-save hooks may fire after response is sent.
    await promisify(req.session.save.bind(req.session))();

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    this.auditService.log({
      actor_user_id: user.id,
      action: 'user.login',
      resource_type: 'user',
      resource_id: user.id,
      ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    return { id: user.id, email: user.email };
  }

  async logout(req: Request): Promise<void> {
    const userId = req.session.userId;

    this.auditService.log({
      actor_user_id: userId,
      action: 'user.logout',
      resource_type: 'user',
      resource_id: userId,
      ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    await promisify(req.session.destroy.bind(req.session))();
  }

  async me(
    userId: string,
  ): Promise<{ id: string; email: string; lastLoginAt: Date | null }> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
