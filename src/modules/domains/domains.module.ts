import { Module } from '@nestjs/common';
import { CaddyModule } from '@/infrastructure/caddy/caddy.module';
import { CloudflareModule } from '@/infrastructure/cloudflare/cloudflare.module';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  imports: [CaddyModule, CloudflareModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
