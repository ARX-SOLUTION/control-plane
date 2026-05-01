import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/core/config';
import type { QueryInstantDto, QueryRangeDto } from './dto/query-metrics.dto';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly configService: ConfigService) {}

  private getPrometheusUrl(): string {
    const url = this.configService.get('PROMETHEUS_URL');
    if (!url) throw new Error('PROMETHEUS_URL not configured');
    return url;
  }

  async query(dto: QueryInstantDto): Promise<unknown> {
    const base = this.getPrometheusUrl();
    const params = new URLSearchParams({ query: dto.query });
    if (dto.time) params.set('time', dto.time);

    const res = await fetch(`${base}/api/v1/query?${params}`);
    return res.json();
  }

  async queryRange(dto: QueryRangeDto): Promise<unknown> {
    const base = this.getPrometheusUrl();
    const params = new URLSearchParams({
      query: dto.query,
      start: dto.start,
      end: dto.end,
      step: dto.step,
    });

    const res = await fetch(`${base}/api/v1/query_range?${params}`);
    return res.json();
  }

  async receiveAlert(payload: unknown): Promise<void> {
    this.logger.warn({ alert: payload }, 'Alert received');
  }
}
