import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc } from 'drizzle-orm';
import { envVars } from '@/infrastructure/persistence/main.schema';
import { AuditService } from '@/core/audit';
import { CryptoService } from '@/core/crypto/crypto.service';
import { EnvironmentsService } from '../environments/environments.service';
import { CreateEnvVarDto } from './dto/create-env-var.dto';
import { UpdateEnvVarDto } from './dto/update-env-var.dto';

@Injectable()
export class EnvVarsService {
  constructor(
    @Inject(DB_TOKEN)
    private readonly db: PostgresJsDatabase,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  async create(dto: CreateEnvVarDto, userId: string) {
    // Verify environment exists
    const environment = await this.environmentsService.findOne(
      dto.environmentId,
    );

    // Check if env var with same key exists in this environment
    const existing = await this.db
      .select()
      .from(envVars)
      .where(
        and(
          eq(envVars.environmentId, dto.environmentId),
          eq(envVars.key, dto.key),
          eq(envVars.isActive, true),
        ),
      )
      .limit(1);

    let version = 1;
    if (existing.length > 0) {
      // Create new version instead of throwing error
      version = existing[0].version + 1;
      // Deactivate old version
      await this.db
        .update(envVars)
        .set({ isActive: false })
        .where(eq(envVars.id, existing[0].id));
    }

    // Encrypt the value
    const encrypted = this.cryptoService.encrypt(dto.value);

    const [envVar] = await this.db
      .insert(envVars)
      .values({
        environmentId: dto.environmentId,
        key: dto.key,
        ciphertext: encrypted.ciphertext,
        encryptedDek: encrypted.encrypted_dek,
        iv: encrypted.iv,
        authTag: encrypted.auth_tag,
        keyVersion: encrypted.key_version,
        version,
        createdById: userId,
      })
      .returning();

    await this.auditService.log({
      actor_user_id: userId,
      action: 'env_var.create',
      resource_type: 'env_var',
      resource_id: envVar.id,
      metadata: {
        environmentId: dto.environmentId,
        key: dto.key,
        version,
      },
    });

    // Return without sensitive data
    const { ciphertext, encryptedDek, iv, authTag, ...safeEnvVar } = envVar;
    return safeEnvVar;
  }

  async findAll(environmentId?: string) {
    const query = environmentId
      ? this.db
          .select({
            id: envVars.id,
            environmentId: envVars.environmentId,
            key: envVars.key,
            version: envVars.version,
            isActive: envVars.isActive,
            createdAt: envVars.createdAt,
            createdById: envVars.createdById,
          })
          .from(envVars)
          .where(eq(envVars.environmentId, environmentId))
      : this.db
          .select({
            id: envVars.id,
            environmentId: envVars.environmentId,
            key: envVars.key,
            version: envVars.version,
            isActive: envVars.isActive,
            createdAt: envVars.createdAt,
            createdById: envVars.createdById,
          })
          .from(envVars);

    return query.orderBy(desc(envVars.createdAt));
  }

  async findOne(id: string) {
    const [envVar] = await this.db
      .select({
        id: envVars.id,
        environmentId: envVars.environmentId,
        key: envVars.key,
        version: envVars.version,
        isActive: envVars.isActive,
        createdAt: envVars.createdAt,
        createdById: envVars.createdById,
      })
      .from(envVars)
      .where(eq(envVars.id, id))
      .limit(1);

    if (!envVar) {
      throw new NotFoundException(
        `Environment variable with id '${id}' not found`,
      );
    }

    return envVar;
  }

  async reveal(id: string, userId: string) {
    const [envVar] = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.id, id))
      .limit(1);

    if (!envVar) {
      throw new NotFoundException(
        `Environment variable with id '${id}' not found`,
      );
    }

    // Audit the reveal action
    await this.auditService.log({
      actor_user_id: userId,
      action: 'env_var.reveal',
      resource_type: 'env_var',
      resource_id: id,
      metadata: {
        environmentId: envVar.environmentId,
        key: envVar.key,
      },
    });

    // Decrypt the value
    const decrypted = this.cryptoService.decrypt({
      ciphertext: envVar.ciphertext,
      encrypted_dek: envVar.encryptedDek,
      iv: envVar.iv,
      auth_tag: envVar.authTag,
      key_version: envVar.keyVersion,
    });

    return {
      id: envVar.id,
      key: envVar.key,
      value: decrypted,
      version: envVar.version,
    };
  }

  async update(id: string, dto: UpdateEnvVarDto, userId: string) {
    const existing = await this.findOne(id);

    if (dto.value !== undefined) {
      // Create new version with updated value
      const fullEnvVar = await this.db
        .select()
        .from(envVars)
        .where(eq(envVars.id, id))
        .limit(1);

      return this.create(
        {
          environmentId: fullEnvVar[0].environmentId,
          key: fullEnvVar[0].key,
          value: dto.value,
        },
        userId,
      );
    }

    // Just update active status
    const [updated] = await this.db
      .update(envVars)
      .set({ isActive: dto.isActive })
      .where(eq(envVars.id, id))
      .returning({
        id: envVars.id,
        environmentId: envVars.environmentId,
        key: envVars.key,
        version: envVars.version,
        isActive: envVars.isActive,
        createdAt: envVars.createdAt,
      });

    await this.auditService.log({
      actor_user_id: userId,
      action: 'env_var.update',
      resource_type: 'env_var',
      resource_id: id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const envVar = await this.findOne(id);

    // Soft delete by deactivating
    await this.db
      .update(envVars)
      .set({ isActive: false })
      .where(eq(envVars.id, id));

    await this.auditService.log({
      actor_user_id: userId,
      action: 'env_var.delete',
      resource_type: 'env_var',
      resource_id: id,
      metadata: {
        environmentId: envVar.environmentId,
        key: envVar.key,
      },
    });

    return { success: true };
  }

  async getActiveVarsForEnvironment(environmentId: string) {
    const vars = await this.db
      .select()
      .from(envVars)
      .where(
        and(
          eq(envVars.environmentId, environmentId),
          eq(envVars.isActive, true),
        ),
      );

    // Decrypt all values
    const decrypted = vars.map((v) => {
        const value = this.cryptoService.decrypt({
          ciphertext: v.ciphertext,
          encrypted_dek: v.encryptedDek,
          iv: v.iv,
          auth_tag: v.authTag,
          key_version: v.keyVersion,
        });
        return { key: v.key, value };
      });

    return decrypted;
  }
}
