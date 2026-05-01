import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';

@Global()
@Module({
  imports: [PersistenceModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
