import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

describe('StorageModule', () => {
  let module: TestingModule;

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
  });

  afterAll(async () => {
    await module.close();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide StorageService', () => {
    const service = module.get(StorageService);
    expect(service).toBeDefined();
  });
});
