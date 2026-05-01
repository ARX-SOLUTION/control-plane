import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Req,
  Headers,
  HttpCode,
  UseGuards,
  } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@/core/auth/auth.guard';
import { VcsService } from './vcs.service';

@Controller('vcs')
export class VcsController {
  constructor(private readonly vcsService: VcsService) {}

  @UseGuards(AuthGuard)
  @Post(':projectId/webhook-secret')
  async generateSecret(@Param('projectId') projectId: string, @Req() req: Request) {
    const secret = await this.vcsService.generateWebhookSecret(projectId, req.session.userId!);
    return { secret };
  }

  @UseGuards(AuthGuard)
  @Delete(':projectId/webhook-secret')
  @HttpCode(204)
  async revokeSecret(@Param('projectId') projectId: string, @Req() req: Request) {
    await this.vcsService.revokeWebhookSecret(projectId, req.session.userId!);
  }

  @UseGuards(AuthGuard)
  @Get(':projectId/branches')
  async listBranches(@Param('projectId') projectId: string) {
    const branches = await this.vcsService.listBranches(projectId);
    return { branches };
  }

  @Post('webhook/github/:projectId')
  @HttpCode(200)
  async githubWebhook(
    @Param('projectId') projectId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    await this.vcsService.handleGitHubWebhook(projectId, req.rawBody ?? Buffer.alloc(0), signature);
    return { ok: true };
  }

  @Post('webhook/gitlab/:projectId')
  @HttpCode(200)
  async gitlabWebhook(
    @Param('projectId') projectId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-gitlab-token') token: string | undefined,
  ) {
    await this.vcsService.handleGitLabWebhook(projectId, req.rawBody ?? Buffer.alloc(0), token);
    return { ok: true };
  }
}
