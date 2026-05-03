import { Inject } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import {
  DEPLOYMENT_QUEUE_NAME,
  REDIS_CLIENT_TOKEN,
} from '@/infrastructure/queue/queue.constants';
import {
  deployments,
  environments,
  projects,
} from '@/infrastructure/persistence/main.schema';
import { GitService } from '@/infrastructure/git/git.service';
import { DockerService } from '@/infrastructure/docker/docker.service';
import { CaddyService } from '@/infrastructure/caddy/caddy.service';
import { ConfigService } from '@/core/config';
import { EnvVarsService } from '../env-vars/env-vars.service';
import { DeploymentsService } from './deployments.service';
import { MessagingService } from '@/infrastructure/messaging';

export interface DeploymentJobData {
  deploymentId: string;
}

export class DeploymentProcessor {
  private readonly worker: Worker;

  constructor(
    private readonly svc: DeploymentsService,
    private readonly git: GitService,
    private readonly caddy: CaddyService,
    private readonly docker: DockerService,
    private readonly envVarsService: EnvVarsService,
    @Inject(DB_TOKEN) private readonly db: PostgresJsDatabase,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
    private readonly messaging: MessagingService,
    private readonly configService: ConfigService,
  ) {
    this.worker = new Worker<DeploymentJobData>(
      DEPLOYMENT_QUEUE_NAME,
      this.process.bind(this),
      {
        connection: this.redis,
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[DeploymentProcessor] job ${job?.id} failed:`, err.message);
    });
  }

  private async process(job: Job<DeploymentJobData>): Promise<void> {
    try {
      await this.run(job.data.deploymentId);
    } catch (err) {
      await this.fail(job.data.deploymentId, err);
    }
  }

  private async run(deploymentId: string): Promise<void> {
    const { deployment, environment, project } =
      await this.loadContext(deploymentId);

    const branch = deployment.branch ?? project.branch ?? 'main';

    // Determine blue/green colors
    const blueRunning = await this.docker.isContainerRunning(
      `app_${project.id}_blue`,
    );
    const newColor = blueRunning ? 'green' : 'blue';
    const oldName = blueRunning ? `app_${project.id}_blue` : null;
    const newName = `app_${project.id}_${newColor}`;
    const imageName = `app_${project.id}_${newColor}:${deploymentId}`;

    // Step: cloning
    await this.svc.updateStatus(deploymentId, 'cloning', {
      startedAt: new Date(),
    });
    const repoPath = await this.git.cloneOrFetch(
      project.id,
      project.githubUrl!,
      branch,
    );
    const { hash, message } = await this.git.getCurrentCommit(project.id);

    // Step: building
    await this.svc.updateStatus(deploymentId, 'building', {
      commitHash: hash,
      commitMessage: message,
    });
    const buildLogs: string[] = [];
    await this.docker.buildImage({
      contextPath: repoPath,
      imageName,
      onLog: (l) => buildLogs.push(l),
    });

    // Step: starting
    await this.svc.updateStatus(deploymentId, 'starting', {
      buildLogs: buildLogs.join('\n'),
    });
    const vars = await this.envVarsService.getActiveVarsForEnvironment(
      deployment.environmentId,
    );
    const varMap = Object.fromEntries(vars.map((v) => [v.key, v.value]));
    const containerId = await this.docker.createContainer({
      imageName,
      containerName: newName,
      envVars: varMap,
      networkName: this.configService.get('INGRESS_NETWORK'),
    });
    await this.docker.startContainer(containerId);

    // Step: health_check
    await this.svc.updateStatus(deploymentId, 'health_check', {
      containerName: newName,
    });
    const ip = await this.docker.getContainerInternalIp(newName, this.configService.get('INGRESS_NETWORK'));
    const healthPath = project.healthCheckPath ?? '/';
    const healthInterval = project.healthCheckInterval ?? 30;
    await this.pollHealth(`http://${ip}${healthPath}`, healthInterval);

    // Step: switching — update Caddy upstream for all active domains of this environment
    await this.svc.updateStatus(deploymentId, 'switching');
    const appPort = project.appPort ?? 3000;
    const upstream = `${ip}:${appPort}`;
    const routeId = `route_env_${deployment.environmentId}`;
    try {
      await this.caddy.updateUpstream(routeId, upstream);
    } catch (err) {
      // Route may not exist yet (first deploy with no domain configured) — non-fatal
      console.warn(`[Caddy] updateUpstream skipped: ${(err as Error).message}`);
    }

    // Done
    await this.svc.updateStatus(deploymentId, 'success', {
      completedAt: new Date(),
    });

    void this.messaging.publish('control_plane', 'deployment.success', {
      type: 'deployment.success',
      projectName: project.name,
      environmentName: environment.name,
      deploymentId,
    });

    // Stop old container
    if (oldName) {
      await this.docker.stopContainer(oldName).catch((err) => {
        console.warn(`[DeploymentProcessor] could not stop ${oldName}:`, err.message);
      });
    }
  }

  private async fail(deploymentId: string, err: unknown): Promise<void> {
    const [dep] = await this.db
      .select({ containerName: deployments.containerName })
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (dep?.containerName) {
      await this.docker.removeContainer(dep.containerName).catch(() => {});
    }

    const errorMessage = err instanceof Error ? err.message : String(err);

    await this.svc.updateStatus(deploymentId, 'failed', {
      errorMessage,
      completedAt: new Date(),
    });

    void this.loadContext(deploymentId)
      .then(({ project, environment }) =>
        this.messaging.publish('control_plane', 'deployment.failed', {
          type: 'deployment.failed',
          projectName: project.name,
          environmentName: environment.name,
          deploymentId,
          message: errorMessage,
        }),
      )
      .catch(() => {});
  }

  private async pollHealth(url: string, timeoutSecs: number): Promise<void> {
    const deadline = Date.now() + timeoutSecs * 1000;
    const interval = 2000;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return;
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Health check timed out after ${timeoutSecs}s: ${url}`);
  }

  private async loadContext(deploymentId: string) {
    const [deployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

    const [environment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, deployment.environmentId))
      .limit(1);

    if (!environment)
      throw new Error(`Environment ${deployment.environmentId} not found`);

    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, environment.projectId))
      .limit(1);

    if (!project)
      throw new Error(`Project ${environment.projectId} not found`);

    return { deployment, environment, project };
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
