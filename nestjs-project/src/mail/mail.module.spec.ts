import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail.module';
import appConfig from '../config/app.config';
import mailConfig from '../config/mail.config';

describe('MailModule', () => {
  it('compiles with MailerModule.forRootAsync wiring', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, mailConfig] }),
        MailModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
