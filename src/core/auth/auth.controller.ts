import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import { loginSchema, type LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, req);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@Req() req: Request) {
    return this.authService.logout(req);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return this.authService.me((req as any).user.id);
  }
}
