import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { Video } from './video.entity';
import { VideoStatus } from '../enums/video-status.enum';

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'db',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'streamtube',
      password: process.env.DB_PASSWORD ?? 'streamtube',
      database: process.env.DB_NAME ?? 'streamtube',
      entities: [User, Channel, Video],
      synchronize: true,
    });
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "videos"');
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  const createChannel = async (email: string, nickname: string) => {
    const user = await userRepository.save(userRepository.create({ email, password: 'hashed' }));
    const channel = await channelRepository.save(
      channelRepository.create({ name: 'Test Channel', nickname, user_id: user.id }),
    );
    return channel;
  };

  it('auto-generates uuid, created_at, and updated_at', async () => {
    const channel = await createChannel('owner@example.com', 'owner');
    const video = await videoRepository.save(
      videoRepository.create({ slug: 'abc12345678', channel_id: channel.id }),
    );

    expect(video.id).toBeDefined();
    expect(video.created_at).toBeInstanceOf(Date);
    expect(video.updated_at).toBeInstanceOf(Date);
  });

  it('defaults status to UPLOADING', async () => {
    const channel = await createChannel('status@example.com', 'statuschan');
    const video = await videoRepository.save(
      videoRepository.create({ slug: 'dflt1234567', channel_id: channel.id }),
    );

    expect(video.status).toBe(VideoStatus.UPLOADING);
  });

  it('enforces unique slug constraint', async () => {
    const channel = await createChannel('slug@example.com', 'slugchan');
    await videoRepository.save(
      videoRepository.create({ slug: 'uniq1234567', channel_id: channel.id }),
    );

    await expect(
      videoRepository.save(
        videoRepository.create({ slug: 'uniq1234567', channel_id: channel.id }),
      ),
    ).rejects.toThrow();
  });

  it('allows nullable fields (title, file_key, thumbnail_key, duration, size, mime_type)', async () => {
    const channel = await createChannel('null@example.com', 'nullchan');
    const video = await videoRepository.save(
      videoRepository.create({ slug: 'null1234567', channel_id: channel.id }),
    );

    expect(video.title).toBeNull();
    expect(video.file_key).toBeNull();
    expect(video.thumbnail_key).toBeNull();
    expect(video.duration).toBeNull();
    expect(video.size).toBeNull();
    expect(video.mime_type).toBeNull();
  });

  it('enforces FK constraint — channel_id must reference an existing channel', async () => {
    await expect(
      videoRepository.save(
        videoRepository.create({
          slug: 'fk12345678a',
          channel_id: '00000000-0000-0000-0000-000000000000',
        }),
      ),
    ).rejects.toThrow();
  });

  it('loads channel relation from video', async () => {
    const channel = await createChannel('rel@example.com', 'relchan');
    await videoRepository.save(
      videoRepository.create({ slug: 'relv1234567', channel_id: channel.id }),
    );

    const found = await videoRepository.findOne({
      where: { slug: 'relv1234567' },
      relations: ['channel'],
    });

    expect(found?.channel.nickname).toBe('relchan');
  });
});
