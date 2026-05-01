import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@/core/auth/auth.guard';
import { BackupService } from './backup.service';

@UseGuards(AuthGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  @HttpCode(200)
  trigger() {
    return this.backupService.runBackup();
  }

  @Get()
  list() {
    return this.backupService.listBackups();
  }

  @Delete(':name')
  @HttpCode(204)
  delete(@Param('name') name: string) {
    return this.backupService.deleteBackup(name);
  }
}
