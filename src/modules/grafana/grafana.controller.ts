import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/core/auth/auth.guard';
import { GrafanaService } from './grafana.service';

@UseGuards(AuthGuard)
@Controller('grafana')
export class GrafanaController {
  constructor(private readonly grafanaService: GrafanaService) {}

  @Get('config')
  getConfig() {
    return this.grafanaService.getConfig();
  }

  @Get('panel')
  getPanel(
    @Query('dashboard') dashboard: string,
    @Query('panelId', ParseIntPipe) panelId: number,
  ) {
    const url = this.grafanaService.getPanelUrl(dashboard, panelId);
    return { url };
  }
}
