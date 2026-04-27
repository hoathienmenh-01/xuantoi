import type { Response } from 'express';

export const ACCESS_COOKIE = 'xt_access';
export const REFRESH_COOKIE = 'xt_refresh';

/** Chính sách cookie HTTP-only chia sẻ cho access + refresh. */
function baseCookieOpts(maxAgeMs: number, path = '/'): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: maxAgeMs,
    path,
  };
}

export function setAccessCookie(res: Response, token: string, ttlSeconds: number): void {
  res.cookie(ACCESS_COOKIE, token, baseCookieOpts(ttlSeconds * 1000));
}

export function setRefreshCookie(res: Response, token: string, ttlSeconds: number): void {
  res.cookie(REFRESH_COOKIE, token, baseCookieOpts(ttlSeconds * 1000));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}
