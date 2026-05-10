import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const makeContext = (authHeader?: string, isPublic = false): ExecutionContext => {
  const request = { headers: { authorization: authHeader }, user: undefined } as never;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    _request: request,
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as never;
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as never;
    guard = new JwtAuthGuard(jwtService, reflector);
  });

  it('allows public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is not Bearer type', async () => {
    const ctx = makeContext('Basic sometoken');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when jwtService.verifyAsync rejects', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const ctx = makeContext('Bearer bad.token.here');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches payload to request.user and returns true for valid token', async () => {
    const payload = { sub: 'user-id', email: 'user@example.com' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const request = { headers: { authorization: 'Bearer valid.token' }, user: undefined } as never;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((request as { user: unknown }).user).toEqual(payload);
  });

  it('checks IS_PUBLIC_KEY metadata via reflector', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'u@e.com' });
    const ctx = makeContext('Bearer tok');
    await guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });
});
