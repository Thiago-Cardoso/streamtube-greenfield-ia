import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WorkerModule } from './worker.module';
import { StorageService } from '../storage/storage.service';
import { QueueModule } from '../queue/queue.module';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useValue: { uploadStream: jest.fn(), getObjectStream: jest.fn() },
    },
  ],
  exports: [StorageService],
})
class MockStorageModule {}

@Global()
@Module({
  providers: [{ provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: { add: jest.fn() } }],
  exports: [getQueueToken(VIDEO_PROCESSING_QUEUE)],
})
class MockQueueModule {}

describe('WorkerModule (compilation)', () => {
  it('compiles with all providers wired correctly', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideModule(QueueModule)
      .useModule(MockQueueModule)
      .overrideProvider(StorageService)
      .useValue({ uploadStream: jest.fn(), getObjectStream: jest.fn() })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
