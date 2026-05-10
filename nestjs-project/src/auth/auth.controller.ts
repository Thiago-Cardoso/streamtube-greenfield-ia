import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './auth.types';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<{ id: string; email: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @Get('confirm-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(@Query() dto: ConfirmEmailDto): Promise<void> {
    await this.authService.confirm(dto.token);
  }

  @Public()
  @Post('resend-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendConfirmation(@Body() dto: ResendConfirmationDto): Promise<void> {
    await this.authService.resendConfirmation(dto.email);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logout(user.sub);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.new_password);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }
}
