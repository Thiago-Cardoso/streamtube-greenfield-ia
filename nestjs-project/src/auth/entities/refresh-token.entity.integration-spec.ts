import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { RefreshToken } from './refresh-token.entity';
import { VerificationToken } from './verification-token.entity';

describe('RefreshToken entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let tokenRepository: Repository<RefreshToken>;

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
    tokenRepository = dataSource.getRepository(RefreshToken);
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

  it('persists a refresh token linked to a user', async () => {
    const user = await createUser();
    const familyId = crypto.randomUUID();
    const token = tokenRepository.create({
      token_hash: 'abc123',
      family: familyId,
      user_id: user.id,
      expires_at: new Date(Date.now() + 60000),
      revoked_at: null,
    });
    const saved = await tokenRepository.save(token);

    expect(saved.id).toBeDefined();
    expect(saved.created_at).toBeInstanceOf(Date);
    expect(saved.revoked_at).toBeNull();
  });

  it('can be queried by token_hash', async () => {
    const user = await createUser();
    await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'searchable_hash',
        family: crypto.randomUUID(),
        user_id: user.id,
        expires_at: new Date(Date.now() + 60000),
        revoked_at: null,
      }),
    );

    const found = await tokenRepository.findOneBy({ token_hash: 'searchable_hash' });
    expect(found).toBeDefined();
    expect(found?.token_hash).toBe('searchable_hash');
  });

  it('allows revoked_at to be set', async () => {
    const user = await createUser();
    const token = await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'revoke_me',
        family: crypto.randomUUID(),
        user_id: user.id,
        expires_at: new Date(Date.now() + 60000),
        revoked_at: null,
      }),
    );

    token.revoked_at = new Date();
    const updated = await tokenRepository.save(token);
    expect(updated.revoked_at).toBeInstanceOf(Date);
  });

  it('requires expires_at', async () => {
    const user = await createUser();
    await expect(
      tokenRepository.save(
        tokenRepository.create({
          token_hash: 'nox',
          family: crypto.randomUUID(),
          user_id: user.id,
        } as RefreshToken),
      ),
    ).rejects.toThrow();
  });

  it('stores the family uuid for rotation chain grouping', async () => {
    const user = await createUser();
    const familyId = crypto.randomUUID();
    await tokenRepository.save(
      tokenRepository.create({
        token_hash: 'family_test',
        family: familyId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 60000),
        revoked_at: null,
      }),
    );

    const found = await tokenRepository.findOneBy({ family: familyId });
    expect(found?.family).toBe(familyId);
  });
});
