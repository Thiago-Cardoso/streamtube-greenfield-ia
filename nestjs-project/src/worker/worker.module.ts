import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { VideoProcessorService } from './video-processor.service';
import { Video } from '../videos/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import databaseConfig from '../config/database.config';
import appConfig from '../config/app.config';
import storageConfig from '../config/storage.config';
import queueConfig from '../config/queue.config';
import { validationSchema } from '../config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig, storageConfig, queueConfig],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.name,
        entities: [User, Channel, Video],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Video]),
    StorageModule,
    QueueModule,
  ],
  providers: [VideoProcessorService],
})
export class WorkerModule {}
