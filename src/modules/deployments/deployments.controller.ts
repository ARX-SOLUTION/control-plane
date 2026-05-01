import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@/core/auth/auth.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { DeploymentsService } from './deployments.service';
import {
  createDeploymentSchema,
  type CreateDeploymentDto,
} from './dto/create-deployment.dto';

@Controller('deployments')
@UseGuards(AuthGuard)
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createDeploymentSchema)) dto: CreateDeploymentDto,
    @Req() req: Request,
  ) {
    return this.deploymentsService.create(dto, (req as any).user.id);
  }

  @Get()
  findAll(@Query('environmentId') environmentId?: string) {
    return this.deploymentsService.findAll(environmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deploymentsService.findOne(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Req() req: Request) {
    return this.deploymentsService.cancel(id, (req as any).user.id);
  }
}
