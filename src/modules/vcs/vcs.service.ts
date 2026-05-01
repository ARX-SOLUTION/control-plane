import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as crypto from 'crypto';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import { projects, environments } from '@/infrastructure/persistence/main.schema';
import { CryptoService } from '@/core/crypto';
import { AuditService } from '@/core/audit';
import { GitService } from '@/infrastructure/git/git.service';
import { DeploymentsService } from '@/modules/deployments/deployments.service';
import { NotFoundException } from '@/shared/exceptions';

@Injectable()
export class VcsService {
  private readonly logger = new Logger(VcsService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly git: GitService,
    private readonly deployments: DeploymentsService,
  ) {}

  async generateWebhookSecret(projectId: string, userId: string): Promise<string> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const plaintext = crypto.randomBytes(32).toString('hex');
    const enc = this.crypto.encrypt(plaintext);

    await this.db
      .update(projects)
      .set({
        webhookSecretCiphertext: enc.ciphertext,
        webhookSecretEncryptedDek: enc.encrypted_dek,
        webhookSecretIv: enc.iv,
        webhookSecretAuthTag: enc.auth_tag,
        webhookSecretKeyVersion: enc.key_version,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await this.audit.log({
      actor_user_id: userId,
      action: 'vcs.webhook_secret.generate',
      resource_type: 'project',
      resource_id: projectId,
      metadata: {},
    });

    return plaintext;
  }

  async revokeWebhookSecret(projectId: string, userId: string): Promise<void> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    await this.db
      .update(projects)
      .set({
        webhookSecretCiphertext: null,
        webhookSecretEncryptedDek: null,
        webhookSecretIv: null,
        webhookSecretAuthTag: null,
        webhookSecretKeyVersion: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await this.audit.log({
      actor_user_id: userId,
      action: 'vcs.webhook_secret.revoke',
      resource_type: 'project',
      resource_id: projectId,
      metadata: {},
    });
  }

  async listBranches(projectId: string): Promise<string[]> {
    const [project] = await this.db
      .select({ githubUrl: projects.githubUrl })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubUrl) return [];

    return this.git.listBranches(project.githubUrl);
  }

  async handleGitHubWebhook(
    projectId: string,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    await this.verifyGitHubSignature(projectId, rawBody, signature);

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      ref?: string;
      after?: string;
      head_commit?: { message?: string };
    };

    const branch = payload.ref?.replace('refs/heads/', '');
    if (!branch) return;

    await this.triggerDeployments(projectId, branch);
  }

  async handleGitLabWebhook(
    projectId: string,
    rawBody: Buffer,
    token: string | undefined,
  ): Promise<void> {
    await this.verifyGitLabToken(projectId, token);

    const payload = JSON.parse(rawBody.toString('utf8')) as { ref?: string };
    const branch = payload.ref?.replace('refs/heads/', '');
    if (!branch) return;

    await this.triggerDeployments(projectId, branch);
  }

  private async verifyGitHubSignature(
    projectId: string,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    const secret = await this.getWebhookSecret(projectId);

    if (!secret) {
      this.logger.warn(`No webhook secret set for project ${projectId} — skipping signature check`);
      return;
    }

    if (!signature) throw new Error('Missing X-Hub-Signature-256 header');

    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error('Invalid GitHub webhook signature');
    }
  }

  private async verifyGitLabToken(
    projectId: string,
    token: string | undefined,
  ): Promise<void> {
    const secret = await this.getWebhookSecret(projectId);

    if (!secret) {
      this.logger.warn(`No webhook secret set for project ${projectId} — skipping token check`);
      return;
    }

    if (!token) throw new Error('Missing X-Gitlab-Token header');

    if (!crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(token))) {
      throw new Error('Invalid GitLab webhook token');
    }
  }

  private async getWebhookSecret(projectId: string): Promise<string | null> {
    const [project] = await this.db
      .select({
        ciphertext: projects.webhookSecretCiphertext,
        encryptedDek: projects.webhookSecretEncryptedDek,
        iv: projects.webhookSecretIv,
        authTag: projects.webhookSecretAuthTag,
        keyVersion: projects.webhookSecretKeyVersion,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project?.ciphertext) return null;

    return this.crypto.decrypt({
      ciphertext: project.ciphertext,
      encrypted_dek: project.encryptedDek!,
      iv: project.iv!,
      auth_tag: project.authTag!,
      key_version: project.keyVersion!,
    });
  }

  private async triggerDeployments(
    projectId: string,
    pushedBranch: string,
  ): Promise<void> {
    const [project] = await this.db
      .select({ branch: projects.branch })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.branch !== pushedBranch) {
      this.logger.log(
        `Push on ${pushedBranch} — not the project's deploy branch (${project?.branch}), skipping`,
      );
      return;
    }

    const envs = await this.db
      .select({ id: environments.id })
      .from(environments)
      .where(eq(environments.projectId, projectId));

    await Promise.allSettled(
      envs.map((env) =>
        this.deployments.create({ environmentId: env.id, branch: pushedBranch }, null),
      ),
    );
  }
}
