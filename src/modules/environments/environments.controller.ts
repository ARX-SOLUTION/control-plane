import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UsePipes,
} from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { createEnvironmentSchema } from './dto/create-environment.dto';
import type { CreateEnvironmentDto } from './dto/create-environment.dto';
import { updateEnvironmentSchema } from './dto/update-environment.dto';
import type { UpdateEnvironmentDto } from './dto/update-environment.dto';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { AuthGuard } from '@/core/auth/auth.guard';

@Controller('environments')
@UseGuards(AuthGuard)
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEnvironmentSchema))
  create(@Body() createEnvironmentDto: CreateEnvironmentDto, @Request() req) {
    return this.environmentsService.create(createEnvironmentDto, req.user.id);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.environmentsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.environmentsService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateEnvironmentSchema))
  update(
    @Param('id') id: string,
    @Body() updateEnvironmentDto: UpdateEnvironmentDto,
    @Request() req,
  ) {
    return this.environmentsService.update(
      id,
      updateEnvironmentDto,
      req.user.id,
    );
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.environmentsService.delete(id, req.user.id);
  }
}
