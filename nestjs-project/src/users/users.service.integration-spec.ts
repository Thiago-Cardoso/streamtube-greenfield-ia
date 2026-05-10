import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelsModule } from '../channels/channels.module';
import { ChannelsService } from '../channels/channels.service';

describe('UsersService (integration)', () => {
  let module: TestingModule;
  let usersService: UsersService;
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
        TypeOrmModule.forFeature([User]),
        ChannelsModule,
      ],
      providers: [UsersService],
    }).compile();

    usersService = module.get(UsersService);
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

  it('creates user and channel', async () => {
    const user = await usersService.createUserWithChannel('atomictest@example.com', 'hashed');

    expect(user.id).toBeDefined();
    expect(user.email).toBe('atomictest@example.com');
    expect(user.channel).toBeDefined();
    expect(user.channel.nickname).toMatch(/^atomictest/);
  });

  it('derives channel nickname from email prefix', async () => {
    const user = await usersService.createUserWithChannel('my.user_123@example.com', 'hashed');
    expect(user.channel.nickname).toMatch(/^myuser_123/);
  });

  it('handles nickname collision with suffix', async () => {
    await usersService.createUserWithChannel('collision@example.com', 'hashed');
    const second = await usersService.createUserWithChannel('collision@example.com2', 'hashed2');

    expect(second.channel.nickname).toBeDefined();
  });

  it('findByEmail returns user with password via addSelect', async () => {
    await usersService.createUserWithChannel('pwcheck@example.com', 'myhash');
    const found = await usersService.findByEmail('pwcheck@example.com');

    expect(found?.password).toBe('myhash');
  });

  it('findByEmail returns null for unknown email', async () => {
    const found = await usersService.findByEmail('unknown@example.com');
    expect(found).toBeNull();
  });

  it('compensates by deleting user when channel creation fails irrecoverably', async () => {
    const channelsService = module.get(ChannelsService);
    jest.spyOn(channelsService, 'createChannel').mockRejectedValueOnce(new Error('irrecoverable'));

    await expect(usersService.createUserWithChannel('fail@example.com', 'hash')).rejects.toThrow('irrecoverable');

    const found = await usersService.findByEmail('fail@example.com');
    expect(found).toBeNull();
  });
});
