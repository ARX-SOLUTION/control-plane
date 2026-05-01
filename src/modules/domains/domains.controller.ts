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
import { DomainsService } from './domains.service';
import { AuthGuard } from '@/core/auth/auth.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { createDomainSchema, type CreateDomainDto } from './dto/create-domain.dto';

@Controller('domains')
@UseGuards(AuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createDomainSchema)) dto: CreateDomainDto,
    @Req() req: Request,
  ) {
    return this.domainsService.create(dto, (req as any).user.id);
  }

  @Get()
  findAll(@Query('environmentId') environmentId?: string) {
    return this.domainsService.findAll(environmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domainsService.findOne(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.domainsService.delete(id, (req as any).user.id);
  }
}
