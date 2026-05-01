import { Module } from '@nestjs/common';
import { GitModule } from '@/infrastructure/git/git.module';
import { DeploymentsModule } from '@/modules/deployments/deployments.module';
import { VcsService } from './vcs.service';
import { VcsController } from './vcs.controller';

@Module({
  imports: [GitModule, DeploymentsModule],
  providers: [VcsService],
  controllers: [VcsController],
})
export class VcsModule {}
