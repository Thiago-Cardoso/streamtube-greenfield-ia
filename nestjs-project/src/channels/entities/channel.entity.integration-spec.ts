import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Channel } from './channel.entity';

describe('Channel entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'db',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'streamtube',
      password: process.env.DB_PASSWORD ?? 'streamtube',
      database: process.env.DB_NAME ?? 'streamtube',
      entities: [User, Channel],
      synchronize: true,
    });
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
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

  const createUser = async (email: string) =>
    userRepository.save(userRepository.create({ email, password: 'hashed' }));

  it('enforces unique nickname constraint', async () => {
    const user1 = await createUser('u1@example.com');
    const user2 = await createUser('u2@example.com');

    await channelRepository.save(
      channelRepository.create({ name: 'chan', nickname: 'mychan', user_id: user1.id }),
    );

    await expect(
      channelRepository.save(
        channelRepository.create({ name: 'chan2', nickname: 'mychan', user_id: user2.id }),
      ),
    ).rejects.toThrow();
  });

  it('allows null description', async () => {
    const user = await createUser('desc@example.com');
    const channel = await channelRepository.save(
      channelRepository.create({ name: 'chan', nickname: 'desc_chan', user_id: user.id, description: null }),
    );

    expect(channel.description).toBeNull();
  });

  it('enforces one-to-one relation with user via user_id unique constraint', async () => {
    const user = await createUser('one@example.com');
    await channelRepository.save(
      channelRepository.create({ name: 'first', nickname: 'firstchan', user_id: user.id }),
    );

    await expect(
      channelRepository.save(
        channelRepository.create({ name: 'second', nickname: 'secondchan', user_id: user.id }),
      ),
    ).rejects.toThrow();
  });

  it('loads user relation from channel', async () => {
    const user = await createUser('rel@example.com');
    await channelRepository.save(
      channelRepository.create({ name: 'relchan', nickname: 'relchan', user_id: user.id }),
    );

    const found = await channelRepository.findOne({
      where: { nickname: 'relchan' },
      relations: ['user'],
    });

    expect(found?.user.email).toBe('rel@example.com');
  });
});
