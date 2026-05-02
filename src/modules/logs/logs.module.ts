import { LokiModule } from '@/infrastructure/loki/loki.module';
import { Module } from '@nestjs/common';
import { LogsUiController } from './logs-ui.controller';
import { LogsController } from './logs.controller';
import { LogsGateway } from './logs.gateway';
import { LogsService } from './logs.service';

@Module({
  imports: [LokiModule],
  providers: [LogsService, LogsGateway],
  controllers: [LogsController, LogsUiController],
  exports: [LogsService],
})
export class LogsModule {}
