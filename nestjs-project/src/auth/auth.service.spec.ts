import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken, VerificationTokenType } from './entities/verification-token.entity';
import { RegisterDto } from './dto/register.dto';
import {
  EmailAlreadyExistsException,
  EmailNotConfirmedException,
  InvalidCredentialsException,
  InvalidTokenException,
  TokenExpiredException,
  TokenReuseDetectedException,
} from '../common/exceptions/domain.exception';
import authConfig from '../config/auth.config';

const buildTestModule = async (overrides?: {
  usersService?: Partial<jest.Mocked<UsersService>>;
  mailService?: Partial<jest.Mocked<MailService>>;
  tokenRepo?: Partial<jest.Mocked<{ save: jest.Mock; findOne: jest.Mock; update: jest.Mock; create: jest.Mock }>>;
  refreshTokenRepo?: Partial<jest.Mocked<{ save: jest.Mock; findOne: jest.Mock; update: jest.Mock; create: jest.Mock }>>;
}) => {
  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    is_confirmed: true,
    password: '$argon2id$v=19$m=65536,t=3,p=4$fakehashedpassword',
    channel: { id: 'chan-id', name: 'test', nickname: 'test', user_id: 'user-id-1' },
  };

  const usersService: jest.Mocked<Partial<UsersService>> = {
    findByEmail: jest.fn().mockResolvedValue(null),
    createUserWithChannel: jest.fn().mockResolvedValue({ ...mockUser, is_confirmed: false }),
    save: jest.fn().mockResolvedValue(mockUser),
    findByEmailWithChannel: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(mockUser),
    ...overrides?.usersService,
  };

  const mailService: jest.Mocked<Partial<MailService>> = {
    sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides?.mailService,
  };

  const tokenRepo = {
    save: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn().mockImplementation((data: unknown) => data),
    ...overrides?.tokenRepo,
  };

  const refreshTokenRepo = {
    save: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn().mockImplementation((data: unknown) => data),
    ...overrides?.refreshTokenRepo,
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
    ],
    providers: [
      AuthService,
      { provide: UsersService, useValue: usersService },
      { provide: MailService, useValue: mailService },
      { provide: getRepositoryToken(VerificationToken), useValue: tokenRepo },
      { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepo },
      {
        provide: authConfig.KEY,
        useValue: {
          jwtSecret: 'test-secret',
          jwtRefreshSecret: 'test-refresh-secret',
          jwtAccessExpiration: '15m',
          jwtRefreshExpiration: '7d',
          confirmationTokenExpirationHours: 1,
          passwordResetTokenExpirationHours: 1,
        },
      },
    ],
  }).compile();

  return {
    authService: module.get(AuthService),
    usersService: usersService as jest.Mocked<UsersService>,
    mailService: mailService as jest.Mocked<MailService>,
    tokenRepo,
    refreshTokenRepo,
  };
};

const makeValidToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

describe('AuthService — register', () => {
  it('returns { id, email } on successful registration', async () => {
    const { authService } = await buildTestModule();
    const dto: RegisterDto = { email: 'test@example.com', password: 'password123' };

    const result = await authService.register(dto);

    expect(result).toEqual({ id: 'user-id-1', email: 'test@example.com' });
  });

  it('hashes the password before passing to createUserWithChannel', async () => {
    const { authService, usersService } = await buildTestModule();
    const dto: RegisterDto = { email: 'test@example.com', password: 'password123' };

    await authService.register(dto);

    const [_email, hashedPassword] = usersService.createUserWithChannel.mock.calls[0];
    expect(hashedPassword).not.toBe('password123');
    expect(hashedPassword).toBeDefined();
  });

  it('calls sendConfirmationEmail after registration', async () => {
    const { authService, mailService } = await buildTestModule();
    const dto: RegisterDto = { email: 'test@example.com', password: 'password123' };

    await authService.register(dto);

    expect(mailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendConfirmationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String),
      expect.any(String),
    );
  });

  it('throws EmailAlreadyExistsException when email is already registered', async () => {
    const { authService } = await buildTestModule({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({ id: 'existing', email: 'test@example.com' } as never),
      },
    });

    await expect(
      authService.register({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toThrow(EmailAlreadyExistsException);
  });

  it('saves a verification token after registration', async () => {
    const { authService, tokenRepo } = await buildTestModule();

    await authService.register({ email: 'test@example.com', password: 'password123' });

    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
    const savedToken = tokenRepo.save.mock.calls[0][0];
    expect(savedToken.type).toBe(VerificationTokenType.EMAIL_CONFIRMATION);
    expect(savedToken.token_hash).toBeDefined();
  });
});

describe('AuthService — login', () => {
  it('throws InvalidCredentialsException when user not found', async () => {
    const { authService } = await buildTestModule({
      usersService: { findByEmail: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      authService.login({ email: 'noone@example.com', password: 'pass' }),
    ).rejects.toThrow(InvalidCredentialsException);
  });

  it('throws InvalidCredentialsException when password is wrong (same error as not found)', async () => {
    const { authService } = await buildTestModule({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'u@e.com',
          password: 'hashed',
          is_confirmed: true,
        }),
      },
    });

    await expect(
      authService.login({ email: 'u@e.com', password: 'wrongpassword' }),
    ).rejects.toThrow(InvalidCredentialsException);
  });

  it('throws EmailNotConfirmedException for unconfirmed user', async () => {
    // real argon2 hash of 'anypassword' so verify passes and we reach the is_confirmed check
    const validHash = '$argon2id$v=19$m=65536,t=3,p=4$jJp4sCksy6elvoYgC0kM+g$HcB6BEDChOBbqTQ3hzYCtfwCz/9jOurNkkP1crw8hhk';
    const { authService } = await buildTestModule({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'u@e.com',
          password: validHash,
          is_confirmed: false,
        }),
      },
    });

    await expect(
      authService.login({ email: 'u@e.com', password: 'anypassword' }),
    ).rejects.toThrow(EmailNotConfirmedException);
  });
});

