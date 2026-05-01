import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/core/config';

export interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][];
}

export interface LokiQueryResult {
  stream: Record<string, string>;
  values: [string, string][];
}

@Injectable()
export class LokiService {
  private readonly logger = new Logger(LokiService.name);
  private readonly lokiUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.lokiUrl = this.configService.get('LOKI_URL');
    if (!this.lokiUrl) {
      this.logger.warn('LOKI_URL not set — Loki integration disabled');
    }
  }

  async push(streams: LokiStream[]): Promise<void> {
    if (!this.lokiUrl) {
      this.logger.warn('push() called but LOKI_URL is not configured');
      return;
    }

    const response = await fetch(`${this.lokiUrl}/loki/api/v1/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streams }),
    });

    if (!response.ok) {
      throw new Error(`Loki push failed: ${response.status} ${await response.text()}`);
    }
  }

  async queryRange(
    query: string,
    start: string,
    end: string,
    limit: number,
  ): Promise<LokiQueryResult[]> {
    if (!this.lokiUrl) {
      this.logger.warn('queryRange() called but LOKI_URL is not configured');
      return [];
    }

    const params = new URLSearchParams({ query, start, end, limit: String(limit) });
    const response = await fetch(`${this.lokiUrl}/loki/api/v1/query_range?${params}`);

    if (!response.ok) {
      throw new Error(`Loki query failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as {
      data: { result: LokiQueryResult[] };
    };

    return body.data.result;
  }
}
