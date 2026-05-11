import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Readable } from 'stream';
import storageConfig from '../config/storage.config';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

describe('StorageService (integration)', () => {
  let module: TestingModule;
  let storageService: StorageService;

  const TEST_BUCKET = process.env.MINIO_BUCKET_VIDEOS ?? 'videos';
  const TEST_KEY = `integration-test-${Date.now()}.txt`;
  const TEST_CONTENT = 'integration test content';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [storageConfig],
          ignoreEnvFile: true,
        }),
        StorageModule,
      ],
    }).compile();

    await module.init();
    storageService = module.get(StorageService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should upload a stream and retrieve it back', async () => {
    const buffer = Buffer.from(TEST_CONTENT);
    const readable = Readable.from(buffer);

    await storageService.uploadStream(
      TEST_BUCKET,
      TEST_KEY,
      readable,
      buffer.length,
      'text/plain',
    );

    const stream = await storageService.getObjectStream(TEST_BUCKET, TEST_KEY);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe(TEST_CONTENT);
  });

  it('should retrieve a range of bytes', async () => {
    const stream = await storageService.getObjectStreamRange(
      TEST_BUCKET,
      TEST_KEY,
      0,
      9,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe(TEST_CONTENT.slice(0, 10));
  });

  it('should return object stat with correct size', async () => {
    const stat = await storageService.getObjectStat(TEST_BUCKET, TEST_KEY);
    expect(stat.size).toBe(Buffer.from(TEST_CONTENT).length);
  });

  it('should not throw when bucket already exists on init', async () => {
    await expect(storageService.onModuleInit()).resolves.not.toThrow();
  });
});
