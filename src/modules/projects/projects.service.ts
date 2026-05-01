import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { projects } from '@/infrastructure/persistence/main.schema';
import { AuditService } from '@/core/audit';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB_TOKEN)
    private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateProjectDto, userId: string) {
    // Check if project with same name exists
    const existing = await this.db
      .select()
      .from(projects)
      .where(eq(projects.name, dto.name))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        `Project with name '${dto.name}' already exists`,
      );
    }

    const [project] = await this.db
      .insert(projects)
      .values({
        name: dto.name,
        displayName: dto.displayName,
        githubUrl: dto.githubUrl,
        branch: dto.branch || 'main',
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        healthCheckPath: dto.healthCheckPath || '/',
        healthCheckInterval: dto.healthCheckInterval || 30,
        metadata: dto.metadata,
      })
      .returning();

    await this.auditService.log({
      actor_user_id: userId,
      action: 'project.create',
      resource_type: 'project',
      resource_id: project.id,
      metadata: { projectName: project.name },
    });

    return project;
  }

  async findAll() {
    return this.db.select().from(projects).orderBy(projects.createdAt);
  }

  async findOne(id: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with id '${id}' not found`);
    }

    return project;
  }

  async findByName(name: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.name, name))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with name '${name}' not found`);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const existing = await this.findOne(id);

    // Check name uniqueness if changing name
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.db
        .select()
        .from(projects)
        .where(eq(projects.name, dto.name))
        .limit(1);

      if (duplicate.length > 0) {
        throw new ConflictException(
          `Project with name '${dto.name}' already exists`,
        );
      }
    }

    const [updated] = await this.db
      .update(projects)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    await this.auditService.log({
      actor_user_id: userId,
      action: 'project.update',
      resource_type: 'project',
      resource_id: id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const project = await this.findOne(id);

    await this.db.delete(projects).where(eq(projects.id, id));

    await this.auditService.log({
      actor_user_id: userId,
      action: 'project.delete',
      resource_type: 'project',
      resource_id: id,
      metadata: { projectName: project.name },
    });

    return { success: true };
  }
}