describe('AuthService — confirm', () => {
  it('sets is_confirmed = true on valid token', async () => {
    const { raw, hash } = makeValidToken();
    const user = { id: 'u1', email: 'u@e.com', is_confirmed: false };
    const record = {
      token_hash: hash,
      type: VerificationTokenType.EMAIL_CONFIRMATION,
      used_at: null,
      expires_at: new Date(Date.now() + 3600000),
      user,
    };

    const { authService, usersService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(record), save: jest.fn().mockResolvedValue(record) },
    });

    await authService.confirm(raw);
    expect(usersService.save).toHaveBeenCalledWith(expect.objectContaining({ is_confirmed: true }));
  });

  it('throws InvalidTokenException when token not found', async () => {
    const { authService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(authService.confirm('invalidtoken')).rejects.toThrow(InvalidTokenException);
  });

  it('throws TokenExpiredException when token is expired', async () => {
    const { raw, hash } = makeValidToken();
    const record = {
      token_hash: hash,
      type: VerificationTokenType.EMAIL_CONFIRMATION,
      used_at: null,
      expires_at: new Date(Date.now() - 1000),
      user: { id: 'u1', is_confirmed: false },
    };

    const { authService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(record) },
    });

    await expect(authService.confirm(raw)).rejects.toThrow(TokenExpiredException);
  });
});

