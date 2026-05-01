import { Module } from '@nestjs/common';
import { DockerModule } from '@/infrastructure/docker/docker.module';
import { DatabasesController } from './databases.controller';
import { DatabasesService } from './databases.service';

@Module({
  imports: [DockerModule],
  controllers: [DatabasesController],
  providers: [DatabasesService],
  exports: [DatabasesService],
})
export class DatabasesModule {}
