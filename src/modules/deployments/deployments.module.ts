import {
  Module,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { DB_TOKEN } from '@/infrastructure/persistence/persistence.module';
import {
  REDIS_CLIENT_TOKEN,
  DEPLOYMENT_QUEUE_TOKEN,
} from '@/infrastructure/queue/queue.constants';
import { GitModule } from '@/infrastructure/git/git.module';
import { GitService } from '@/infrastructure/git/git.service';
import { DockerModule } from '@/infrastructure/docker/docker.module';
import { DockerService } from '@/infrastructure/docker/docker.service';
import { CaddyModule } from '@/infrastructure/caddy/caddy.module';
import { CaddyService } from '@/infrastructure/caddy/caddy.service';
import { MessagingModule } from '@/infrastructure/messaging/messaging.module';
import { MessagingService } from '@/infrastructure/messaging';
import { EnvironmentsModule } from '../environments/environments.module';
import { EnvVarsModule } from '../env-vars/env-vars.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { DeploymentProcessor } from './deployment.processor';
import { EnvVarsService } from '../env-vars/env-vars.service';

@Module({
  imports: [GitModule, DockerModule, CaddyModule, EnvironmentsModule, EnvVarsModule, MessagingModule],
  controllers: [DeploymentsController],
  providers: [
    DeploymentsService,
    {
      provide: DeploymentProcessor,
      inject: [
        DeploymentsService,
        GitService,
        CaddyService,
        DockerService,
        EnvVarsService,
        DB_TOKEN,
        REDIS_CLIENT_TOKEN,
        MessagingService,
      ],
      useFactory: (
        svc: DeploymentsService,
        git: GitService,
        caddy: CaddyService,
        docker: DockerService,
        envVars: EnvVarsService,
        db: any,
        redis: any,
        messaging: MessagingService,
      ) => new DeploymentProcessor(svc, git, caddy, docker, envVars, db, redis, messaging),
    },
  ],
  exports: [DeploymentsService],
})
export class DeploymentsModule implements OnModuleDestroy {
  constructor(
    @Inject(DeploymentProcessor)
    private readonly processor: DeploymentProcessor,
  ) {}

  async onModuleDestroy() {
    await this.processor.close();
  }
}
