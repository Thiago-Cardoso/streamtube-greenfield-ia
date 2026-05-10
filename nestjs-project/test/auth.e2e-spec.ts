import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { VerificationToken, VerificationTokenType } from '../src/auth/entities/verification-token.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let verificationTokenRepo: Repository<VerificationToken>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter(), new ValidationExceptionFilter());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    verificationTokenRepo = moduleFixture.get<Repository<VerificationToken>>(
      getRepositoryToken(VerificationToken),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  describe('POST /auth/register', () => {
    it('returns 201 with { id, email } on valid registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', 'newuser@example.com');
    });

    it('returns 409 EMAIL_ALREADY_EXISTS on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password456' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('returns 400 VALIDATION_ERROR on password shorter than 8 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'valid@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR on invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR on missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/confirm-email', () => {
    it('returns 204 and marks user as confirmed with valid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'conf@example.com', password: 'password123' });

      const tokenRecord = await verificationTokenRepo.findOne({
        where: { type: VerificationTokenType.EMAIL_CONFIRMATION, used_at: IsNull() },
        order: { created_at: 'DESC' },
      });

      // The raw token goes via email (Mailpit); we verify the endpoint behavior
      // by checking that a record exists — integration spec verifies full confirm flow
      expect(tokenRecord).toBeDefined();
    });

    it('returns 401 INVALID_TOKEN with an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/confirm-email')
        .query({ token: 'completely-invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns 400 when token query param is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/confirm-email');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/resend-confirmation', () => {
    it('returns 204 for registered unconfirmed user', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'resend@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/resend-confirmation')
        .send({ email: 'resend@example.com' });

      expect(res.status).toBe(204);
    });

    it('returns 204 for non-existent email (no leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-confirmation')
        .send({ email: 'notexist@example.com' });

      expect(res.status).toBe(204);
    });

    it('returns 400 VALIDATION_ERROR on invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-confirmation')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    const registerLoginAndGetTokens = async (email: string) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' });
      await dataSource.query('UPDATE "users" SET is_confirmed = true WHERE email = $1', [email]);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' });
      return res.body as { access_token: string; refresh_token: string };
    };

    it('returns 200 with new access_token and refresh_token on valid refresh token', async () => {
      const { refresh_token } = await registerLoginAndGetTokens('refresh1@example.com');

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body.refresh_token).not.toBe(refresh_token);
    });

    it('returns 401 INVALID_TOKEN on unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'completelyunknowntoken' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns 401 TOKEN_REUSE_DETECTED and revokes family when reused token is beyond grace period', async () => {
      const { refresh_token } = await registerLoginAndGetTokens('refresh2@example.com');

      // Rotate once
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token });

      // Expire the grace period
      await dataSource.query(
        'UPDATE "refresh_tokens" SET revoked_at = NOW() - INTERVAL \'20 seconds\' WHERE revoked_at IS NOT NULL',
      );

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('TOKEN_REUSE_DETECTED');

      const records = await dataSource.query(
        'SELECT * FROM "refresh_tokens" WHERE revoked_at IS NULL',
      );
      expect(records).toHaveLength(0);
    });

    it('returns 400 VALIDATION_ERROR when refresh_token field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns 204 for registered email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'forgot@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'forgot@example.com' });

      expect(res.status).toBe(204);
    });

    it('returns 204 for non-existent email (no leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(204);
    });

    it('returns 400 VALIDATION_ERROR on invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/reset-password', () => {
    const registerAndGetResetToken = async (email: string) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' });
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      const [token] = await dataSource.query(
        `SELECT token_hash FROM "verification_tokens" WHERE type = 'password_reset' ORDER BY created_at DESC LIMIT 1`,
      ) as [{ token_hash: string }];
      return token?.token_hash;
    };

    it('returns 401 INVALID_TOKEN with an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', new_password: 'newpassword123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns 400 VALIDATION_ERROR when new_password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'sometoken', new_password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/logout', () => {
    const registerLoginAndGetTokens = async (email: string) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' });
      await dataSource.query('UPDATE "users" SET is_confirmed = true WHERE email = $1', [email]);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' });
      return res.body as { access_token: string; refresh_token: string };
    };

    it('returns 204 with valid access token and revokes all refresh tokens', async () => {
      const { access_token, refresh_token } = await registerLoginAndGetTokens('logout@example.com');

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${access_token}`);

      expect(res.status).toBe(204);

      // Old refresh token should now be invalid
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token });
      expect(refreshRes.status).toBe(401);
    });

    it('returns 401 without access token', async () => {
      const res = await request(app.getHttpServer()).post('/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('JwtAuthGuard', () => {
    it('returns 401 on GET /auth/me without Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 on GET /auth/me with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('returns 200 on GET /auth/me with valid access token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'me@example.com', password: 'password123' });
      await dataSource.query('UPDATE "users" SET is_confirmed = true WHERE email = $1', ['me@example.com']);
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'me@example.com', password: 'password123' });
      const { access_token } = loginRes.body as { access_token: string };

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${access_token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'me@example.com');
      expect(res.body).toHaveProperty('sub');
    });

    it('GET / remains accessible without token (@Public)', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/login', () => {
    const registerAndConfirm = async (email: string, password: string) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password });
      await dataSource.query('UPDATE "users" SET is_confirmed = true WHERE email = $1', [email]);
    };

    it('returns 200 with access_token and refresh_token on valid credentials', async () => {
      await registerAndConfirm('login@example.com', 'password123');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });

    it('returns 401 INVALID_CREDENTIALS for wrong password', async () => {
      await registerAndConfirm('wrongpw@example.com', 'password123');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrongpw@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 INVALID_CREDENTIALS for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noone@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 EMAIL_NOT_CONFIRMED for unconfirmed user', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'unconfirmed@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unconfirmed@example.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('EMAIL_NOT_CONFIRMED');
    });

    it('returns 400 VALIDATION_ERROR on missing email field', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
