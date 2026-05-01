import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './core/config/config.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { EnvVarsModule } from './modules/env-vars/env-vars.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { DomainsModule } from './modules/domains/domains.module';
import { DatabasesModule } from './modules/databases/databases.module';
import { LogsModule } from './modules/logs/logs.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { VcsModule } from './modules/vcs/vcs.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BackupModule } from './modules/backup/backup.module';
import { GrafanaModule } from './modules/grafana/grafana.module';

@Module({
  imports: [
    ConfigModule,
    PersistenceModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    QueueModule,
    MessagingModule,
    ProjectsModule,
    EnvironmentsModule,
    EnvVarsModule,
    DeploymentsModule,
    DomainsModule,
    DatabasesModule,
    LogsModule,
    MonitoringModule,
    VcsModule,
    NotificationsModule,
    BackupModule,
    GrafanaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
