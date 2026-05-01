import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/core/config';

@Injectable()
export class GrafanaService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): {
    url: string | undefined;
    dashboards: { deployment: string | undefined; metrics: string | undefined };
  } {
    return {
      url: this.configService.get('GRAFANA_URL'),
      dashboards: {
        deployment: this.configService.get('GRAFANA_DEPLOYMENT_DASHBOARD'),
        metrics: this.configService.get('GRAFANA_METRICS_DASHBOARD'),
      },
    };
  }

  getPanelUrl(dashboard: string, panelId: number): string | null {
    const base = this.configService.get('GRAFANA_URL');
    if (!base || !dashboard) return null;
    return `${base}/d/${dashboard}?orgId=1&panelId=${panelId}&kiosk`;
  }
}
