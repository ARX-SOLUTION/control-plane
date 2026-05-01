import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import Dockerode from 'dockerode';
import { ConfigService } from '@/core/config';
import type { BuildImageOpts, CreateContainerOpts } from './types';

@Injectable()
export class DockerService {
  private readonly docker: Dockerode;

  constructor(private readonly configService: ConfigService) {
    this.docker = new Dockerode({
      socketPath: this.configService.get('DOCKER_SOCKET_PATH'),
    });
  }

  async buildImage(opts: BuildImageOpts): Promise<void> {
    const args = ['build', '-t', opts.imageName];

    if (opts.buildArgs) {
      for (const [k, v] of Object.entries(opts.buildArgs)) {
        args.push('--build-arg', `${k}=${v}`);
      }
    }

    args.push(opts.contextPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('docker', args);

      proc.stdout.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line && opts.onLog) opts.onLog(line);
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line && opts.onLog) opts.onLog(line);
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`docker build exited with code ${code}`));
      });

      proc.on('error', reject);
    });
  }

  async createContainer(opts: CreateContainerOpts): Promise<string> {
    const existing = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [`^/${opts.containerName}$`] }),
    });

    if (existing.length > 0) {
      if (existing[0].State === 'running') return existing[0].Id;
      await this.docker.getContainer(existing[0].Id).remove({ force: true });
    }

    const container = await this.docker.createContainer({
      name: opts.containerName,
      Image: opts.imageName,
      Env: Object.entries(opts.envVars).map(([k, v]) => `${k}=${v}`),
      ...(opts.command ? { Cmd: opts.command } : {}),
      HostConfig: {
        NetworkMode: opts.networkName,
      },
    });

    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();
    if (!info.State.Running) {
      await container.start();
    }
  }

  async stopContainer(containerName: string): Promise<void> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [`^/${containerName}$`] }),
    });

    if (containers.length === 0) return;

    const container = this.docker.getContainer(containers[0].Id);
    if (containers[0].State === 'running') {
      await container.stop({ t: 10 });
    }
    await container.remove();
  }

  async removeContainer(containerName: string): Promise<void> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [`^/${containerName}$`] }),
    });

    if (containers.length === 0) return;

    await this.docker
      .getContainer(containers[0].Id)
      .remove({ force: true })
      .catch(() => {});
  }

  async isContainerRunning(containerName: string): Promise<boolean> {
    const containers = await this.docker.listContainers({
      filters: JSON.stringify({ name: [`^/${containerName}$`] }),
    });
    return containers.length > 0 && containers[0].State === 'running';
  }

  async getContainerInternalIp(
    containerName: string,
    networkName: string,
  ): Promise<string | null> {
    const containers = await this.docker.listContainers({
      filters: JSON.stringify({ name: [`^/${containerName}$`] }),
    });

    if (containers.length === 0) return null;

    const info = await this.docker
      .getContainer(containers[0].Id)
      .inspect();

    return info.NetworkSettings.Networks[networkName]?.IPAddress ?? null;
  }
}
