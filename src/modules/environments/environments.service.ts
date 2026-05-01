import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { environments } from '@/infrastructure/persistence/main.schema';
import { AuditService } from '@/core/audit';
import { ProjectsService } from '../projects/projects.service';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(
    @Inject(DB_TOKEN)
    private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(dto: CreateEnvironmentDto, userId: string) {
    // Verify project exists
    await this.projectsService.findOne(dto.projectId);

    // Check if environment already exists for this project
    const existing = await this.db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, dto.projectId),
          eq(environments.name, dto.name),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        `Environment '${dto.name}' already exists for this project`,
      );
    }

    const [environment] = await this.db
      .insert(environments)
      .values({
        projectId: dto.projectId,
        name: dto.name,
        displayName: dto.displayName,
      })
      .returning();

    await this.auditService.log({
      actor_user_id: userId,
      action: 'environment.create',
      resource_type: 'environment',
      resource_id: environment.id,
      metadata: {
        projectId: dto.projectId,
        environmentName: dto.name,
      },
    });

    return environment;
  }

  async findAll(projectId?: string) {
    if (projectId) {
      return this.db
        .select()
        .from(environments)
        .where(eq(environments.projectId, projectId))
        .orderBy(environments.name);
    }
    return this.db.select().from(environments).orderBy(environments.createdAt);
  }

  async findOne(id: string) {
    const [environment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, id))
      .limit(1);

    if (!environment) {
      throw new NotFoundException(`Environment with id '${id}' not found`);
    }

    return environment;
  }

  async findByProjectAndName(projectId: string, name: string) {
    const [environment] = await this.db
      .select()
      .from(environments)
      .where(
        and(eq(environments.projectId, projectId), eq(environments.name, name)),
      )
      .limit(1);

    if (!environment) {
      throw new NotFoundException(
        `Environment '${name}' not found for project`,
      );
    }

    return environment;
  }

  async update(id: string, dto: UpdateEnvironmentDto, userId: string) {
    const existing = await this.findOne(id);

    const [updated] = await this.db
      .update(environments)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, id))
      .returning();

    await this.auditService.log({
      actor_user_id: userId,
      action: 'environment.update',
      resource_type: 'environment',
      resource_id: id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const environment = await this.findOne(id);

    await this.db.delete(environments).where(eq(environments.id, id));

    await this.auditService.log({
      actor_user_id: userId,
      action: 'environment.delete',
      resource_type: 'environment',
      resource_id: id,
      metadata: {
        projectId: environment.projectId,
        environmentName: environment.name,
      },
    });

    return { success: true };
  }
}
