import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { databases } from '@/infrastructure/persistence/main.schema';
import { DockerService } from '@/infrastructure/docker/docker.service';
import { CryptoService } from '@/core/crypto/crypto.service';
import { AuditService } from '@/core/audit';
import { NotFoundException, ConflictException } from '@/shared/exceptions';
import type { CreateDatabaseDto } from './dto/create-database.dto';

const PG_PORT = 5432;
const REDIS_PORT = 6379;
const PG_IMAGE = 'postgres:16-alpine';
const REDIS_IMAGE = 'redis:7-alpine';

@Injectable()
export class DatabasesService {
  private readonly logger = new Logger(DatabasesService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    private readonly docker: DockerService,
    private readonly crypto: CryptoService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDatabaseDto, userId: string) {
    // Unique name check
    const existing = await this.db
      .select({ id: databases.id })
      .from(databases)
      .where(eq(databases.name, dto.name))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Database name "${dto.name}" already in use`);
    }

    const containerName = `db_${dto.projectId.slice(0, 8)}_${dto.name}`;
    const networkName = `proj_${dto.projectId}_net`;
    const password = randomBytes(16).toString('hex');
    const username = dto.type === 'postgres' ? dto.name : undefined;
    const port = dto.type === 'postgres' ? PG_PORT : REDIS_PORT;

    // Ensure project network exists (may not exist if no deployment yet)
    await this.docker.ensureNetwork(networkName);

    // Provision container
    if (dto.type === 'postgres') {
      await this.provisionPostgres(containerName, dto.name, username!, password, networkName);
    } else {
      await this.provisionRedis(containerName, password, networkName);
    }

    // Encrypt password
    const encrypted = this.crypto.encrypt(password);

    const [database] = await this.db
      .insert(databases)
      .values({
        projectId: dto.projectId,
        type: dto.type,
        name: dto.name,
        containerName,
        username: username ?? null,
        passwordCiphertext: encrypted.ciphertext,
        passwordEncryptedDek: encrypted.encrypted_dek,
        passwordIv: encrypted.iv,
        passwordAuthTag: encrypted.auth_tag,
        passwordKeyVersion: encrypted.key_version,
        host: containerName,
        port,
      })
      .returning();

    this.auditService.log({
      actor_user_id: userId,
      action: 'project.create',
      resource_type: 'database',
      resource_id: database.id,
      metadata: { type: dto.type, name: dto.name },
    });

    return database;
  }

  async findAll(projectId?: string) {
    if (projectId) {
      return this.db
        .select()
        .from(databases)
        .where(eq(databases.projectId, projectId));
    }
    return this.db.select().from(databases);
  }

  async findOne(id: string) {
    const [db] = await this.db
      .select()
      .from(databases)
      .where(eq(databases.id, id))
      .limit(1);

    if (!db) throw new NotFoundException(`Database ${id} not found`);
    return db;
  }

  async getConnectionString(id: string): Promise<string> {
    const database = await this.findOne(id);

    if (
      !database.passwordCiphertext ||
      !database.passwordEncryptedDek ||
      !database.passwordIv ||
      !database.passwordAuthTag ||
      database.passwordKeyVersion === null
    ) {
      throw new NotFoundException('Database credentials not stored');
    }

    const password = this.crypto.decrypt({
      ciphertext: database.passwordCiphertext,
      encrypted_dek: database.passwordEncryptedDek,
      iv: database.passwordIv,
      auth_tag: database.passwordAuthTag,
      key_version: database.passwordKeyVersion,
    });

    if (database.type === 'postgres') {
      return `postgresql://${database.username}:${password}@${database.host}:${database.port}/${database.name}`;
    }

    // Redis
    return `redis://:${password}@${database.host}:${database.port}`;
  }

  async delete(id: string, userId: string): Promise<void> {
    const database = await this.findOne(id);

    await this.docker.stopContainer(database.containerName).catch((err) => {
      this.logger.warn(`Could not stop container ${database.containerName}: ${(err as Error).message}`);
    });

    await this.db.delete(databases).where(eq(databases.id, id));

    this.auditService.log({
      actor_user_id: userId,
      action: 'project.delete',
      resource_type: 'database',
      resource_id: id,
      metadata: { name: database.name, type: database.type },
    });
  }

  private async provisionPostgres(
    containerName: string,
    dbName: string,
    username: string,
    password: string,
    networkName: string,
  ): Promise<void> {
    const containerId = await this.docker.createContainer({
      imageName: PG_IMAGE,
      containerName,
      envVars: {
        POSTGRES_DB: dbName,
        POSTGRES_USER: username,
        POSTGRES_PASSWORD: password,
      },
      networkName,
    });
    await this.docker.startContainer(containerId);
  }

  private async provisionRedis(
    containerName: string,
    password: string,
    networkName: string,
  ): Promise<void> {
    const containerId = await this.docker.createContainer({
      imageName: REDIS_IMAGE,
      containerName,
      envVars: {},
      networkName,
      command: ['redis-server', '--requirepass', password],
    });
    await this.docker.startContainer(containerId);
  }
}
