import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';

describe('Videos Streaming (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;
  let videoSlug: string;

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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'streamer@example.com', password: 'password123' });

    await dataSource.query(
      `UPDATE users SET is_confirmed = true WHERE email = 'streamer@example.com'`,
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'streamer@example.com', password: 'password123' });

    accessToken = (loginRes.body as { access_token: string }).access_token;

    // Upload a video so the file exists in MinIO
    const uploadRes = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('video', Buffer.from('fake-mp4-content'), {
        filename: 'test.mp4',
        contentType: 'video/mp4',
      });

    videoSlug = (uploadRes.body as { slug: string }).slug;

    // Simulate worker: set video to READY
    await dataSource.query(
      `UPDATE videos SET status = 'READY' WHERE slug = $1`,
      [videoSlug],
    );
  });

  describe('GET /videos/:slug', () => {
    it('returns 200 with video metadata for a READY video', async () => {
      const res = await request(app.getHttpServer()).get(`/videos/${videoSlug}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        slug: videoSlug,
        status: 'READY',
      });
      expect(res.body).not.toHaveProperty('file_key');
      expect(res.body).not.toHaveProperty('thumbnail_key');
    });

    it('returns 404 with VIDEO_NOT_FOUND for unknown slug', async () => {
      const res = await request(app.getHttpServer()).get('/videos/nonexistentslug');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('VIDEO_NOT_FOUND');
    });
  });

  describe('GET /videos/:slug/stream', () => {
    it('returns 206 with Content-Range header for a valid Range request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/videos/${videoSlug}/stream`)
        .set('Range', 'bytes=0-9');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toMatch(/^bytes 0-9\//);
      expect(res.headers['accept-ranges']).toBe('bytes');
    });

    it('returns 200 and streams full content without Range header', async () => {
      const res = await request(app.getHttpServer()).get(`/videos/${videoSlug}/stream`);

      expect(res.status).toBe(200);
    });

    it('returns 404 with VIDEO_NOT_FOUND for unknown slug', async () => {
      const res = await request(app.getHttpServer()).get('/videos/nonexistentslug/stream');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('VIDEO_NOT_FOUND');
    });
  });

  describe('GET /videos/:slug/download', () => {
    it('returns 200 with Content-Disposition attachment header', async () => {
      const res = await request(app.getHttpServer()).get(`/videos/${videoSlug}/download`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });
  });
});
