import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/core/auth';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { LogsService } from './logs.service';
import { queryLogsSchema, type QueryLogsDto } from './dto/query-logs.dto';

@UseGuards(AuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  query(@Query(new ZodValidationPipe(queryLogsSchema)) dto: QueryLogsDto) {
    return this.logsService.query(dto);
  }
}
