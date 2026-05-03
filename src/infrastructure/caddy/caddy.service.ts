import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/core/config';

@Injectable()
export class CaddyService {
  private readonly logger = new Logger(CaddyService.name);
  private readonly baseUrl: string;

  private readonly headers = { 'Content-Type': 'application/json', Host: 'localhost' };

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('CADDY_ADMIN_URL');
  }

  async upsertRoute(routeId: string, domains: string[], upstream: string): Promise<void> {
    const route = this.buildRoute(routeId, domains, upstream);

    await this.deleteRoute(routeId).catch(() => {});

    const res = await fetch(
      `${this.baseUrl}/config/apps/http/servers/cp/routes/...`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(route),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Caddy upsertRoute failed (${res.status}): ${text}`);
    }
  }

  async getRouteUpstream(routeId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/id/${routeId}`, { headers: this.headers });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data?.handle?.[0]?.upstreams?.[0]?.dial ?? null;
    } catch {
      return null;
    }
  }

  async updateUpstream(routeId: string, upstream: string): Promise<void> {
    const upstreams = [{ dial: upstream }];
    const res = await fetch(`${this.baseUrl}/id/${routeId}/handle/0/upstreams`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(upstreams),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Caddy updateUpstream failed (${res.status}): ${text}`);
      throw new Error(`Caddy updateUpstream failed: ${text}`);
    }
  }

  async deleteRoute(routeId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/id/${routeId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`Caddy deleteRoute failed (${res.status}): ${text}`);
    }
  }

  async routeExists(routeId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/id/${routeId}`, { headers: this.headers });
    return res.ok;
  }

  private buildRoute(routeId: string, domains: string[], upstream: string) {
    return {
      '@id': routeId,
      match: [{ host: domains }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: upstream }],
          health_checks: {
            active: {
              uri: '/health',
              interval: '30s',
              timeout: '5s',
            },
          },
        },
      ],
      terminal: true,
    };
  }
}
