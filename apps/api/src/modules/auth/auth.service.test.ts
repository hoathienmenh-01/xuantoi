import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { AuthService, AuthError } from './auth.service';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

const ACCESS_SECRET = 'test-access-secret-' + Math.random().toString(36).slice(2);
const REFRESH_SECRET = 'test-refresh-secret-' + Math.random().toString(36).slice(2);

class FakeConfig extends ConfigService {
  constructor() {
    super({
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_TTL: '900',
      JWT_REFRESH_TTL: '2592000',
    });
  }
}

let prisma: PrismaService;
let jwt: JwtService;
let auth: AuthService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  jwt = new JwtService({});
  const cfg = new FakeConfig();
  auth = new AuthService(prisma, jwt, cfg);
});

beforeEach(async () => {
  // Wipe auth-related tables only (don't touch unrelated phase tables to keep tests fast).
  await prisma.refreshToken.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ctx = { ip: '127.0.0.1' };
const PASSWORD = 'Test1234';

describe('AuthService', () => {
  it('register tạo user mới + phát access/refresh token + ghi RefreshToken row', async () => {
    const out = await auth.register({ email: 'a@xt.local', password: PASSWORD }, ctx);
    expect(out.user.email).toBe('a@xt.local');
    expect(out.accessToken.length).toBeGreaterThan(20);
    expect(out.refreshToken.length).toBeGreaterThan(20);
    const rows = await prisma.refreshToken.findMany({ where: { userId: out.user.id } });
    expect(rows.length).toBe(1);
    expect(rows[0].revokedAt).toBeNull();
  });

  it('register cùng email lần 2 ném EMAIL_TAKEN', async () => {
    await auth.register({ email: 'b@xt.local', password: PASSWORD }, ctx);
    await expect(
      auth.register({ email: 'b@xt.local', password: PASSWORD }, ctx),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('login thành công với mật khẩu đúng', async () => {
    await auth.register({ email: 'c@xt.local', password: PASSWORD }, ctx);
    const out = await auth.login({ email: 'c@xt.local', password: PASSWORD }, ctx);
    expect(out.user.email).toBe('c@xt.local');
  });

  it('login sai mật khẩu ném INVALID_CREDENTIALS + ghi LoginAttempt fail', async () => {
    await auth.register({ email: 'd@xt.local', password: PASSWORD }, ctx);
    await expect(
      auth.login({ email: 'd@xt.local', password: 'WrongPwd1' }, ctx),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const attempts = await prisma.loginAttempt.findMany({
      where: { email: 'd@xt.local', success: false },
    });
    expect(attempts.length).toBe(1);
  });

  it('login sai 5 lần / 15 phút / IP+email → RATE_LIMITED', async () => {
    await auth.register({ email: 'rate@xt.local', password: PASSWORD }, ctx);
    for (let i = 0; i < 5; i++) {
      await auth
        .login({ email: 'rate@xt.local', password: 'WrongPwd1' }, ctx)
        .catch(() => undefined);
    }
    await expect(
      auth.login({ email: 'rate@xt.local', password: PASSWORD }, ctx),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('login user banned ném ACCOUNT_BANNED', async () => {
    const out = await auth.register({ email: 'banned@xt.local', password: PASSWORD }, ctx);
    await prisma.user.update({ where: { id: out.user.id }, data: { banned: true } });
    await expect(
      auth.login({ email: 'banned@xt.local', password: PASSWORD }, ctx),
    ).rejects.toMatchObject({ code: 'ACCOUNT_BANNED' });
  });

  it('session(accessToken) trả PublicUser khi token hợp lệ', async () => {
    const out = await auth.register({ email: 'sess@xt.local', password: PASSWORD }, ctx);
    const u = await auth.session(out.accessToken);
    expect(u.email).toBe('sess@xt.local');
  });

  it('session(undefined) ném UNAUTHENTICATED', async () => {
    await expect(auth.session(undefined)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('session ném ACCOUNT_BANNED khi user bị ban', async () => {
    const out = await auth.register({ email: 'sb@xt.local', password: PASSWORD }, ctx);
    await prisma.user.update({ where: { id: out.user.id }, data: { banned: true } });
    await expect(auth.session(out.accessToken)).rejects.toMatchObject({
      code: 'ACCOUNT_BANNED',
    });
  });

  it('refresh rotate token: revoke cũ, cấp mới, hashedToken khác', async () => {
    const reg = await auth.register({ email: 'rot@xt.local', password: PASSWORD }, ctx);
    const before = await prisma.refreshToken.findMany({ where: { userId: reg.user.id } });
    const out = await auth.refresh(reg.refreshToken, ctx);
    expect(out.refreshToken).not.toBe(reg.refreshToken);
    const after = await prisma.refreshToken.findMany({
      where: { userId: reg.user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(after.length).toBe(2);
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].revokedAt).not.toBeNull();
    expect(after[1].revokedAt).toBeNull();
    expect(after[1].rotatedFromId).toBe(after[0].id);
  });

  it('refresh với token đã revoke ném SESSION_EXPIRED', async () => {
    const reg = await auth.register({ email: 'rev@xt.local', password: PASSWORD }, ctx);
    await auth.logout(reg.refreshToken);
    await expect(auth.refresh(reg.refreshToken, ctx)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('change-password revoke toàn bộ refresh token cũ', async () => {
    const reg = await auth.register({ email: 'chp@xt.local', password: PASSWORD }, ctx);
    await auth.changePassword(reg.user.id, {
      oldPassword: PASSWORD,
      newPassword: 'NewPass123',
    });
    const tokens = await prisma.refreshToken.findMany({ where: { userId: reg.user.id } });
    expect(tokens.length).toBe(1);
    expect(tokens[0].revokedAt).not.toBeNull();
    // Refresh phải fail vì token cũ bị revoke + passwordVersion bumped.
    await expect(auth.refresh(reg.refreshToken, ctx)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('change-password sai oldPassword ném OLD_PASSWORD_WRONG', async () => {
    const reg = await auth.register({ email: 'chp2@xt.local', password: PASSWORD }, ctx);
    await expect(
      auth.changePassword(reg.user.id, {
        oldPassword: 'WrongOld1',
        newPassword: 'NewPass123',
      }),
    ).rejects.toMatchObject({ code: 'OLD_PASSWORD_WRONG' });
  });

  it('logout idempotent: không throw khi token undefined / không hợp lệ', async () => {
    await expect(auth.logout(undefined)).resolves.toBeUndefined();
    await expect(auth.logout('garbage.jwt.token')).resolves.toBeUndefined();
  });

  it('AuthError exposes code property', () => {
    const e = new AuthError('RATE_LIMITED');
    expect(e.code).toBe('RATE_LIMITED');
  });
});
