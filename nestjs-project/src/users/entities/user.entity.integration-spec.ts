import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';
import { Channel } from '../../channels/entities/channel.entity';

describe('User entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;

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

  it('auto-generates uuid, created_at, and updated_at on save', async () => {
    const user = userRepository.create({ email: 'test@example.com', password: 'hashed' });
    const saved = await userRepository.save(user);

    expect(saved.id).toBeDefined();
    expect(saved.created_at).toBeInstanceOf(Date);
    expect(saved.updated_at).toBeInstanceOf(Date);
  });

  it('enforces unique email constraint', async () => {
    await userRepository.save(
      userRepository.create({ email: 'dup@example.com', password: 'hashed' }),
    );

    await expect(
      userRepository.save(userRepository.create({ email: 'dup@example.com', password: 'other' })),
    ).rejects.toThrow();
  });

  it('excludes password from default SELECT', async () => {
    await userRepository.save(
      userRepository.create({ email: 'secret@example.com', password: 'supersecret' }),
    );

    const found = await userRepository.findOneBy({ email: 'secret@example.com' });
    expect(found?.password).toBeUndefined();
  });

  it('defaults is_confirmed to false', async () => {
    const saved = await userRepository.save(
      userRepository.create({ email: 'new@example.com', password: 'hash' }),
    );

    expect(saved.is_confirmed).toBe(false);
  });

  it('includes password when explicitly selected with addSelect', async () => {
    await userRepository.save(
      userRepository.create({ email: 'pw@example.com', password: 'myhash' }),
    );

    const found = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: 'pw@example.com' })
      .getOne();

    expect(found?.password).toBe('myhash');
  });
});
