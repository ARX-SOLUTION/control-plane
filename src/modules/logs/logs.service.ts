import { Injectable } from '@nestjs/common';
import { LokiService, LokiQueryResult } from '@/infrastructure/loki/loki.service';
import type { QueryLogsDto } from './dto/query-logs.dto';

@Injectable()
export class LogsService {
  constructor(private readonly lokiService: LokiService) {}

  async query(dto: QueryLogsDto): Promise<LokiQueryResult[]> {
    return this.lokiService.queryRange(dto.query, dto.start, dto.end, dto.limit);
  }
}
