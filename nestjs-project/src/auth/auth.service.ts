import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import authConfig from '../config/auth.config';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken, VerificationTokenType } from './entities/verification-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  EmailAlreadyExistsException,
  EmailNotConfirmedException,
  InvalidCredentialsException,
  InvalidTokenException,
  TokenExpiredException,
  TokenReuseDetectedException,
} from '../common/exceptions/domain.exception';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @Inject(authConfig.KEY)
    private readonly authCfg: ConfigType<typeof authConfig>,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; email: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const hashedPassword = await argon2.hash(dto.password);
    let user: Awaited<ReturnType<typeof this.usersService.createUserWithChannel>>;
    try {
      user = await this.usersService.createUserWithChannel(dto.email, hashedPassword);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string; detail?: string }).code === '23505' &&
        (err as unknown as { code: string; detail?: string }).detail?.includes('email')
      ) {
        throw new EmailAlreadyExistsException();
      }
      throw err;
    }

    await this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_CONFIRMATION,
      this.authCfg.confirmationTokenExpirationHours,
      async (token) => {
        await this.mailService.sendConfirmationEmail(
          dto.email,
          user.channel?.name ?? dto.email.split('@')[0],
          token,
        );
      },
    );

    return { id: user.id, email: user.email };
  }

  async login(dto: LoginDto): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    let isValid = false;
    try {
      isValid = await argon2.verify(user.password, dto.password);
    } catch {
      // malformed hash — treat as wrong password
    }
    if (!isValid) {
      throw new InvalidCredentialsException();
    }

    if (!user.is_confirmed) {
      throw new EmailNotConfirmedException();
    }

    const accessToken = await this.generateAccessToken(user.id, user.email);
    const { refreshToken, family, jti } = await this.generateRefreshToken(user.id);

    await this.storeRefreshToken(user.id, refreshToken, family, jti);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refresh(rawToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.refreshTokenRepository.findOne({
      where: { token_hash: tokenHash },
    });

    if (!record) {
      throw new InvalidTokenException();
    }

    if (record.expires_at < new Date()) {
      throw new TokenExpiredException();
    }

    const gracePeriodMs = 10_000;
    const now = new Date();

    if (record.revoked_at !== null) {
      const timeSinceRevocation = now.getTime() - record.revoked_at.getTime();

      if (timeSinceRevocation <= gracePeriodMs) {
        // Concurrent request: rotate the latest non-revoked sibling in the family
        const sibling = await this.refreshTokenRepository.findOne({
          where: { family: record.family, revoked_at: IsNull() },
          order: { created_at: 'DESC' },
        });
        if (!sibling) {
          throw new InvalidTokenException();
        }
        // Rotate sibling → create a new token
        await this.refreshTokenRepository.update({ id: sibling.id }, { revoked_at: now });
        const user = await this.usersService.findById(record.user_id);
        if (!user) throw new InvalidTokenException();
        const accessToken = await this.generateAccessToken(user.id, user.email);
        const { refreshToken: newRawToken, family, jti } = await this.generateRefreshToken(user.id, record.family);
        await this.storeRefreshToken(user.id, newRawToken, family, jti);
        return { access_token: accessToken, refresh_token: newRawToken };
      } else {
        // Reuse detected: revoke entire family
        await this.refreshTokenRepository.update(
          { family: record.family, revoked_at: IsNull() },
          { revoked_at: now },
        );
        throw new TokenReuseDetectedException();
      }
    }

    // Happy path: rotate
    await this.refreshTokenRepository.update({ id: record.id }, { revoked_at: now });

    const user = await this.usersService.findById(record.user_id);
    if (!user) throw new InvalidTokenException();

    const accessToken = await this.generateAccessToken(user.id, user.email);
    const { refreshToken: newRawToken, family, jti } = await this.generateRefreshToken(user.id, record.family);
    await this.storeRefreshToken(user.id, newRawToken, family, jti);

    return { access_token: accessToken, refresh_token: newRawToken };
  }

  private async generateAccessToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.authCfg.jwtSecret,
        expiresIn: this.authCfg.jwtAccessExpiration as StringValue,
      },
    );
  }

  private async generateRefreshToken(
    userId: string,
    existingFamily?: string,
  ): Promise<{ refreshToken: string; family: string; jti: string }> {
    const family = existingFamily ?? crypto.randomUUID();
    const jti = crypto.randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, family, jti },
      {
        secret: this.authCfg.jwtRefreshSecret,
        expiresIn: this.authCfg.jwtRefreshExpiration as StringValue,
      },
    );
    return { refreshToken, family, jti };
  }

  private parseDurationMs(duration: string): number {
    const units: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
    const match = /^(\d+)([smhd])$/.exec(duration);
    return match ? parseInt(match[1]) * (units[match[2]] ?? 864e5) : 7 * 864e5;
  }

  private async storeRefreshToken(
    userId: string,
    rawToken: string,
    family: string,
    _jti: string,
  ): Promise<RefreshToken> {
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.parseDurationMs(this.authCfg.jwtRefreshExpiration));

    return this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token_hash: tokenHash,
        family,
        user_id: userId,
        expires_at: expiresAt,
        revoked_at: null,
      }),
    );
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithChannel(email);
    if (!user) return;

    await this.verificationTokenRepository.update(
      { user_id: user.id, type: VerificationTokenType.PASSWORD_RESET, used_at: IsNull() },
      { used_at: new Date() },
    );

    await this.createVerificationToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
      this.authCfg.passwordResetTokenExpirationHours,
      async (token) => {
        await this.mailService.sendPasswordResetEmail(
          user.email,
          user.channel?.name ?? user.email.split('@')[0],
          token,
        );
      },
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const record = await this.verificationTokenRepository.findOne({
      where: {
        token_hash: tokenHash,
        type: VerificationTokenType.PASSWORD_RESET,
        used_at: IsNull(),
      },
      relations: ['user'],
    });

    if (!record) {
      throw new InvalidTokenException();
    }

    if (record.expires_at < new Date()) {
      throw new TokenExpiredException();
    }

    record.used_at = new Date();
    await this.verificationTokenRepository.save(record);

    record.user.password = await argon2.hash(newPassword);
    await this.usersService.save(record.user);

    await this.logout(record.user.id);
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  async confirm(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const record = await this.verificationTokenRepository.findOne({
      where: {
        token_hash: tokenHash,
        type: VerificationTokenType.EMAIL_CONFIRMATION,
        used_at: IsNull(),
      },
      relations: ['user'],
    });

    if (!record) {
      throw new InvalidTokenException();
    }

    if (record.expires_at < new Date()) {
      throw new TokenExpiredException();
    }

    record.used_at = new Date();
    await this.verificationTokenRepository.save(record);

    record.user.is_confirmed = true;
    await this.usersService.save(record.user);
  }

  async resendConfirmation(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithChannel(email);
    if (!user || user.is_confirmed) {
      return;
    }

    await this.verificationTokenRepository.update(
      { user_id: user.id, type: VerificationTokenType.EMAIL_CONFIRMATION, used_at: IsNull() },
      { used_at: new Date() },
    );

    await this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_CONFIRMATION,
      this.authCfg.confirmationTokenExpirationHours,
      async (newToken) => {
        await this.mailService.sendConfirmationEmail(
          user.email,
          user.channel?.name ?? user.email.split('@')[0],
          newToken,
        );
      },
    );
  }

  protected async createVerificationToken(
    userId: string,
    type: VerificationTokenType,
    expirationHours: number,
    onCreated: (rawToken: string) => Promise<void>,
  ): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    await this.verificationTokenRepository.save(
      this.verificationTokenRepository.create({
        token_hash: tokenHash,
        type,
        user_id: userId,
        expires_at: expiresAt,
        used_at: null,
      }),
    );

    await onCreated(rawToken);
  }

  protected hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
