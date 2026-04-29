import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from '../character/currency.service';
import {
  DAILY_LOGIN_LINH_THACH,
  DailyLoginError,
  DailyLoginService,
  addDaysLocal,
  getLocalDateString,
} from './daily-login.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let svc: DailyLoginService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.MISSION_RESET_TZ = 'Asia/Ho_Chi_Minh';
  prisma = new PrismaService();
  svc = new DailyLoginService(prisma, new CurrencyService(prisma));
});

beforeEach(async () => {
  await wipeAll(prisma);
});

describe('DailyLoginService — helpers', () => {
  it('getLocalDateString VN: 28/04 18:00 UTC = 29/04 01:00 VN → "2026-04-29"', () => {
    const now = new Date('2026-04-28T18:00:00.000Z');
    expect(getLocalDateString(now, 'Asia/Ho_Chi_Minh')).toBe('2026-04-29');
  });

  it('getLocalDateString UTC: 29/04 23:30 UTC → "2026-04-29"', () => {
    const now = new Date('2026-04-29T23:30:00.000Z');
    expect(getLocalDateString(now, 'UTC')).toBe('2026-04-29');
  });

  it('addDaysLocal 2026-04-29 -1 → "2026-04-28"', () => {
    expect(addDaysLocal('2026-04-29', -1)).toBe('2026-04-28');
  });

  it('addDaysLocal 2026-03-01 -1 → "2026-02-28" (border tháng)', () => {
    expect(addDaysLocal('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('DailyLoginService — status()', () => {
  it('character mới chưa claim → canClaimToday=true, currentStreak=0', async () => {
    const u = await makeUserChar(prisma);
    const s = await svc.status(u.userId);
    expect(s.canClaimToday).toBe(true);
    expect(s.currentStreak).toBe(0);
    expect(s.nextRewardLinhThach).toBe(DAILY_LOGIN_LINH_THACH.toString());
  });

  it('user không có character → throw NO_CHARACTER', async () => {
    const fake = await prisma.user.create({
      data: { email: 'no-char-dl@xt.local', passwordHash: 'x' },
    });
    await expect(svc.status(fake.id)).rejects.toBeInstanceOf(DailyLoginError);
  });

  it('đã claim hôm nay → canClaimToday=false, currentStreak=1', async () => {
    const u = await makeUserChar(prisma);
    await svc.claim(u.userId);
    const s = await svc.status(u.userId);
    expect(s.canClaimToday).toBe(false);
    expect(s.currentStreak).toBe(1);
  });
});

describe('DailyLoginService — claim() (idempotent + ledger)', () => {
  it('first claim → +100 LT, ledger DAILY_LOGIN, claim row', async () => {
    const u = await makeUserChar(prisma);
    const before = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
      select: { linhThach: true },
    });

    const r = await svc.claim(u.userId);
    expect(r.claimed).toBe(true);
    expect(r.linhThachDelta).toBe('100');
    expect(r.newStreak).toBe(1);

    const after = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
      select: { linhThach: true },
    });
    expect(after.linhThach - before.linhThach).toBe(100n);

    const claims = await prisma.dailyLoginClaim.findMany({
      where: { characterId: u.characterId },
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]?.claimDateLocal).toBe(r.claimDateLocal);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId, reason: 'DAILY_LOGIN' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.delta).toBe(100n);
    expect(ledger[0]?.refType).toBe('DailyLoginClaim');
  });

  it('claim 2 lần cùng ngày → idempotent (không double credit)', async () => {
    const u = await makeUserChar(prisma);
    const r1 = await svc.claim(u.userId);
    const r2 = await svc.claim(u.userId);

    expect(r1.claimed).toBe(true);
    expect(r2.claimed).toBe(false);
    expect(r2.linhThachDelta).toBe('0');
    expect(r2.newStreak).toBe(1);

    const ch = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
      select: { linhThach: true },
    });
    expect(ch.linhThach).toBe(1100n); // 1000 default + 100 (chỉ 1 lần)

    const claims = await prisma.dailyLoginClaim.findMany({
      where: { characterId: u.characterId },
    });
    expect(claims).toHaveLength(1);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId, reason: 'DAILY_LOGIN' },
    });
    expect(ledger).toHaveLength(1);
  });

  it('claim ngày hôm qua + ngày hôm nay → streak=2 (chuỗi liên tục)', async () => {
    const u = await makeUserChar(prisma);
    // Tạo claim ngày hôm qua trực tiếp.
    const tz = 'Asia/Ho_Chi_Minh';
    const today = getLocalDateString(new Date(), tz);
    const yesterday = addDaysLocal(today, -1);
    await prisma.dailyLoginClaim.create({
      data: {
        characterId: u.characterId,
        claimDateLocal: yesterday,
        linhThachDelta: 100n,
        streakAtClaim: 5,
      },
    });

    const r = await svc.claim(u.userId);
    expect(r.claimed).toBe(true);
    expect(r.newStreak).toBe(6);
  });

  it('claim sau gap (cách nhau >1 ngày) → streak reset về 1', async () => {
    const u = await makeUserChar(prisma);
    const tz = 'Asia/Ho_Chi_Minh';
    const today = getLocalDateString(new Date(), tz);
    const twoDaysAgo = addDaysLocal(today, -2);
    await prisma.dailyLoginClaim.create({
      data: {
        characterId: u.characterId,
        claimDateLocal: twoDaysAgo,
        linhThachDelta: 100n,
        streakAtClaim: 3,
      },
    });

    const r = await svc.claim(u.userId);
    expect(r.claimed).toBe(true);
    expect(r.newStreak).toBe(1);
  });

  it('user không có character → throw NO_CHARACTER', async () => {
    const fake = await prisma.user.create({
      data: { email: 'no-char-claim@xt.local', passwordHash: 'x' },
    });
    await expect(svc.claim(fake.id)).rejects.toBeInstanceOf(DailyLoginError);
  });
});
