import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/core/config';

interface DnsRecord {
  type: 'A' | 'CNAME';
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';
  private readonly token: string | undefined;
  private readonly defaultZoneId: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get('CLOUDFLARE_API_TOKEN');
    this.defaultZoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
  }

  // Create an A record pointing domain → serverIp.
  // Returns the new record ID.
  async createARecord(
    domain: string,
    serverIp: string,
    zoneId?: string,
  ): Promise<string> {
    this.assertConfigured();
    const zone = zoneId ?? this.defaultZoneId!;

    const body: DnsRecord = {
      type: 'A',
      name: domain,
      content: serverIp,
      proxied: false,
      ttl: 1, // automatic
    };

    const res = await this.call('POST', `/zones/${zone}/dns_records`, body);
    return (res.result as { id: string }).id;
  }

  async deleteRecord(recordId: string, zoneId?: string): Promise<void> {
    this.assertConfigured();
    const zone = zoneId ?? this.defaultZoneId!;
    await this.call('DELETE', `/zones/${zone}/dns_records/${recordId}`);
  }

  async listRecords(zoneId?: string): Promise<{ id: string; name: string; content: string }[]> {
    this.assertConfigured();
    const zone = zoneId ?? this.defaultZoneId!;
    const res = await this.call('GET', `/zones/${zone}/dns_records`);
    return res.result as { id: string; name: string; content: string }[];
  }


  private assertConfigured(): void {
    if (!this.token || !this.defaultZoneId) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID must be set to use CloudflareService',
      );
    }
  }

  private async call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ result: unknown }> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare API ${method} ${path} failed (${res.status}): ${text}`);
    }

    if (method === 'DELETE') return { result: null };

    const json = (await res.json()) as { success: boolean; result: unknown; errors: unknown[] };
    if (!json.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(json.errors)}`);
    }

    return json as { result: unknown };
  }
}
