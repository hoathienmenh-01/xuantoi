import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/common/prisma.service';
import { TEST_DATABASE_URL, wipeAll } from '../src/test-helpers';
import { DEFAULT_SECTS, readBootstrapEnv, runBootstrap } from './bootstrap';

let prisma: PrismaService;

const TEST_EMAIL = 'bootstrap-admin@xt.local';
const TEST_PASSWORD = 'super-secret-pass-12345';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await wipeAll(prisma);
  await prisma.$disconnect();
});

describe('bootstrap script', () => {
  it('readBootstrapEnv: throw nếu thiếu email/password hoặc password < 8 ký tự', () => {
    expect(() => readBootstrapEnv({})).toThrow(/INITIAL_ADMIN_EMAIL/);
    expect(() =>
      readBootstrapEnv({ INITIAL_ADMIN_EMAIL: 'a@b.local' } as NodeJS.ProcessEnv),
    ).toThrow(/INITIAL_ADMIN_PASSWORD/);
    expect(() =>
      readBootstrapEnv({
        INITIAL_ADMIN_EMAIL: 'a@b.local',
        INITIAL_ADMIN_PASSWORD: 'short',
      } as NodeJS.ProcessEnv),
    ).toThrow(/INITIAL_ADMIN_PASSWORD/);
    const ok = readBootstrapEnv({
      INITIAL_ADMIN_EMAIL: ' a@b.local ',
      INITIAL_ADMIN_PASSWORD: '12345678',
    } as NodeJS.ProcessEnv);
    expect(ok.email).toBe('a@b.local');
    expect(ok.password).toBe('12345678');
  });

  it('lần chạy đầu: tạo user ADMIN + 3 sect mặc định', async () => {
    const result = await runBootstrap(prisma, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(result.admin.action).toBe('created');
    expect(result.admin.email).toBe(TEST_EMAIL);
    expect(result.sects).toHaveLength(3);
    expect(result.sects.every((s) => s.created)).toBe(true);

    const users = await prisma.user.findMany({ where: { email: TEST_EMAIL } });
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('ADMIN');
    expect(users[0].banned).toBe(false);
    expect(await argon2.verify(users[0].passwordHash, TEST_PASSWORD)).toBe(true);

    const sectNames = (await prisma.sect.findMany()).map((s) => s.name).sort();
    expect(sectNames).toEqual(DEFAULT_SECTS.map((s) => s.name).sort());
  });

  it('chạy 2 lần liên tiếp: idempotent — không tạo duplicate user/sect, không đổi password', async () => {
    await runBootstrap(prisma, { email: TEST_EMAIL, password: TEST_PASSWORD });
    const after1 = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });

    const result2 = await runBootstrap(prisma, {
      email: TEST_EMAIL,
      password: 'a-different-password-9999',
    });

    expect(result2.admin.action).toBe('kept');
    expect(result2.sects).toHaveLength(3);
    expect(result2.sects.every((s) => !s.created)).toBe(true);

    const users = await prisma.user.findMany({ where: { email: TEST_EMAIL } });
    expect(users).toHaveLength(1);
    // passwordHash KHÔNG đổi — Rule 10: không khoá admin hiện có.
    expect(users[0].passwordHash).toBe(after1.passwordHash);

    const sectCount = await prisma.sect.count();
    expect(sectCount).toBe(DEFAULT_SECTS.length);
  });

  it('user đã tồn tại với role PLAYER → promote lên ADMIN, không đổi password', async () => {
    const oldHash = await argon2.hash('player-password-1234', {
      type: argon2.argon2id,
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash: oldHash, role: 'PLAYER' },
    });

    const result = await runBootstrap(prisma, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD, // không được dùng để đổi hash
    });

    expect(result.admin.action).toBe('promoted');
    const u = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    expect(u.role).toBe('ADMIN');
    expect(u.passwordHash).toBe(oldHash);
  });

  it('user đã có nhưng bị ban → unban + giữ ADMIN nếu đang là PLAYER ban', async () => {
    const oldHash = await argon2.hash('player-banned-password', {
      type: argon2.argon2id,
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash: oldHash, role: 'PLAYER', banned: true },
    });

    await runBootstrap(prisma, { email: TEST_EMAIL, password: TEST_PASSWORD });

    const u = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    expect(u.role).toBe('ADMIN');
    expect(u.banned).toBe(false);
    expect(u.passwordHash).toBe(oldHash);
  });

  it('skipAdmin: chỉ seed sect, không đụng user', async () => {
    const r = await runBootstrap(prisma, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      skipAdmin: true,
    });
    expect(r.admin.action).toBe('skipped');
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.sect.count()).toBe(DEFAULT_SECTS.length);
  });

  it('skipSects: chỉ tạo admin, không seed sect', async () => {
    const r = await runBootstrap(prisma, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      skipSects: true,
    });
    expect(r.admin.action).toBe('created');
    expect(r.sects).toHaveLength(0);
    expect(await prisma.sect.count()).toBe(0);
  });
});
