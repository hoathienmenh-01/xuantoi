import {
  Body,
  Controller,
  HttpCode,
  HttpException,
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
import { AuthService, type AuthErrorCode } from './auth.service';

const ACCESS_COOKIE = 'xt_access';
const REFRESH_COOKIE = 'xt_refresh';

function fail(code: AuthErrorCode, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('_auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = RegisterInput.safeParse(body);
    if (!parsed.success) fail('WEAK_PASSWORD');

    try {
      const out = await this.auth.register(parsed.data);
      this.setAuthCookies(res, out.accessToken, out.refreshToken);
      return { ok: true, data: { user: out.user } };
    } catch (e) {
      if ((e as { code?: string })?.code === 'EMAIL_TAKEN') fail('EMAIL_TAKEN');
      throw e;
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = LoginInput.safeParse(body);
    if (!parsed.success) fail('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);

    try {
      const out = await this.auth.login(parsed.data);
      this.setAuthCookies(res, out.accessToken, out.refreshToken);
      return { ok: true, data: { user: out.user } };
    } catch {
      fail('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() body: unknown, @Req() req: Request) {
    const parsed = ChangePasswordInput.safeParse(body);
    if (!parsed.success) fail('OLD_PASSWORD_WRONG', HttpStatus.UNAUTHORIZED);

    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('OLD_PASSWORD_WRONG', HttpStatus.UNAUTHORIZED);

    try {
      await this.auth.changePassword(userId, parsed.data);
      return { ok: true, data: { ok: true } };
    } catch {
      fail('OLD_PASSWORD_WRONG', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true, data: { ok: true } };
  }

  private setAuthCookies(res: Response, access: string, refresh: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(ACCESS_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie(REFRESH_COOKIE, refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
