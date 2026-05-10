import { Inject, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../config/app.config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  async sendConfirmationEmail(email: string, name: string, token: string): Promise<void> {
    const confirmationUrl = `${this.appCfg.appUrl}/auth/confirm-email?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Confirm your StreamTube account',
      template: 'confirmation',
      context: { name, confirmationUrl },
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appCfg.appUrl}/auth/reset-password?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset your StreamTube password',
      template: 'password-reset',
      context: { name, resetUrl },
    });
  }
}
