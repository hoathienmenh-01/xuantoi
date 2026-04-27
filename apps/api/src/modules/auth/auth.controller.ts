import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '@xuantoi/shared';
import { ApiException } from '../../common/api-exception';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
} from '../../common/auth-cookies';
import { ZodBody } from '../../common/zod.pipe';
import { AuthError, AuthService, type AuthErrorCode } from './auth.service';

function fail(code: AuthErrorCode, status = HttpStatus.BAD_REQUEST): never {
  throw new ApiException(code, status);
}

function reqIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function reqUa(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : undefined;
}

@Controller('_auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodBody(RegisterInput, 'WEAK_PASSWORD')) input: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const out = await this.auth.register(input, { ip: reqIp(req), userAgent: reqUa(req) });
      setAccessCookie(res, out.accessToken, out.accessTtlSeconds);
      setRefreshCookie(res, out.refreshToken, out.refreshTtlSeconds);
      return { ok: true, data: { user: out.user } };
    } catch (e) {
      if (e instanceof AuthError) fail(e.code);
      throw e;
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodBody(LoginInput, 'INVALID_CREDENTIALS')) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const out = await this.auth.login(input, { ip: reqIp(req), userAgent: reqUa(req) });
      setAccessCookie(res, out.accessToken, out.accessTtlSeconds);
      setRefreshCookie(res, out.refreshToken, out.refreshTtlSeconds);
      return { ok: true, data: { user: out.user } };
    } catch (e) {
      if (e instanceof AuthError) {
        const status =
          e.code === 'RATE_LIMITED' ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.UNAUTHORIZED;
        fail(e.code, status);
      }
      throw e;
    }
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Body(new ZodBody(ChangePasswordInput, 'OLD_PASSWORD_WRONG')) input: ChangePasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);

    try {
      await this.auth.changePassword(userId, input);
      // sau khi đổi, mọi refresh cũ đã revoke → buộc đăng nhập lại.
      clearAuthCookies(res);
      return { ok: true, data: { ok: true } };
    } catch (e) {
      if (e instanceof AuthError) fail(e.code, HttpStatus.UNAUTHORIZED);
      throw e;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const out = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], {
        ip: reqIp(req),
        userAgent: reqUa(req),
      });
      setAccessCookie(res, out.accessToken, out.accessTtlSeconds);
      setRefreshCookie(res, out.refreshToken, out.refreshTtlSeconds);
      return { ok: true, data: { user: out.user } };
    } catch (e) {
      if (e instanceof AuthError) {
        clearAuthCookies(res);
        fail(e.code, HttpStatus.UNAUTHORIZED);
      }
      throw e;
    }
  }

  @Get('session')
  async session(@Req() req: Request) {
    const user = await this.auth.getSession(req.cookies?.[ACCESS_COOKIE]);
    if (!user) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    return { ok: true, data: { user } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res);
    return { ok: true, data: { ok: true } };
  }
}
