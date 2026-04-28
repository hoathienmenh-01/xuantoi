import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MISSIONS, missionByKey } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import {
  MissionError,
  MissionService,
  getMissionResetTz,
  nextDailyWindowEnd,
  nextWeeklyWindowEnd,
} from './mission.service';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let missions: MissionService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  missions = makeMissionService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('MissionService — window helpers (UTC default)', () => {
  it('nextDailyWindowEnd: luôn 00:00:00 UTC và > now', () => {
    const now = new Date('2026-04-28T10:30:00.000Z');
    const end = nextDailyWindowEnd(now);
    expect(end.getUTCHours()).toBe(0);
    expect(end.getUTCMinutes()).toBe(0);
    expect(end.getUTCSeconds()).toBe(0);
    expect(end.getTime()).toBeGreaterThan(now.getTime());
    // Exactly 29/04 00:00 UTC
    expect(end.toISOString()).toBe('2026-04-29T00:00:00.000Z');
  });

  it('nextWeeklyWindowEnd: thứ Hai kế tiếp, 00:00 UTC', () => {
    // 28/04/2026 = thứ Ba → thứ Hai kế tiếp = 04/05/2026.
    const tuesday = new Date('2026-04-28T10:30:00.000Z');
    const end = nextWeeklyWindowEnd(tuesday);
    expect(end.getUTCDay()).toBe(1); // Monday
    expect(end.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('nextWeeklyWindowEnd: khi now = thứ Hai → trả về thứ Hai tuần sau (+7 ngày)', () => {
    const monday = new Date('2026-04-27T09:00:00.000Z'); // thứ Hai
    const end = nextWeeklyWindowEnd(monday);
    expect(end.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });
});

describe('MissionService — window helpers (Asia/Ho_Chi_Minh, UTC+07)', () => {
  const TZ = 'Asia/Ho_Chi_Minh';

  it('nextDailyWindowEnd VN: 28/04 10:30 UTC ⇒ 28/04 17:00 UTC (29/04 00:00 VN)', () => {
    // 28/04/2026 10:30 UTC = 28/04 17:30 VN → next 00:00 VN = 29/04 00:00 VN = 28/04 17:00 UTC.
    const now = new Date('2026-04-28T10:30:00.000Z');
    const end = nextDailyWindowEnd(now, TZ);
    expect(end.toISOString()).toBe('2026-04-28T17:00:00.000Z');
    expect(end.getTime()).toBeGreaterThan(now.getTime());
  });

  it('nextDailyWindowEnd VN: 28/04 18:00 UTC (= 29/04 01:00 VN) ⇒ 30/04 00:00 VN', () => {
    const now = new Date('2026-04-28T18:00:00.000Z');
    const end = nextDailyWindowEnd(now, TZ);
    expect(end.toISOString()).toBe('2026-04-29T17:00:00.000Z'); // = 30/04 00:00 VN
  });

  it('nextWeeklyWindowEnd VN: thuộc 28/04 (thứ Ba VN) ⇒ 04/05 00:00 VN = 03/05 17:00 UTC', () => {
    const now = new Date('2026-04-28T10:30:00.000Z'); // thứ Ba VN.
    const end = nextWeeklyWindowEnd(now, TZ);
    expect(end.toISOString()).toBe('2026-05-03T17:00:00.000Z');
  });

  it('nextWeeklyWindowEnd VN: thứ Hai 00:00 VN ⇒ thứ Hai tuần sau (+7 ngày)', () => {
    // 27/04 00:00 VN = 26/04 17:00 UTC.
    const now = new Date('2026-04-26T17:00:00.000Z');
    const end = nextWeeklyWindowEnd(now, TZ);
    expect(end.toISOString()).toBe('2026-05-03T17:00:00.000Z');
  });
});

describe('MissionService — getMissionResetTz()', () => {
  const ORIG = process.env.MISSION_RESET_TZ;
  afterAll(() => {
    if (ORIG === undefined) delete process.env.MISSION_RESET_TZ;
    else process.env.MISSION_RESET_TZ = ORIG;
  });

  it('default Asia/Ho_Chi_Minh khi env trống', () => {
    delete process.env.MISSION_RESET_TZ;
    expect(getMissionResetTz()).toBe('Asia/Ho_Chi_Minh');
  });

  it('default Asia/Ho_Chi_Minh khi env là chuỗi trắng', () => {
    process.env.MISSION_RESET_TZ = '   ';
    expect(getMissionResetTz()).toBe('Asia/Ho_Chi_Minh');
  });

  it('respect env override (UTC)', () => {
    process.env.MISSION_RESET_TZ = 'UTC';
    expect(getMissionResetTz()).toBe('UTC');
  });
});

describe('MissionService — ensureRows & listForUser', () => {
  it('ensureRows: idempotent — gọi nhiều lần không tạo duplicate', async () => {
    const u = await makeUserChar(prisma);
    await missions.ensureRows(u.characterId);
    await missions.ensureRows(u.characterId);
    const rows = await prisma.missionProgress.findMany({
      where: { characterId: u.characterId },
    });
    expect(rows.length).toBe(MISSIONS.length);
  });

  it('listForUser: trả đủ catalog + completable=false ban đầu', async () => {
    const u = await makeUserChar(prisma);
    const list = await missions.listForUser(u.userId);
    expect(list.length).toBe(MISSIONS.length);
    expect(list.every((m) => m.currentAmount === 0)).toBe(true);
    expect(list.every((m) => !m.claimed)).toBe(true);
    expect(list.every((m) => !m.completable)).toBe(true);
    // DAILY + WEEKLY có windowEnd, ONCE thì null.
    for (const m of list) {
      if (m.period === 'ONCE') expect(m.windowEnd).toBeNull();
      else expect(m.windowEnd).not.toBeNull();
    }
  });

  it('listForUser: no character → NO_CHARACTER', async () => {
    await expect(missions.listForUser('missing-user')).rejects.toBeInstanceOf(
      MissionError,
    );
  });
});

describe('MissionService — track', () => {
  it('track CULTIVATE_SECONDS: cộng đúng vào daily + weekly cùng goalKind', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'CULTIVATE_SECONDS', 300);
    const list = await missions.listForUser(u.userId);
    const daily = list.find((m) => m.key === 'daily_cultivate_600s')!;
    const weekly = list.find((m) => m.key === 'weekly_cultivate_18000s')!;
    expect(daily.currentAmount).toBe(300);
    expect(weekly.currentAmount).toBe(300);
  });

  it('track: cap tại goalAmount, không vượt', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'CULTIVATE_SECONDS', 10000);
    const list = await missions.listForUser(u.userId);
    const daily = list.find((m) => m.key === 'daily_cultivate_600s')!;
    expect(daily.currentAmount).toBe(600); // goalAmount
    expect(daily.completable).toBe(true);
  });

  it('track amount <= 0 → no-op', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'KILL_MONSTER', 0);
    await missions.track(u.characterId, 'KILL_MONSTER', -5);
    const list = await missions.listForUser(u.userId);
    const daily = list.find((m) => m.key === 'daily_kill_monster_5')!;
    expect(daily.currentAmount).toBe(0);
  });

  it('track: mission đã claimed không cộng tiếp', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'BOSS_HIT', 100);
    await missions.claim(u.userId, 'once_first_boss_hit');
    await missions.track(u.characterId, 'BOSS_HIT', 100);
    const list = await missions.listForUser(u.userId);
    const once = list.find((m) => m.key === 'once_first_boss_hit')!;
    expect(once.claimed).toBe(true);
    // daily vẫn tiếp tục trừ bounds
    const daily = list.find((m) => m.key === 'daily_boss_hit_3')!;
    expect(daily.currentAmount).toBe(3);
  });
});

