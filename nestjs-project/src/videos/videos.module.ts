import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from './entities/video.entity';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Video]), UsersModule, QueueModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [TypeOrmModule, VideosService],
})
export class VideosModule {}
