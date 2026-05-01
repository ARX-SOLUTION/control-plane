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
  UsePipes,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { createProjectSchema } from './dto/create-project.dto';
import type { CreateProjectDto } from './dto/create-project.dto';
import { updateProjectSchema } from './dto/update-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { AuthGuard } from '@/core/auth/auth.guard';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  create(@Body() createProjectDto: CreateProjectDto, @Request() req) {
    return this.projectsService.create(createProjectDto, req.user.id);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateProjectSchema))
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req,
  ) {
    return this.projectsService.update(id, updateProjectDto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.projectsService.delete(id, req.user.id);
  }
}
