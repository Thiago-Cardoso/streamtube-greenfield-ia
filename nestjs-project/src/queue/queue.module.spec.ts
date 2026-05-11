import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './queue.module';
import queueConfig from '../config/queue.config';

describe('QueueModule (compilation)', () => {
  it('compiles without missing providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [queueConfig],
        }),
        QueueModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
