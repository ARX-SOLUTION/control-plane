import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/core/config';

@Injectable()
export class CaddyService {
  private readonly logger = new Logger(CaddyService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('CADDY_ADMIN_URL');
  }

  // Add or replace a reverse_proxy route for an environment.
  // routeId: e.g. "route_env_<envId>"
  // domain: "example.com"
  // upstream: "ip:port"
  async upsertRoute(routeId: string, domain: string, upstream: string): Promise<void> {
    const route = this.buildRoute(routeId, domain, upstream);

    // Try DELETE first (idempotent) then POST
    await this.deleteRoute(routeId).catch(() => {});

    const res = await fetch(
      `${this.baseUrl}/config/apps/http/servers/cp/routes/...`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Caddy upsertRoute failed (${res.status}): ${text}`);
    }
  }

  // Update only the upstream of an existing route (used during blue-green switch).
  async updateUpstream(routeId: string, upstream: string): Promise<void> {
    const upstreams = [{ dial: upstream }];
    const res = await fetch(`${this.baseUrl}/id/${routeId}/handle/0/upstreams`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`Caddy deleteRoute failed (${res.status}): ${text}`);
    }
  }

  async routeExists(routeId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/id/${routeId}`);
    return res.ok;
  }

  private buildRoute(routeId: string, domain: string, upstream: string) {
    return {
      '@id': routeId,
      match: [{ host: [domain] }],
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