describe('AuthService — resendConfirmation', () => {
  it('generates new token and sends email for unconfirmed user', async () => {
    const user = {
      id: 'u1',
      email: 'u@e.com',
      is_confirmed: false,
      channel: { name: 'User' },
    };

    const { authService, mailService, tokenRepo } = await buildTestModule({
      usersService: { findByEmailWithChannel: jest.fn().mockResolvedValue(user) },
    });

    await authService.resendConfirmation('u@e.com');

    expect(mailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns silently for unknown email (no leak)', async () => {
    const { authService, mailService } = await buildTestModule({
      usersService: { findByEmailWithChannel: jest.fn().mockResolvedValue(null) },
    });

    await authService.resendConfirmation('unknown@example.com');
    expect(mailService.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('returns silently for already-confirmed user', async () => {
    const user = { id: 'u1', email: 'u@e.com', is_confirmed: true, channel: { name: 'User' } };

    const { authService, mailService } = await buildTestModule({
      usersService: { findByEmailWithChannel: jest.fn().mockResolvedValue(user) },
    });

    await authService.resendConfirmation('u@e.com');
    expect(mailService.sendConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService — forgotPassword', () => {
  it('sends reset email and persists token for existing user', async () => {
    const user = { id: 'u1', email: 'u@e.com', is_confirmed: true, channel: { name: 'User' } };
    const { authService, mailService, tokenRepo } = await buildTestModule({
      usersService: { findByEmailWithChannel: jest.fn().mockResolvedValue(user) },
    });

    await authService.forgotPassword('u@e.com');

    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
    const savedToken = tokenRepo.save.mock.calls[0][0];
    expect(savedToken.type).toBe(VerificationTokenType.PASSWORD_RESET);
  });

  it('returns silently for unknown email (no leak)', async () => {
    const { authService, mailService } = await buildTestModule({
      usersService: { findByEmailWithChannel: jest.fn().mockResolvedValue(null) },
    });

    await authService.forgotPassword('unknown@example.com');
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService — resetPassword', () => {
  it('updates password, marks token used, and revokes all refresh tokens', async () => {
    const { raw, hash } = makeValidToken();
    const user = { id: 'u1', email: 'u@e.com', is_confirmed: true, password: 'oldhash' };
    const record = {
      token_hash: hash,
      type: VerificationTokenType.PASSWORD_RESET,
      used_at: null,
      expires_at: new Date(Date.now() + 3600000),
      user,
    };

    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const { authService, usersService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(record), save: jest.fn().mockResolvedValue(record) },
      refreshTokenRepo: { update },
    });

    await authService.resetPassword(raw, 'newpassword123');

    expect(usersService.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
    );
    const savedUser = usersService.save.mock.calls[0][0] as { password: string };
    expect(savedUser.password).not.toBe('oldhash');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', revoked_at: IsNull() }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
  });

  it('throws InvalidTokenException when token not found', async () => {
    const { authService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(authService.resetPassword('bad', 'newpassword123')).rejects.toThrow(InvalidTokenException);
  });

  it('throws TokenExpiredException when token is expired', async () => {
    const { raw, hash } = makeValidToken();
    const record = {
      token_hash: hash,
      type: VerificationTokenType.PASSWORD_RESET,
      used_at: null,
      expires_at: new Date(Date.now() - 1000),
      user: { id: 'u1' },
    };
    const { authService } = await buildTestModule({
      tokenRepo: { findOne: jest.fn().mockResolvedValue(record) },
    });
    await expect(authService.resetPassword(raw, 'newpassword123')).rejects.toThrow(TokenExpiredException);
  });
});

describe('AuthService — logout', () => {
  it('revokes all non-revoked refresh tokens for the user', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 2 });
    const { authService } = await buildTestModule({
      refreshTokenRepo: { update },
    });

    await authService.logout('user-id-1');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-id-1', revoked_at: IsNull() }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
  });
});

describe('AuthService — refresh', () => {
  const makeRefreshRecord = (overrides: Partial<{
    revoked_at: Date | null;
    expires_at: Date;
    family: string;
    user_id: string;
    id: string;
  }> = {}) => ({
    id: 'rt-1',
    token_hash: 'somehash',
    family: 'family-uuid',
    user_id: 'u1',
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revoked_at: null,
    ...overrides,
  });

  it('throws InvalidTokenException when token not found', async () => {
    const { authService } = await buildTestModule({
      refreshTokenRepo: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(authService.refresh('unknowntoken')).rejects.toThrow(InvalidTokenException);
  });

  it('throws TokenExpiredException when token is expired', async () => {
    const record = makeRefreshRecord({ expires_at: new Date(Date.now() - 1000) });
    const { authService } = await buildTestModule({
      refreshTokenRepo: { findOne: jest.fn().mockResolvedValue(record) },
    });
    await expect(authService.refresh('expiredtoken')).rejects.toThrow(TokenExpiredException);
  });

  it('throws TokenReuseDetectedException and revokes family when reuse is beyond grace period', async () => {
    const revokedAt = new Date(Date.now() - 15_000); // 15s ago
    const record = makeRefreshRecord({ revoked_at: revokedAt });
    const update = jest.fn().mockResolvedValue({ affected: 1 });

    const { authService } = await buildTestModule({
      refreshTokenRepo: {
        findOne: jest.fn().mockResolvedValue(record),
        update,
      },
    });

    await expect(authService.refresh('staletoken')).rejects.toThrow(TokenReuseDetectedException);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'family-uuid', revoked_at: IsNull() }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
  });

  it('rotates token on valid refresh — returns new access_token and refresh_token', async () => {
    const record = makeRefreshRecord();
    const user = { id: 'u1', email: 'u@e.com' };
    const update = jest.fn().mockResolvedValue({ affected: 1 });

    const { authService } = await buildTestModule({
      refreshTokenRepo: {
        findOne: jest.fn().mockResolvedValue(record),
        update,
        save: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation((d: unknown) => d),
      },
      usersService: { findById: jest.fn().mockResolvedValue(user) },
    });

    const result = await authService.refresh('validtoken');
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rt-1' }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
  });
});
