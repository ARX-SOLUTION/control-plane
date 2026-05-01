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
import { DatabasesService } from './databases.service';
import { AuthGuard } from '@/core/auth/auth.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { createDatabaseSchema, type CreateDatabaseDto } from './dto/create-database.dto';

@Controller('databases')
@UseGuards(AuthGuard)
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createDatabaseSchema)) dto: CreateDatabaseDto,
    @Req() req: Request,
  ) {
    return this.databasesService.create(dto, (req as any).user.id);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.databasesService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.databasesService.findOne(id);
  }

  @Post(':id/connection-string')
  getConnectionString(@Param('id') id: string) {
    return this.databasesService.getConnectionString(id).then((v) => ({ connectionString: v }));
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.databasesService.delete(id, (req as any).user.id);
  }
}
