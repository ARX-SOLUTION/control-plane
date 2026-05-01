import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AuthGuard } from '@/core/auth/auth.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import {
  queryInstantSchema,
  queryRangeSchema,
  type QueryInstantDto,
  type QueryRangeDto,
} from './dto/query-metrics.dto';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @UseGuards(AuthGuard)
  @Get('query')
  query(@Query(new ZodValidationPipe(queryInstantSchema)) dto: QueryInstantDto) {
    return this.monitoringService.query(dto);
  }

  @UseGuards(AuthGuard)
  @Get('query_range')
  queryRange(@Query(new ZodValidationPipe(queryRangeSchema)) dto: QueryRangeDto) {
    return this.monitoringService.queryRange(dto);
  }

  @Post('webhook')
  receiveAlert(@Body() payload: unknown) {
    return this.monitoringService.receiveAlert(payload);
  }
}
