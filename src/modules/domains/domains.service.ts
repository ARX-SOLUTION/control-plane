import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { domains } from '@/infrastructure/persistence/main.schema';
import { CaddyService } from '@/infrastructure/caddy/caddy.service';
import { CloudflareService } from '@/infrastructure/cloudflare/cloudflare.service';
import { AuditService } from '@/core/audit';
import { NotFoundException } from '@/shared/exceptions';
import type { CreateDomainDto } from './dto/create-domain.dto';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    private readonly caddyService: CaddyService,
    private readonly cloudflareService: CloudflareService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDomainDto, userId: string) {
    let cloudflareRecordId: string | undefined;
    const zoneId = dto.cloudflareZoneId;

    // Create Cloudflare DNS record if serverIp provided
    if (dto.serverIp) {
      try {
        cloudflareRecordId = await this.cloudflareService.createARecord(
          dto.domain,
          dto.serverIp,
          zoneId,
        );
      } catch (err) {
        this.logger.warn(`Cloudflare DNS creation failed: ${(err as Error).message}`);
      }
    }

    // Add Caddy route for this environment
    const routeId = `route_env_${dto.environmentId}`;
    try {
      // Upstream will be set when a deployment completes (updateUpstream in processor)
      // For now add a placeholder route so the ID is registered
      await this.caddyService.upsertRoute(routeId, dto.domain, '127.0.0.1:3000');
    } catch (err) {
      this.logger.warn(`Caddy route creation failed: ${(err as Error).message}`);
    }

    const [domain] = await this.db
      .insert(domains)
      .values({
        environmentId: dto.environmentId,
        domain: dto.domain,
        cloudflareZoneId: zoneId ?? null,
        cloudflareRecordId: cloudflareRecordId ?? null,
      })
      .returning();

    this.auditService.log({
      actor_user_id: userId,
      action: 'project.create',
      resource_type: 'domain',
      resource_id: domain.id,
      metadata: { domain: dto.domain, environmentId: dto.environmentId },
    });

    return domain;
  }

  async findAll(environmentId?: string) {
    if (environmentId) {
      return this.db
        .select()
        .from(domains)
        .where(eq(domains.environmentId, environmentId));
    }
    return this.db.select().from(domains);
  }

  async findOne(id: string) {
    const [domain] = await this.db
      .select()
      .from(domains)
      .where(eq(domains.id, id))
      .limit(1);

    if (!domain) throw new NotFoundException(`Domain ${id} not found`);
    return domain;
  }

  async delete(id: string, userId: string): Promise<void> {
    const domain = await this.findOne(id);

    // Remove Cloudflare record
    if (domain.cloudflareRecordId) {
      try {
        await this.cloudflareService.deleteRecord(
          domain.cloudflareRecordId,
          domain.cloudflareZoneId ?? undefined,
        );
      } catch (err) {
        this.logger.warn(`Cloudflare DNS delete failed: ${(err as Error).message}`);
      }
    }

    // Remove Caddy route
    const routeId = `route_env_${domain.environmentId}`;
    try {
      await this.caddyService.deleteRoute(routeId);
    } catch (err) {
      this.logger.warn(`Caddy route delete failed: ${(err as Error).message}`);
    }

    await this.db.delete(domains).where(eq(domains.id, id));

    this.auditService.log({
      actor_user_id: userId,
      action: 'project.delete',
      resource_type: 'domain',
      resource_id: id,
      metadata: { domain: domain.domain },
    });
  }
}
