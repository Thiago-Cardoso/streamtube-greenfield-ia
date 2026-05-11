import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Client, type BucketItemStat } from 'minio';
import { Readable } from 'stream';
import storageConfig from '../config/storage.config';
import { MINIO_CLIENT } from './storage.constants';

@Injectable()
export class StorageService implements OnModuleInit {
  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Client,
    @Inject(storageConfig.KEY)
    private readonly cfg: ConfigType<typeof storageConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const bucket of [this.cfg.bucketVideos, this.cfg.bucketThumbnails]) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket);
      }
    }
  }

  async uploadStream(
    bucket: string,
    key: string,
    stream: Readable,
    size: number,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(bucket, key, stream, size, {
      'Content-Type': contentType,
    });
  }

  async getObjectStream(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key);
  }

  async getObjectStreamRange(
    bucket: string,
    key: string,
    start: number,
    end: number,
  ): Promise<Readable> {
    return this.client.getPartialObject(bucket, key, start, end - start + 1);
  }

  async getObjectStat(bucket: string, key: string): Promise<BucketItemStat> {
    return this.client.statObject(bucket, key);
  }
}
