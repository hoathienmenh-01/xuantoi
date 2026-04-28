import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from './admin.guard';
import { REQUIRE_ADMIN_KEY } from './require-admin.decorator';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../../common/prisma.service';

type Role = 'PLAYER' | 'MOD' | 'ADMIN';

interface UserRow {
  id: string;
  role: Role;
  banned: boolean;
}

function makeAuth(userId: string | null) {
  return { userIdFromAccess: vi.fn().mockResolvedValue(userId) } as unknown as AuthService;
}

function makePrisma(user: UserRow | null) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  } as unknown as PrismaService;
}

function makeCtx(opts: {
  cookies?: Record<string, string>;
  requireAdmin?: boolean;
}): { ctx: ExecutionContext; req: { userId?: string; role?: Role; cookies?: Record<string, string> } } {
  const req: { userId?: string; role?: Role; cookies?: Record<string, string> } = {
    cookies: opts.cookies ?? {},
  };
  const handler = function handler() {};
  const cls = class TargetController {};
  if (opts.requireAdmin) {
    Reflect.defineMetadata(REQUIRE_ADMIN_KEY, true, handler);
  }
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
  return { ctx, req };
}

async function expectHttpException(p: Promise<unknown>, status: number, code: string) {
  let err: HttpException | null = null;
  try {
    await p;
  } catch (e) {
    err = e as HttpException;
  }
  expect(err).toBeInstanceOf(HttpException);
  expect(err!.getStatus()).toBe(status);
  const resp = err!.getResponse() as { error?: { code?: string } };
  expect(resp.error?.code).toBe(code);
}

describe('AdminGuard', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('UNAUTHENTICATED khi không có cookie / cookie sai', async () => {
    const guard = new AdminGuard(makeAuth(null), makePrisma(null), reflector);
    const { ctx } = makeCtx({});
    await expectHttpException(guard.canActivate(ctx) as Promise<boolean>, 401, 'UNAUTHENTICATED');
  });

  it('FORBIDDEN khi user không tồn tại (cookie cũ → user đã xoá)', async () => {
    const guard = new AdminGuard(makeAuth('user_ghost'), makePrisma(null), reflector);
    const { ctx } = makeCtx({ cookies: { xt_access: 'tk' } });
    await expectHttpException(guard.canActivate(ctx) as Promise<boolean>, 403, 'FORBIDDEN');
  });

  it('FORBIDDEN khi user banned (kể cả ADMIN)', async () => {
    const guard = new AdminGuard(
      makeAuth('user_banned'),
      makePrisma({ id: 'user_banned', role: 'ADMIN', banned: true }),
      reflector,
    );
    const { ctx } = makeCtx({ cookies: { xt_access: 'tk' } });
    await expectHttpException(guard.canActivate(ctx) as Promise<boolean>, 403, 'FORBIDDEN');
  });

  it('FORBIDDEN khi user là PLAYER', async () => {
    const guard = new AdminGuard(
      makeAuth('user_p'),
      makePrisma({ id: 'user_p', role: 'PLAYER', banned: false }),
      reflector,
    );
    const { ctx } = makeCtx({ cookies: { xt_access: 'tk' } });
    await expectHttpException(guard.canActivate(ctx) as Promise<boolean>, 403, 'FORBIDDEN');
  });

  it('ADMIN pass + gắn req.userId/role', async () => {
    const guard = new AdminGuard(
      makeAuth('user_a'),
      makePrisma({ id: 'user_a', role: 'ADMIN', banned: false }),
      reflector,
    );
    const { ctx, req } = makeCtx({ cookies: { xt_access: 'tk' } });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.userId).toBe('user_a');
    expect(req.role).toBe('ADMIN');
  });

  it('MOD pass cho route mặc định (không có @RequireAdmin)', async () => {
    const guard = new AdminGuard(
      makeAuth('user_m'),
      makePrisma({ id: 'user_m', role: 'MOD', banned: false }),
      reflector,
    );
    const { ctx, req } = makeCtx({ cookies: { xt_access: 'tk' } });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.role).toBe('MOD');
  });

  it('ADMIN_ONLY khi MOD gọi route có @RequireAdmin', async () => {
    const guard = new AdminGuard(
      makeAuth('user_m'),
      makePrisma({ id: 'user_m', role: 'MOD', banned: false }),
      reflector,
    );
    const { ctx } = makeCtx({ cookies: { xt_access: 'tk' }, requireAdmin: true });
    await expectHttpException(guard.canActivate(ctx) as Promise<boolean>, 403, 'ADMIN_ONLY');
  });

  it('ADMIN vẫn pass route có @RequireAdmin', async () => {
    const guard = new AdminGuard(
      makeAuth('user_a'),
      makePrisma({ id: 'user_a', role: 'ADMIN', banned: false }),
      reflector,
    );
    const { ctx } = makeCtx({ cookies: { xt_access: 'tk' }, requireAdmin: true });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
  });
});
