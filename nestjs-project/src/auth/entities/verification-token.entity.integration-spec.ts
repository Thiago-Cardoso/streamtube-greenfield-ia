import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { RefreshToken } from './refresh-token.entity';
import { VerificationToken, VerificationTokenType } from './verification-token.entity';

describe('VerificationToken entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let tokenRepository: Repository<VerificationToken>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'db',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'streamtube',
      password: process.env.DB_PASSWORD ?? 'streamtube',
      database: process.env.DB_NAME ?? 'streamtube',
      entities: [User, Channel, RefreshToken, VerificationToken],
      synchronize: true,
    });
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    tokenRepository = dataSource.getRepository(VerificationToken);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  const createUser = async () =>
    userRepository.save(userRepository.create({ email: `u${Date.now()}@example.com`, password: 'hash' }));

  it('persists an email_confirmation token', async () => {
    const user = await createUser();
    const saved = await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'confhash',
        type: VerificationTokenType.EMAIL_CONFIRMATION,
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      }),
    );

    expect(saved.id).toBeDefined();
    expect(saved.type).toBe(VerificationTokenType.EMAIL_CONFIRMATION);
    expect(saved.used_at).toBeNull();
  });

  it('persists a password_reset token', async () => {
    const user = await createUser();
    const saved = await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'resethash',
        type: VerificationTokenType.PASSWORD_RESET,
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      }),
    );

    expect(saved.type).toBe(VerificationTokenType.PASSWORD_RESET);
  });

  it('can be queried by token_hash', async () => {
    const user = await createUser();
    await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'find_by_hash',
        type: VerificationTokenType.EMAIL_CONFIRMATION,
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      }),
    );

    const found = await tokenRepository.findOneBy({ token_hash: 'find_by_hash' });
    expect(found?.token_hash).toBe('find_by_hash');
  });

  it('allows used_at to be set', async () => {
    const user = await createUser();
    const token = await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'useable',
        type: VerificationTokenType.EMAIL_CONFIRMATION,
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      }),
    );

    token.used_at = new Date();
    const updated = await tokenRepository.save(token);
    expect(updated.used_at).toBeInstanceOf(Date);
  });

  it('requires expires_at', async () => {
    const user = await createUser();
    await expect(
      tokenRepository.save(
        tokenRepository.create({
          token_hash: 'noexp',
          type: VerificationTokenType.EMAIL_CONFIRMATION,
          user_id: user.id,
        } as VerificationToken),
      ),
    ).rejects.toThrow();
  });
});
