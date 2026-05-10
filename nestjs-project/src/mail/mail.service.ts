import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendConfirmationEmail(email: string, name: string, token: string): Promise<void> {
    const confirmationUrl = `http://localhost:3003/auth/confirm-email?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Confirm your StreamTube account',
      template: 'confirmation',
      context: { name, confirmationUrl },
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3003/auth/reset-password?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset your StreamTube password',
      template: 'password-reset',
      context: { name, resetUrl },
    });
  }
}