describe('MissionService — claim', () => {
  it('claim NOT_READY: chưa đủ goalAmount', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      missions.claim(u.userId, 'daily_kill_monster_5'),
    ).rejects.toMatchObject({ code: 'NOT_READY' });
  });

  it('claim MISSION_UNKNOWN: key không có trong catalog', async () => {
    const u = await makeUserChar(prisma);
    await expect(missions.claim(u.userId, 'xyz_not_exist')).rejects.toMatchObject({
      code: 'MISSION_UNKNOWN',
    });
  });

  it('claim success: trả linhThach + ghi ledger MISSION_CLAIM', async () => {
    const u = await makeUserChar(prisma, { linhThach: 0n });
    await missions.track(u.characterId, 'KILL_MONSTER', 5);
    await missions.claim(u.userId, 'daily_kill_monster_5');
    const c = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
    });
    const def = missionByKey('daily_kill_monster_5')!;
    expect(c.linhThach).toBe(BigInt(def.rewards.linhThach!));
    expect(c.exp).toBe(BigInt(def.rewards.exp!));

    const ledger = await prisma.currencyLedger.findFirstOrThrow({
      where: { characterId: u.characterId, reason: 'MISSION_CLAIM' },
    });
    expect(ledger.delta).toBe(BigInt(def.rewards.linhThach!));
    expect(ledger.refId).toBe('daily_kill_monster_5');
  });

  it('claim double ALREADY_CLAIMED', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'KILL_MONSTER', 5);
    await missions.claim(u.userId, 'daily_kill_monster_5');
    await expect(
      missions.claim(u.userId, 'daily_kill_monster_5'),
    ).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });
  });

  it('claim mission có item reward: grant vào inventory', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'BREAKTHROUGH', 1);
    await missions.claim(u.userId, 'once_first_breakthrough');
    const rows = await prisma.inventoryItem.findMany({
      where: { characterId: u.characterId, itemKey: 'thanh_lam_dan' },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.reduce((acc, r) => acc + r.qty, 0)).toBeGreaterThanOrEqual(2);
  });

  it('claim sect contribute: tăng congHien từ reward', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'SECT_CONTRIBUTE', 200);
    await missions.claim(u.userId, 'daily_sect_contribute_100');
    const c = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
    });
    const def = missionByKey('daily_sect_contribute_100')!;
    expect(c.congHien).toBe(def.rewards.congHien!);
  });
});

