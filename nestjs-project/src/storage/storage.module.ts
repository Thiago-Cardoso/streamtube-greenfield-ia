import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Client } from 'minio';
import storageConfig from '../config/storage.config';
import { MINIO_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (cfg: ConfigType<typeof storageConfig>): Client => {
        return new Client({
          endPoint: cfg.endpoint,
          port: cfg.port,
          useSSL: cfg.useSsl,
          accessKey: cfg.accessKey,
          secretKey: cfg.secretKey,
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
