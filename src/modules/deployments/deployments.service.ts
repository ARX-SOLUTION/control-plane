import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { DEPLOYMENT_QUEUE_TOKEN } from '@/infrastructure/queue/queue.constants';
import { deployments } from '@/infrastructure/persistence/main.schema';
import { AuditService } from '@/core/audit';
import { EnvironmentsService } from '../environments/environments.service';
import { NotFoundException, ConflictException } from '@/shared/exceptions';
import type { CreateDeploymentDto } from './dto/create-deployment.dto';

const TERMINAL_STATUSES = ['success', 'failed', 'rolled_back'] as const;

@Injectable()
export class DeploymentsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    @Inject(DEPLOYMENT_QUEUE_TOKEN) private readonly queue: Queue,
    private readonly auditService: AuditService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  async create(dto: CreateDeploymentDto, userId: string | null) {
    await this.environmentsService.findOne(dto.environmentId);

    const existing = await this.db
      .select({ id: deployments.id, status: deployments.status })
      .from(deployments)
      .where(eq(deployments.environmentId, dto.environmentId));

    const hasInflight = existing.some(
      (r) => !(TERMINAL_STATUSES as readonly string[]).includes(r.status),
    );

    if (hasInflight) {
      throw new ConflictException(
        'A deployment is already in progress for this environment',
      );
    }

    const [deployment] = await this.db
      .insert(deployments)
      .values({
        environmentId: dto.environmentId,
        status: 'pending',
        branch: dto.branch ?? null,
        deployedById: userId,
      })
      .returning();

    await this.queue.add(
      'deploy',
      { deploymentId: deployment.id },
      { jobId: deployment.id },
    );

    if (userId) {
      this.auditService.log({
        actor_user_id: userId,
        action: 'deployment.create',
        resource_type: 'deployment',
        resource_id: deployment.id,
        metadata: { environmentId: dto.environmentId },
      });
    }

    return deployment;
  }

  async findAll(environmentId?: string) {
    if (environmentId) {
      return this.db
        .select()
        .from(deployments)
        .where(eq(deployments.environmentId, environmentId));
    }
    return this.db.select().from(deployments);
  }

  async findOne(id: string) {
    const [deployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    if (!deployment) {
      throw new NotFoundException(`Deployment ${id} not found`);
    }

    return deployment;
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<typeof deployments.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(deployments)
      .set({ status, ...extra })
      .where(eq(deployments.id, id));
  }

  async cancel(id: string, userId: string): Promise<void> {
    const deployment = await this.findOne(id);

    if (deployment.status !== 'pending') {
      throw new ConflictException('Only pending deployments can be cancelled');
    }

    await this.queue.remove(id);

    await this.updateStatus(id, 'failed', {
      errorMessage: 'Cancelled by user',
      completedAt: new Date(),
    });

    this.auditService.log({
      actor_user_id: userId,
      action: 'deployment.rollback',
      resource_type: 'deployment',
      resource_id: id,
    });
  }
}
