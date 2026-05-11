import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';

describe('Videos (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "videos"');
    await dataSource.query('DELETE FROM "refresh_tokens"');
    await dataSource.query('DELETE FROM "verification_tokens"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');

    // Register + confirm + login to get a valid access token
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'uploader@example.com', password: 'password123' });

    // Directly confirm the user in the DB for testing
    await dataSource.query(
      `UPDATE users SET is_confirmed = true WHERE email = 'uploader@example.com'`,
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'uploader@example.com', password: 'password123' });

    accessToken = (loginRes.body as { access_token: string }).access_token;
  });

  describe('POST /videos', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/videos')
        .attach('video', Buffer.from('fake'), { filename: 'test.mp4', contentType: 'video/mp4' });

      expect(res.status).toBe(401);
    });

    it('returns 201 with { id, slug, status: UPLOADING } for a valid mp4 upload', async () => {
      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('video', Buffer.from('fake-mp4-content'), {
          filename: 'test.mp4',
          contentType: 'video/mp4',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('slug');
      expect(res.body.slug).toHaveLength(11);
      expect(res.body).toHaveProperty('status', 'UPLOADING');
    });

    it('returns 400 with INVALID_MIME_TYPE for a non-video file', async () => {
      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('video', Buffer.from('not a video'), {
          filename: 'document.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_MIME_TYPE');
    });
  });
});
