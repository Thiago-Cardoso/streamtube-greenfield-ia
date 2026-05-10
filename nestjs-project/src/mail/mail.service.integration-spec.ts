import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import mailConfig from '../config/mail.config';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';

describe('MailService (integration)', () => {
  let module: TestingModule;
  let mailService: MailService;
  const mailpitApiUrl = `http://${process.env.MAIL_HOST ?? 'mailpit'}:8025/api/v1`;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [mailConfig] }),
        MailModule,
      ],
    }).compile();

    mailService = module.get(MailService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await fetch(`${mailpitApiUrl}/messages`, { method: 'DELETE' });
  });

  it('sendConfirmationEmail delivers to Mailpit with correct recipient and subject', async () => {
    await mailService.sendConfirmationEmail('confirm@example.com', 'Alice', 'tok123');

    const response = await fetch(`${mailpitApiUrl}/messages`);
    const data = (await response.json()) as { messages: Array<{ To: Array<{ Address: string }>; Subject: string; Snippet: string }> };

    expect(data.messages).toHaveLength(1);
    const msg = data.messages[0];
    expect(msg.To[0].Address).toBe('confirm@example.com');
    expect(msg.Subject).toContain('Confirm');
    expect(msg.Snippet).toContain('Alice');
  });

  it('sendPasswordResetEmail delivers to Mailpit with correct recipient and expiry notice', async () => {
    await mailService.sendPasswordResetEmail('reset@example.com', 'Bob', 'resetok456');

    const response = await fetch(`${mailpitApiUrl}/messages`);
    const data = (await response.json()) as { messages: Array<{ To: Array<{ Address: string }>; Subject: string; Snippet: string }> };

    expect(data.messages).toHaveLength(1);
    const msg = data.messages[0];
    expect(msg.To[0].Address).toBe('reset@example.com');
    expect(msg.Subject).toContain('Reset');
  });

  it('both emails use the configured MAIL_FROM address', async () => {
    await mailService.sendConfirmationEmail('from@example.com', 'Charlie', 'tok789');

    const response = await fetch(`${mailpitApiUrl}/messages`);
    const data = (await response.json()) as { messages: Array<{ From: { Address: string } }> };

    expect(data.messages[0].From.Address).toBe('noreply@streamtube.com');
  });
});
