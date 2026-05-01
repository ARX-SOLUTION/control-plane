import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './core/config/config.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { AuditModule } from './core/audit/audit.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { EnvVarsModule } from './modules/env-vars/env-vars.module';

@Module({
  imports: [
    ConfigModule,
    PersistenceModule,
    CryptoModule,
    AuditModule,
    ProjectsModule,
    EnvironmentsModule,
    EnvVarsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
