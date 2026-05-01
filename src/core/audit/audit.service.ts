import { Injectable, Inject } from '@nestjs/common';
import { AUDIT_DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { auditEvents } from '@/infrastructure/persistence/audit.schema';
import { CreateAuditEventInput } from './types';

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_DB_TOKEN)
    private readonly auditDb: PostgresJsDatabase,
  ) {}

  async log(event: CreateAuditEventInput): Promise<void> {
    try {
      // Never include sensitive data in metadata
      const sanitizedMetadata = this.sanitizeMetadata(event.metadata);

      await this.auditDb.insert(auditEvents).values({
        actorUserId: event.actor_user_id,
        action: event.action,
        resourceType: event.resource_type,
        resourceId: event.resource_id,
        metadata: sanitizedMetadata,
        ip: event.ip,
        userAgent: event.user_agent,
      });
    } catch (error) {
      // Audit failures should not break the main flow
      console.error('Failed to log audit event:', error);
    }
  }

  private sanitizeMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'auth',
    ];
    const sanitized = { ...metadata };

    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
