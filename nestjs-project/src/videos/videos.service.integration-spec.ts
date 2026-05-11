import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { VideosService } from './videos.service';
import { Video } from './entities/video.entity';
import { VideoStatus } from './enums/video-status.enum';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

const makeFile = () => ({
  fieldname: 'video',
  originalname: 'test.mp4',
  encoding: '7bit',
  mimetype: 'video/mp4',
  size: 18,
  buffer: Buffer.from('fake-video-content'),
});

describe('VideosService (integration)', () => {
  let service: VideosService;
  let dataSource: DataSource;
  let channelId: string;

  const storageServiceMock = { uploadStream: jest.fn().mockResolvedValue(undefined) };
  const usersServiceMock = { findByEmailWithChannel: jest.fn() };
  const processingQueueMock = { add: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
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
        TypeOrmModule.forFeature([Video]),
      ],
      providers: [
        VideosService,
        { provide: StorageService, useValue: storageServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: processingQueueMock },
      ],
    }).compile();

    service = module.get(VideosService);
    dataSource = module.get(DataSource);

    // create a real user+channel to satisfy FK constraint; clean up leftovers first
    const userRepo = dataSource.getRepository(User);
    const channelRepo = dataSource.getRepository(Channel);
    await dataSource.query(`DELETE FROM "channels" WHERE nickname = 'intchan'`);
    await dataSource.query(`DELETE FROM "users" WHERE email = 'int@example.com'`);
    const user = await userRepo.save(userRepo.create({ email: 'int@example.com', password: 'h' }));
    const channel = await channelRepo.save(
      channelRepo.create({ name: 'Int Chan', nickname: 'intchan', user_id: user.id }),
    );
    channelId = channel.id;

    usersServiceMock.findByEmailWithChannel.mockResolvedValue({
      id: user.id,
      email: user.email,
      channel: { id: channelId },
    } as never);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "videos"');
    await dataSource.query(`DELETE FROM "channels" WHERE nickname = 'intchan'`);
    await dataSource.query(`DELETE FROM "users" WHERE email = 'int@example.com'`);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    storageServiceMock.uploadStream.mockResolvedValue(undefined);
    await dataSource.query('DELETE FROM "videos"');
  });

  it('persists video row with UPLOADING status and file_key after successful upload', async () => {
    const result = await service.uploadVideo('int@example.com', makeFile());

    expect(result.id).toBeDefined();
    expect(result.status).toBe(VideoStatus.UPLOADING);
    expect(result.file_key).toMatch(/^.+\.mp4$/);
    expect(result.slug).toHaveLength(11);

    const inDb = await dataSource.getRepository(Video).findOneBy({ id: result.id });
    expect(inDb?.file_key).toBe(result.file_key);
  });

  it('calls storageService.uploadStream with the correct bucket and content type', async () => {
    await service.uploadVideo('int@example.com', makeFile());

    expect(storageServiceMock.uploadStream).toHaveBeenCalledWith(
      'videos',
      expect.stringMatching(/\.mp4$/),
      expect.any(Readable),
      18,
      'video/mp4',
    );
  });
});
