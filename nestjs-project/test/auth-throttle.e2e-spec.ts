import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';

describe('Auth throttling (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter(), new ValidationExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exceeding rate limit (11th request in 60s window)', async () => {
    const makeRequest = () =>
      request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'throttle@example.com' });

    for (let i = 0; i < 10; i++) {
      const res = await makeRequest();
      expect(res.status).toBe(204); // all under limit
    }

    const res = await makeRequest(); // 11th — exceeds limit of 10
    expect(res.status).toBe(429);
  });

  it('GET / is not rate-limited (AppController has @SkipThrottle)', async () => {
    const res = await request(app.getHttpServer()).get('/');
    expect(res.status).toBe(200);
  });
});
