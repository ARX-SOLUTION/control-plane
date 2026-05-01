import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@/core/config';
import { spawn } from 'child_process';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = '/data/backups';

  constructor(private readonly configService: ConfigService) {}

  async runBackup(): Promise<{ files: string[] }> {
    await mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mainFile = join(this.backupDir, `main_${timestamp}.sql.gz`);
    const auditFile = join(this.backupDir, `audit_${timestamp}.sql.gz`);

    const mainUrl = this.configService.get('DATABASE_URL');
    const auditUrl = this.configService.get('AUDIT_DATABASE_URL');

    await Promise.all([
      this.pgDump(mainUrl, mainFile),
      this.pgDump(auditUrl, auditFile),
    ]);

    this.logger.log(`Backup created: ${mainFile}, ${auditFile}`);
    return { files: [mainFile, auditFile] };
  }

  async listBackups(): Promise<{ name: string; sizeBytes: number; createdAt: string }[]> {
    try {
      const entries = await readdir(this.backupDir);
      const stats = await Promise.all(
        entries.map(async (name) => {
          const s = await stat(join(this.backupDir, name));
          return { name, sizeBytes: s.size, createdAt: s.mtime.toISOString() };
        }),
      );
      return stats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async deleteBackup(name: string): Promise<void> {
    if (!/^[\w\-\.]+\.sql\.gz$/.test(name)) {
      throw new BadRequestException('Invalid backup name');
    }
    const filePath = join(this.backupDir, name);
    try {
      await unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(`Backup not found: ${name}`);
      }
      throw err;
    }
  }

  private pgDump(dbUrl: string, outFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = `pg_dump '${dbUrl}' --format=plain | gzip > '${outFile}'`;
      const child = spawn(cmd, { shell: true });

      child.stderr.on('data', (data: Buffer) => {
        this.logger.warn(`pg_dump stderr: ${data.toString().trim()}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed with exit code ${code} for ${outFile}`));
        }
      });

      child.on('error', reject);
    });
  }
}