describe('MissionService — resetPeriod', () => {
  it('resetPeriod DAILY: reset row quá hạn, giữ row chưa hạn và ONCE', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'KILL_MONSTER', 5);
    await missions.track(u.characterId, 'CLEAR_DUNGEON', 1);
    await missions.claim(u.userId, 'once_first_dungeon');

    // Ép windowEnd về quá khứ để reset kick in.
    const past = new Date('2020-01-01T00:00:00.000Z');
    await prisma.missionProgress.updateMany({
      where: { characterId: u.characterId, period: 'DAILY' },
      data: { windowEnd: past },
    });

    const count = await missions.resetPeriod('DAILY');
    expect(count).toBeGreaterThan(0);

    const list = await missions.listForUser(u.userId);
    const daily = list.find((m) => m.key === 'daily_kill_monster_5')!;
    expect(daily.currentAmount).toBe(0);
    expect(daily.claimed).toBe(false);
    // ONCE không bị reset — vẫn giữ claimed.
    const once = list.find((m) => m.key === 'once_first_dungeon')!;
    expect(once.claimed).toBe(true);
  });

  it('resetPeriod: không reset row còn trong cửa sổ', async () => {
    const u = await makeUserChar(prisma);
    await missions.track(u.characterId, 'KILL_MONSTER', 3);
    const before = await missions.listForUser(u.userId);
    const beforeDaily = before.find((m) => m.key === 'daily_kill_monster_5')!;
    expect(beforeDaily.currentAmount).toBe(3);

    const count = await missions.resetPeriod('DAILY');
    expect(count).toBe(0);

    const after = await missions.listForUser(u.userId);
    const afterDaily = after.find((m) => m.key === 'daily_kill_monster_5')!;
    expect(afterDaily.currentAmount).toBe(3);
  });

  it('resetPeriod DAILY → windowEnd được đẩy lên cửa sổ kế tiếp', async () => {
    const u = await makeUserChar(prisma);
    await missions.ensureRows(u.characterId);
    const past = new Date('2020-01-01T00:00:00.000Z');
    await prisma.missionProgress.updateMany({
      where: { characterId: u.characterId, period: 'DAILY' },
      data: { windowEnd: past },
    });
    await missions.resetPeriod('DAILY');
    const rows = await prisma.missionProgress.findMany({
      where: { characterId: u.characterId, period: 'DAILY' },
    });
    for (const r of rows) {
      expect(r.windowEnd).not.toBeNull();
      expect(r.windowEnd!.getTime()).toBeGreaterThan(Date.now());
    }
  });
});
