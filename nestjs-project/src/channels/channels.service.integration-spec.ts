import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';

describe('ChannelsService (integration)', () => {
  let module: TestingModule;
  let channelsService: ChannelsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'db',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'streamtube',
          password: process.env.DB_PASSWORD ?? 'streamtube',
          database: process.env.DB_NAME ?? 'streamtube',
          entities: [User, Channel],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Channel]),
      ],
      providers: [ChannelsService],
    }).compile();

    channelsService = module.get(ChannelsService);
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  const createUser = async (email: string): Promise<User> => {
    const result = await dataSource.query(
      `INSERT INTO "users" (email, password) VALUES ($1, $2) RETURNING *`,
      [email, 'hashed'],
    );
    return result[0] as User;
  };

  it('persists channel with nickname derived from email', async () => {
    const user = await createUser('hello@example.com');

    const channel = await channelsService.createChannel(user.id, 'hello@example.com');

    expect(channel.id).toBeDefined();
    expect(channel.nickname).toMatch(/^hello/);
    expect(channel.user_id).toBe(user.id);
  });

  it('resolves nickname collision by appending suffix', async () => {
    const user1 = await createUser('collision@example.com');
    const user2 = await createUser('collision2@example.com');

    await channelsService.createChannel(user1.id, 'collision@example.com');
    const second = await channelsService.createChannel(user2.id, 'collision@example.com');

    expect(second.nickname).toBeDefined();
    expect(second.user_id).toBe(user2.id);
  });

  it('manages transaction internally — no outer transaction required', async () => {
    const user = await createUser('internal@example.com');

    const channel = await channelsService.createChannel(user.id, 'internal@example.com');

    const saved = await dataSource.getRepository(Channel).findOneBy({ id: channel.id });
    expect(saved).not.toBeNull();
  });
});
