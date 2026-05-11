import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { VideosModule } from './videos.module';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Video } from './entities/video.entity';
import { QueueModule } from '../queue/queue.module';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

@Global()
@Module({
  providers: [{ provide: StorageService, useValue: { uploadStream: jest.fn() } }],
  exports: [StorageService],
})
class MockStorageModule {}

@Global()
@Module({
  providers: [{ provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: { add: jest.fn() } }],
  exports: [getQueueToken(VIDEO_PROCESSING_QUEUE)],
})
class MockQueueModule {}

describe('VideosModule', () => {
  it('compiles with all providers and TypeOrmModule.forFeature([Video]) wiring', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'db',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'streamtube',
          password: process.env.DB_PASSWORD ?? 'streamtube',
          database: process.env.DB_NAME ?? 'streamtube',
          entities: [User, Channel, Video],
          synchronize: true,
        }),
        MockStorageModule,
        VideosModule,
      ],
    })
      .overrideModule(QueueModule)
      .useModule(MockQueueModule)
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
