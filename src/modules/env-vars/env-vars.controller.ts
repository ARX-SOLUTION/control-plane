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
import { EnvVarsService } from './env-vars.service';
import { createEnvVarSchema } from './dto/create-env-var.dto';
import type { CreateEnvVarDto } from './dto/create-env-var.dto';
import { updateEnvVarSchema } from './dto/update-env-var.dto';
import type { UpdateEnvVarDto } from './dto/update-env-var.dto';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { AuthGuard } from '@/core/auth/auth.guard';

@Controller('env-vars')
@UseGuards(AuthGuard)
export class EnvVarsController {
  constructor(private readonly envVarsService: EnvVarsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEnvVarSchema))
  create(@Body() createEnvVarDto: CreateEnvVarDto, @Request() req) {
    return this.envVarsService.create(createEnvVarDto, req.user.id);
  }

  @Get()
  findAll(@Query('environmentId') environmentId?: string) {
    return this.envVarsService.findAll(environmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.envVarsService.findOne(id);
  }

  @Post(':id/reveal')
  reveal(@Param('id') id: string, @Request() req) {
    return this.envVarsService.reveal(id, req.user.id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateEnvVarSchema))
  update(
    @Param('id') id: string,
    @Body() updateEnvVarDto: UpdateEnvVarDto,
    @Request() req,
  ) {
    return this.envVarsService.update(id, updateEnvVarDto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.envVarsService.delete(id, req.user.id);
  }
}
