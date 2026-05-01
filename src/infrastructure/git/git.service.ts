import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import * as path from 'path';
import { simpleGit, ResetMode } from 'simple-git';

@Injectable()
export class GitService {
  private readonly baseDir = '/data/repos';

  async cloneOrFetch(
    projectId: string,
    repoUrl: string,
    branch: string,
  ): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });
    const repoPath = path.join(this.baseDir, projectId);

    if (!existsSync(repoPath)) {
      await simpleGit().clone(repoUrl, repoPath, [
        '--branch',
        branch,
        '--single-branch',
      ]);
    } else {
      const git = simpleGit(repoPath);
      await git.fetch('origin', branch);
      await git.reset(ResetMode.HARD, [`origin/${branch}`]);
    }

    return repoPath;
  }

  async getCurrentCommit(
    projectId: string,
  ): Promise<{ hash: string; message: string }> {
    const git = simpleGit(path.join(this.baseDir, projectId));
    const log = await git.log({ maxCount: 1 });
    return {
      hash: log.latest?.hash ?? '',
      message: log.latest?.message ?? '',
    };
  }

  async listBranches(repoUrl: string): Promise<string[]> {
    const raw = await simpleGit().listRemote(['--heads', repoUrl]);
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t')[1]?.replace('refs/heads/', '') ?? '')
      .filter(Boolean);
  }
}
