import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import authConfig from '../config/auth.config';
import mailConfig from '../config/mail.config';

describe('AuthModule', () => {
  it('compiles with JwtModule.registerAsync, TypeOrmModule.forFeature, UsersModule, MailModule wiring', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig, mailConfig] }),
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
        AuthModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
