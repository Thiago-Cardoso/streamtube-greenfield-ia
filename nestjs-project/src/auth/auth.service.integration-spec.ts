import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import authConfig from '../config/auth.config';
import type { ConfigType } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelsModule } from '../channels/channels.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken, VerificationTokenType } from './entities/verification-token.entity';

describe('AuthService (integration)', () => {
  let module: TestingModule;
  let authService: AuthService;
  let dataSource: DataSource;

  const mockMailService = {
    sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig] }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'db',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'streamtube',
          password: process.env.DB_PASSWORD ?? 'streamtube',
          database: process.env.DB_NAME ?? 'streamtube',
          entities: [User, Channel, RefreshToken, VerificationToken],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User, RefreshToken, VerificationToken]),
        ChannelsModule,
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      ],
      providers: [
        AuthService,
        UsersService,
        { provide: MailService, useValue: mockMailService },
        {
          provide: authConfig.KEY,
          useValue: {
            jwtSecret: 'test-secret',
            jwtRefreshSecret: 'test-refresh-secret',
            jwtAccessExpiration: '15m',
            jwtRefreshExpiration: '7d',
            confirmationTokenExpirationHours: 1,
            passwordResetTokenExpirationHours: 1,
          } satisfies ConfigType<typeof authConfig>,
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  it('register persists user, channel, and verification token in DB', async () => {
    await authService.register({ email: 'reg@example.com', password: 'password123' });

    const users = await dataSource.query('SELECT * FROM "users" WHERE email = $1', ['reg@example.com']);
    expect(users).toHaveLength(1);

    const channels = await dataSource.query('SELECT * FROM "channels" WHERE user_id = $1', [users[0].id]);
    expect(channels).toHaveLength(1);

    const tokens = await dataSource.query(
      'SELECT * FROM "verification_tokens" WHERE user_id = $1',
      [users[0].id],
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(VerificationTokenType.EMAIL_CONFIRMATION);
  });

  it('confirmation token hash in DB matches SHA-256 of the raw token sent to email', async () => {
    await authService.register({ email: 'hash@example.com', password: 'password123' });

    const [callArgs] = mockMailService.sendConfirmationEmail.mock.calls as [[string, string, string]];
    const rawToken = callArgs[2];
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokens = await dataSource.query(
      'SELECT token_hash FROM "verification_tokens" WHERE type = $1',
      [VerificationTokenType.EMAIL_CONFIRMATION],
    );
    expect(tokens[0].token_hash).toBe(expectedHash);
  });

  it('throws EmailAlreadyExistsException when same email registered twice', async () => {
    await authService.register({ email: 'dup@example.com', password: 'password123' });

    await expect(
      authService.register({ email: 'dup@example.com', password: 'other12345' }),
    ).rejects.toMatchObject({ errorCode: 'EMAIL_ALREADY_EXISTS' });
  });

  it('confirm sets is_confirmed = true and marks token used', async () => {
    await authService.register({ email: 'conf@example.com', password: 'password123' });
    const rawToken = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];

    await authService.confirm(rawToken);

    const [user] = await dataSource.query(
      'SELECT is_confirmed FROM "users" WHERE email = $1',
      ['conf@example.com'],
    );
    expect(user.is_confirmed).toBe(true);

    const [token] = await dataSource.query(
      'SELECT used_at FROM "verification_tokens" WHERE type = $1',
      [VerificationTokenType.EMAIL_CONFIRMATION],
    );
    expect(token.used_at).not.toBeNull();
  });

  it('resend invalidates old tokens and creates a new one', async () => {
    await authService.register({ email: 'resend@example.com', password: 'password123' });

    await authService.resendConfirmation('resend@example.com');

    const tokens = await dataSource.query(
      'SELECT * FROM "verification_tokens" WHERE type = $1',
      [VerificationTokenType.EMAIL_CONFIRMATION],
    );
    expect(tokens).toHaveLength(2);
    const usedTokens = tokens.filter((t: { used_at: Date | null }) => t.used_at !== null);
    const activeTokens = tokens.filter((t: { used_at: Date | null }) => t.used_at === null);
    expect(usedTokens).toHaveLength(1);
    expect(activeTokens).toHaveLength(1);
  });

  it('login persists refresh token in DB with correct family and expiry', async () => {
    await authService.register({ email: 'login@example.com', password: 'password123' });
    const rawToken = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawToken);

    const result = await authService.login({ email: 'login@example.com', password: 'password123' });

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();

    const refreshTokens = await dataSource.query('SELECT * FROM "refresh_tokens"');
    expect(refreshTokens).toHaveLength(1);
    expect(refreshTokens[0].family).toBeDefined();
    expect(refreshTokens[0].expires_at).toBeDefined();
  });

  it('access token is a valid JWT verifiable with the test secret', async () => {
    await authService.register({ email: 'jwt@example.com', password: 'password123' });
    const rawToken = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawToken);

    const { access_token } = await authService.login({ email: 'jwt@example.com', password: 'password123' });

    const jwtService = module.get(JwtService);
    const payload = jwtService.verify(access_token, { secret: 'test-secret' });
    expect(payload.email).toBe('jwt@example.com');
    expect(payload.sub).toBeDefined();
  });

  it('forgotPassword persists password_reset token in DB', async () => {
    await authService.register({ email: 'forgot@example.com', password: 'password123' });
    jest.clearAllMocks();

    await authService.forgotPassword('forgot@example.com');

    expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [user] = await dataSource.query('SELECT id FROM "users" WHERE email = $1', ['forgot@example.com']);
    const tokens = await dataSource.query(
      'SELECT * FROM "verification_tokens" WHERE user_id = $1 AND type = $2',
      [user.id, VerificationTokenType.PASSWORD_RESET],
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0].used_at).toBeNull();
  });

  it('resetPassword updates password hash, marks token used, revokes refresh tokens', async () => {
    await authService.register({ email: 'reset@example.com', password: 'oldpassword1' });
    const rawConf = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawConf);
    jest.clearAllMocks();

    await authService.login({ email: 'reset@example.com', password: 'oldpassword1' });
    await authService.forgotPassword('reset@example.com');
    const rawReset = (mockMailService.sendPasswordResetEmail.mock.calls[0] as [string, string, string])[2];

    await authService.resetPassword(rawReset, 'newpassword1');

    // Token marked as used
    const [token] = await dataSource.query(
      'SELECT used_at FROM "verification_tokens" WHERE type = $1',
      [VerificationTokenType.PASSWORD_RESET],
    );
    expect(token.used_at).not.toBeNull();

    // All refresh tokens revoked
    const activeTokens = await dataSource.query(
      'SELECT * FROM "refresh_tokens" WHERE revoked_at IS NULL',
    );
    expect(activeTokens).toHaveLength(0);

    // Can login with new password
    await expect(
      authService.login({ email: 'reset@example.com', password: 'newpassword1' }),
    ).resolves.toHaveProperty('access_token');
  });

  it('logout revokes all user refresh tokens; other users unaffected', async () => {
    await authService.register({ email: 'logout1@example.com', password: 'password123' });
    const rawConf1 = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawConf1);
    jest.clearAllMocks();

    await authService.register({ email: 'logout2@example.com', password: 'password123' });
    const rawConf2 = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawConf2);
    jest.clearAllMocks();

    await authService.login({ email: 'logout1@example.com', password: 'password123' });
    await authService.login({ email: 'logout1@example.com', password: 'password123' }); // two sessions
    await authService.login({ email: 'logout2@example.com', password: 'password123' }); // other user

    const [user1] = await dataSource.query('SELECT id FROM "users" WHERE email = $1', ['logout1@example.com']);
    await authService.logout(user1.id as string);

    const user1Tokens = await dataSource.query(
      'SELECT * FROM "refresh_tokens" WHERE user_id = $1 AND revoked_at IS NULL',
      [user1.id],
    );
    expect(user1Tokens).toHaveLength(0);

    const [user2] = await dataSource.query('SELECT id FROM "users" WHERE email = $1', ['logout2@example.com']);
    const user2Tokens = await dataSource.query(
      'SELECT * FROM "refresh_tokens" WHERE user_id = $1 AND revoked_at IS NULL',
      [user2.id],
    );
    expect(user2Tokens).toHaveLength(1);
  });

  it('refresh rotates token — old token revoked, new token stored in same family', async () => {
    await authService.register({ email: 'rot@example.com', password: 'password123' });
    const rawConf = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawConf);
    const { refresh_token: oldRaw } = await authService.login({ email: 'rot@example.com', password: 'password123' });

    const [oldRecord] = await dataSource.query('SELECT * FROM "refresh_tokens"');
    const result = await authService.refresh(oldRaw);

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.refresh_token).not.toBe(oldRaw);

    const records = await dataSource.query('SELECT * FROM "refresh_tokens" ORDER BY created_at ASC');
    expect(records).toHaveLength(2);
    expect(records[0].revoked_at).not.toBeNull(); // old revoked
    expect(records[0].family).toBe(records[1].family); // same family
    expect(records[1].revoked_at).toBeNull(); // new is active
    expect(oldRecord.family).toBe(records[0].family);
  });

  it('refresh throws TokenReuseDetectedException and revokes family on reuse beyond grace period', async () => {
    await authService.register({ email: 'reuse@example.com', password: 'password123' });
    const rawConf = (mockMailService.sendConfirmationEmail.mock.calls[0] as [string, string, string])[2];
    await authService.confirm(rawConf);
    const { refresh_token: oldRaw } = await authService.login({ email: 'reuse@example.com', password: 'password123' });

    // Rotate once
    await authService.refresh(oldRaw);

    // Simulate grace period expired by backdating revoked_at
    await dataSource.query(
      'UPDATE "refresh_tokens" SET revoked_at = NOW() - INTERVAL \'20 seconds\' WHERE revoked_at IS NOT NULL',
    );

    await expect(authService.refresh(oldRaw)).rejects.toMatchObject({ errorCode: 'TOKEN_REUSE_DETECTED' });

    // All tokens in family should be revoked
    const records = await dataSource.query('SELECT * FROM "refresh_tokens"');
    const activeTokens = records.filter((r: { revoked_at: Date | null }) => r.revoked_at === null);
    expect(activeTokens).toHaveLength(0);
  });
});
