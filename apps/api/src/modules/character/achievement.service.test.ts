import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as shared from '@xuantoi/shared';
import {
  achievementsByGoalKind,
  getAchievementDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import {
  AchievementError,
  ACHIEVEMENT_CATALOG_COUNT,
  AchievementService,
} from './achievement.service';
import { CurrencyService } from './currency.service';
import { TitleService } from './title.service';
import { InventoryService } from '../inventory/inventory.service';
import { CharacterService } from './character.service';
import { RealtimeService } from '../realtime/realtime.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let svc: AchievementService;
let currency: CurrencyService;
let title: TitleService;
let inventory: InventoryService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  currency = new CurrencyService(prisma);
  title = new TitleService(prisma);
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  inventory = new InventoryService(prisma, realtime, chars);
  svc = new AchievementService(prisma, currency, title, inventory);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AchievementService.incrementProgress — happy path', () => {
  it('increment achievement mới → tạo row + progress=1, chưa complete (goal 100)', async () => {
    const ctx = await makeUserChar(prisma);
    const r = await svc.incrementProgress(
      ctx.characterId,
      'kill_100_monsters',
      1,
    );
    expect(r.achievementKey).toBe('kill_100_monsters');
    expect(r.progress).toBe(1);
    expect(r.completedAt).toBeNull();
    expect(r.justCompleted).toBe(false);

    const rows = await prisma.characterAchievement.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].progress).toBe(1);
    expect(rows[0].completedAt).toBeNull();
  });

  it('increment đạt goal (1) → set completedAt + justCompleted=true', async () => {
    const ctx = await makeUserChar(prisma);
    const r = await svc.incrementProgress(
      ctx.characterId,
      'first_monster_kill',
      1,
    );
    expect(r.progress).toBe(1);
    expect(r.completedAt).toBeInstanceOf(Date);
    expect(r.justCompleted).toBe(true);
  });

  it('increment cumulative qua nhiều call → progress cộng dồn, complete khi đủ goal', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 30);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 30);
    const r3 = await svc.incrementProgress(
      ctx.characterId,
      'kill_100_monsters',
      40,
    );
    expect(r3.progress).toBe(100);
    expect(r3.completedAt).toBeInstanceOf(Date);
    expect(r3.justCompleted).toBe(true);
  });

  it('progress capped tại goalAmount (over-increment không vượt goal)', async () => {
    const ctx = await makeUserChar(prisma);
    const r = await svc.incrementProgress(
      ctx.characterId,
      'kill_100_monsters',
      500,
    );
    expect(r.progress).toBe(100); // capped tại goalAmount=100
    expect(r.completedAt).toBeInstanceOf(Date);
    expect(r.justCompleted).toBe(true);
  });

  it('idempotent: increment sau khi đã complete → KHÔNG đổi progress, KHÔNG đổi completedAt, justCompleted=false', async () => {
    const ctx = await makeUserChar(prisma);
    const r1 = await svc.incrementProgress(
      ctx.characterId,
      'first_monster_kill',
      1,
    );
    expect(r1.completedAt).toBeInstanceOf(Date);
    const completedAtBefore = r1.completedAt!.getTime();

    // wait 5ms để chắc chắn timestamp khác nếu không idempotent
    await new Promise((res) => setTimeout(res, 5));

    const r2 = await svc.incrementProgress(
      ctx.characterId,
      'first_monster_kill',
      10,
    );
    expect(r2.progress).toBe(1); // không tăng quá goal
    expect(r2.completedAt).toBeInstanceOf(Date);
    expect(r2.completedAt!.getTime()).toBe(completedAtBefore); // KHÔNG đổi
    expect(r2.justCompleted).toBe(false);
  });
});

describe('AchievementService.incrementProgress — errors', () => {
  it('throws ACHIEVEMENT_NOT_FOUND khi key không có catalog', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.incrementProgress(ctx.characterId, 'achievement_does_not_exist', 1),
    ).rejects.toMatchObject({ code: 'ACHIEVEMENT_NOT_FOUND' });
  });

  it('throws CHARACTER_NOT_FOUND khi character không tồn tại', async () => {
    await expect(
      svc.incrementProgress('char_does_not_exist', 'first_monster_kill', 1),
    ).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('throws INVALID_AMOUNT khi amount = 0', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.incrementProgress(ctx.characterId, 'first_monster_kill', 0),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('throws INVALID_AMOUNT khi amount âm', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.incrementProgress(ctx.characterId, 'first_monster_kill', -5),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('throws INVALID_AMOUNT khi amount không integer', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1.5),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });
});

describe('AchievementService.trackEvent — bulk by goalKind', () => {
  it('track KILL_MONSTER amount=1 → tăng tất cả achievement KILL_MONSTER (incl. first_monster_kill, kill_100/1000, element specialists)', async () => {
    const ctx = await makeUserChar(prisma);
    const results = await svc.trackEvent(ctx.characterId, 'KILL_MONSTER', 1);

    const killAchievements = achievementsByGoalKind('KILL_MONSTER');
    expect(results).toHaveLength(killAchievements.length);

    // first_monster_kill (goal 1) phải complete
    const firstKill = results.find(
      (r) => r.achievementKey === 'first_monster_kill',
    );
    expect(firstKill?.justCompleted).toBe(true);
    expect(firstKill?.progress).toBe(1);

    // kill_100_monsters (goal 100) chưa complete
    const kill100 = results.find(
      (r) => r.achievementKey === 'kill_100_monsters',
    );
    expect(kill100?.justCompleted).toBe(false);
    expect(kill100?.progress).toBe(1);
  });

  it('track BREAKTHROUGH amount=1 → first_breakthrough complete, reach_truc_co progress=1', async () => {
    const ctx = await makeUserChar(prisma);
    const results = await svc.trackEvent(ctx.characterId, 'BREAKTHROUGH', 1);

    const firstBT = results.find(
      (r) => r.achievementKey === 'first_breakthrough',
    );
    expect(firstBT?.justCompleted).toBe(true);

    const reachTrucCo = results.find(
      (r) => r.achievementKey === 'reach_truc_co',
    );
    expect(reachTrucCo?.progress).toBe(1);
    expect(reachTrucCo?.completedAt).toBeNull();
  });

  it('trackEvent goalKind không có achievement nào → return empty array', async () => {
    const ctx = await makeUserChar(prisma);
    // Tìm goalKind chưa được dùng (rare). MissionGoalKind union: nếu tất cả đều
    // có achievement, test này dùng giá trị bất kỳ và check defs.length:
    const allKinds = [
      'KILL_MONSTER',
      'CLEAR_DUNGEON',
      'BOSS_HIT',
      'BREAKTHROUGH',
      'GAIN_EXP',
      'CULTIVATE_SECONDS',
      'BUY_LISTING',
      'SELL_LISTING',
      'CHAT_MESSAGE',
      'SECT_CONTRIBUTE',
    ] as const;
    for (const kind of allKinds) {
      const defs = achievementsByGoalKind(kind);
      const results = await svc.trackEvent(ctx.characterId, kind, 1);
      expect(results).toHaveLength(defs.length);
    }
  });

  it('trackEvent throws INVALID_AMOUNT khi amount <= 0', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.trackEvent(ctx.characterId, 'KILL_MONSTER', 0),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('trackEvent throws CHARACTER_NOT_FOUND khi character không tồn tại (bubble từ incrementProgress)', async () => {
    await expect(
      svc.trackEvent('char_does_not_exist', 'KILL_MONSTER', 1),
    ).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });
});

describe('AchievementService.getProgress', () => {
  it('return null nếu chưa từng track', async () => {
    const ctx = await makeUserChar(prisma);
    const r = await svc.getProgress(ctx.characterId, 'kill_100_monsters');
    expect(r).toBeNull();
  });

  it('return state + def metadata sau khi track', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 25);
    const r = await svc.getProgress(ctx.characterId, 'kill_100_monsters');
    expect(r).not.toBeNull();
    expect(r!.progress).toBe(25);
    expect(r!.completedAt).toBeNull();
    expect(r!.def.key).toBe('kill_100_monsters');
    expect(r!.def.goalAmount).toBe(100);
  });

  it('throws ACHIEVEMENT_NOT_FOUND khi key không có catalog', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.getProgress(ctx.characterId, 'achievement_does_not_exist'),
    ).rejects.toMatchObject({ code: 'ACHIEVEMENT_NOT_FOUND' });
  });
});

describe('AchievementService.listAll', () => {
  it('return empty khi character chưa track gì', async () => {
    const ctx = await makeUserChar(prisma);
    const list = await svc.listAll(ctx.characterId);
    expect(list).toEqual([]);
  });

  it('return tất cả row + def metadata, sort theo createdAt asc', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);
    await new Promise((res) => setTimeout(res, 5));
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 50);

    const list = await svc.listAll(ctx.characterId);
    expect(list).toHaveLength(2);
    expect(list[0].achievementKey).toBe('first_monster_kill');
    expect(list[0].completedAt).toBeInstanceOf(Date);
    expect(list[1].achievementKey).toBe('kill_100_monsters');
    expect(list[1].progress).toBe(50);
    expect(list[1].completedAt).toBeNull();
    expect(list[1].def.goalAmount).toBe(100);
  });

  it('defensive: skip row có achievementKey không còn trong catalog', async () => {
    const ctx = await makeUserChar(prisma);
    // Insert raw row với key không trong catalog
    await prisma.characterAchievement.create({
      data: {
        characterId: ctx.characterId,
        achievementKey: 'achievement_renamed_or_deleted',
        progress: 5,
      },
    });
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

    const list = await svc.listAll(ctx.characterId);
    expect(list).toHaveLength(1); // chỉ valid catalog
    expect(list[0].achievementKey).toBe('first_monster_kill');
  });
});

describe('AchievementService.listCompleted', () => {
  it('return empty khi chưa có cái nào complete', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 50);
    const list = await svc.listCompleted(ctx.characterId);
    expect(list).toEqual([]);
  });

  it('return chỉ row đã completedAt != null, sort completedAt asc', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);
    await new Promise((res) => setTimeout(res, 5));
    await svc.incrementProgress(ctx.characterId, 'first_breakthrough', 1);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 30); // chưa complete

    const list = await svc.listCompleted(ctx.characterId);
    expect(list).toHaveLength(2);
    expect(list[0].achievementKey).toBe('first_monster_kill');
    expect(list[1].achievementKey).toBe('first_breakthrough');
    list.forEach((entry) => {
      expect(entry.completedAt).toBeInstanceOf(Date);
    });
  });
});

describe('AchievementService.getProgressByGoalKind', () => {
  it('return entry cho mọi achievement match goalKind, kể cả chưa track (progress=0, completedAt=null)', async () => {
    const ctx = await makeUserChar(prisma);
    const list = await svc.getProgressByGoalKind(ctx.characterId, 'KILL_MONSTER');

    const defs = achievementsByGoalKind('KILL_MONSTER');
    expect(list).toHaveLength(defs.length);
    list.forEach((entry) => {
      expect(entry.progress).toBe(0);
      expect(entry.completedAt).toBeNull();
      expect(entry.def.goalKind).toBe('KILL_MONSTER');
    });
  });

  it('reflect progress sau khi track', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 30);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

    const list = await svc.getProgressByGoalKind(ctx.characterId, 'KILL_MONSTER');
    const firstKill = list.find((e) => e.achievementKey === 'first_monster_kill');
    expect(firstKill?.progress).toBe(1);
    expect(firstKill?.completedAt).toBeInstanceOf(Date);

    const kill100 = list.find((e) => e.achievementKey === 'kill_100_monsters');
    expect(kill100?.progress).toBe(30);
    expect(kill100?.completedAt).toBeNull();
  });
});

describe('AchievementService — cross-character isolation', () => {
  it('progress char A không leak qua char B', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    await svc.incrementProgress(a.characterId, 'kill_100_monsters', 50);

    const ra = await svc.getProgress(a.characterId, 'kill_100_monsters');
    const rb = await svc.getProgress(b.characterId, 'kill_100_monsters');
    expect(ra?.progress).toBe(50);
    expect(rb).toBeNull();

    const listA = await svc.listAll(a.characterId);
    const listB = await svc.listAll(b.characterId);
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(0);
  });
});

describe('AchievementError class', () => {
  it('có name + code property', () => {
    const err = new AchievementError('ACHIEVEMENT_NOT_FOUND');
    expect(err.name).toBe('AchievementError');
    expect(err.code).toBe('ACHIEVEMENT_NOT_FOUND');
    expect(err.message).toBe('ACHIEVEMENT_NOT_FOUND');
    expect(err).toBeInstanceOf(Error);
  });

  it('cho phép custom message', () => {
    const err = new AchievementError('INVALID_AMOUNT', 'amount must be positive');
    expect(err.code).toBe('INVALID_AMOUNT');
    expect(err.message).toBe('amount must be positive');
  });
});

describe('AchievementService.claimReward — Phase 11.10.C-1', () => {
  it('claim achievement đã complete với rewardTitleKey → grant linhThach + exp + auto-unlock title', async () => {
    const ctx = await makeUserChar(prisma);
    const before = await prisma.character.findUnique({
      where: { id: ctx.characterId },
      select: { linhThach: true, exp: true },
    });
    const beforeLinhThach = BigInt(before!.linhThach);
    const beforeExp = BigInt(before!.exp);

    // Complete `first_monster_kill` (goal 1, reward linhThach 100 + exp 50,
    // rewardTitleKey 'achievement_first_kill').
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

    const result = await svc.claimReward(ctx.characterId, 'first_monster_kill');

    expect(result.achievementKey).toBe('first_monster_kill');
    expect(result.claimedAt).toBeInstanceOf(Date);
    expect(result.granted.linhThach).toBe(100);
    expect(result.granted.tienNgoc).toBe(0);
    expect(result.granted.exp).toBe(50);
    expect(result.granted.titleKey).toBe('achievement_first_kill');

    const after = await prisma.character.findUnique({
      where: { id: ctx.characterId },
      select: { linhThach: true, exp: true },
    });
    expect(BigInt(after!.linhThach) - beforeLinhThach).toBe(100n);
    expect(BigInt(after!.exp) - beforeExp).toBe(50n);

    const titleRow = await prisma.characterTitleUnlock.findUnique({
      where: {
        characterId_titleKey: {
          characterId: ctx.characterId,
          titleKey: 'achievement_first_kill',
        },
      },
    });
    expect(titleRow).not.toBeNull();
    expect(titleRow?.source).toBe('achievement');

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'ACHIEVEMENT_REWARD' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].refType).toBe('Achievement');
    expect(ledger[0].refId).toBe('first_monster_kill');
    expect(BigInt(ledger[0].delta)).toBe(100n);
  });

  it('claim achievement không có rewardTitleKey → grant currency/exp, không unlock title', async () => {
    const ctx = await makeUserChar(prisma);
    // `kill_100_monsters` goal 100, reward linhThach 1000 + exp 500,
    // rewardTitleKey null.
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 100);

    const result = await svc.claimReward(ctx.characterId, 'kill_100_monsters');
    expect(result.granted.linhThach).toBe(1000);
    expect(result.granted.exp).toBe(500);
    expect(result.granted.titleKey).toBeNull();

    const titles = await prisma.characterTitleUnlock.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(titles).toHaveLength(0);
  });

  it('claim 2 lần liên tiếp → lần 2 throw ALREADY_CLAIMED, không grant double', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

    await svc.claimReward(ctx.characterId, 'first_monster_kill');
    const before = await prisma.character.findUnique({
      where: { id: ctx.characterId },
      select: { linhThach: true },
    });

    await expect(
      svc.claimReward(ctx.characterId, 'first_monster_kill'),
    ).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });

    const after = await prisma.character.findUnique({
      where: { id: ctx.characterId },
      select: { linhThach: true },
    });
    expect(BigInt(after!.linhThach)).toBe(BigInt(before!.linhThach));

    // Title unlock vẫn idempotent — chỉ 1 row.
    const titles = await prisma.characterTitleUnlock.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(titles).toHaveLength(1);

    // Ledger entry vẫn chỉ 1.
    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'ACHIEVEMENT_REWARD' },
    });
    expect(ledger).toHaveLength(1);
  });

  it('claim achievement chưa complete → throw NOT_COMPLETED', async () => {
    const ctx = await makeUserChar(prisma);
    // Chỉ track 50/100 — chưa đạt goal.
    await svc.incrementProgress(ctx.characterId, 'kill_100_monsters', 50);

    await expect(
      svc.claimReward(ctx.characterId, 'kill_100_monsters'),
    ).rejects.toMatchObject({ code: 'NOT_COMPLETED' });

    // Không grant gì.
    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'ACHIEVEMENT_REWARD' },
    });
    expect(ledger).toHaveLength(0);
  });

  it('claim achievement chưa từng track → throw NOT_FOUND_PROGRESS', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.claimReward(ctx.characterId, 'first_monster_kill'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND_PROGRESS' });
  });

  it('claim achievementKey không có catalog → throw ACHIEVEMENT_NOT_FOUND', async () => {
    const ctx = await makeUserChar(prisma);
    await expect(
      svc.claimReward(ctx.characterId, 'achievement_does_not_exist'),
    ).rejects.toMatchObject({ code: 'ACHIEVEMENT_NOT_FOUND' });
  });

  it('claim với character không tồn tại → throw CHARACTER_NOT_FOUND', async () => {
    await expect(
      svc.claimReward('char_does_not_exist', 'first_monster_kill'),
    ).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('claim concurrent x2 → 1 winner, 1 loser ALREADY_CLAIMED, ledger 1 dòng', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

    const [r1, r2] = await Promise.allSettled([
      svc.claimReward(ctx.characterId, 'first_monster_kill'),
      svc.claimReward(ctx.characterId, 'first_monster_kill'),
    ]);
    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'ALREADY_CLAIMED',
    });

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'ACHIEVEMENT_REWARD' },
    });
    expect(ledger).toHaveLength(1);

    const after = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    // Linh thạch chỉ tăng 100 (1 grant), không phải 200.
    const meta = (await prisma.character.findUnique({
      where: { id: ctx.characterId },
      select: { linhThach: true },
    }))!;
    // Verify value matches the single grant of 100. We can't compare absolute
    // value reliably without baseline, so just compare via the ledger.
    const sum = ledger.reduce((s, l) => s + BigInt(l.delta), 0n);
    expect(sum).toBe(100n);
    expect(after).not.toBeNull();
    void meta;
  });

  it('row trạng thái sau claim: completedAt giữ nguyên, claimedAt set, progress giữ nguyên', async () => {
    const ctx = await makeUserChar(prisma);
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);
    const beforeRow = await prisma.characterAchievement.findUnique({
      where: {
        characterId_achievementKey: {
          characterId: ctx.characterId,
          achievementKey: 'first_monster_kill',
        },
      },
    });

    await svc.claimReward(ctx.characterId, 'first_monster_kill');

    const afterRow = await prisma.characterAchievement.findUnique({
      where: {
        characterId_achievementKey: {
          characterId: ctx.characterId,
          achievementKey: 'first_monster_kill',
        },
      },
    });
    expect(afterRow!.completedAt).toEqual(beforeRow!.completedAt);
    expect(afterRow!.progress).toBe(beforeRow!.progress);
    expect(afterRow!.claimedAt).not.toBeNull();
    expect(afterRow!.claimedAt).toBeInstanceOf(Date);
  });
});

describe('AchievementService.claimReward item rewards (Phase 11.10.D)', () => {
  // Spy `getAchievementDef` để inject fake def với `reward.items` non-empty.
  // 32 baseline catalog không có items, nên runtime path identity. Wire này
  // future-proof — khi catalog thêm achievement với `reward.items`, claim sẽ
  // grant qua `InventoryService.grantTx` reason `'ACHIEVEMENT_REWARD'`.
  it('claim achievement với reward.items non-empty → grant items + InventoryItem row + ItemLedger entry', async () => {
    const ctx = await makeUserChar(prisma);
    const realDef = getAchievementDef('first_monster_kill');
    expect(realDef).toBeDefined();
    const spy = vi.spyOn(shared, 'getAchievementDef').mockReturnValue({
      ...realDef!,
      reward: {
        ...realDef!.reward,
        items: [{ itemKey: 'huyet_chi_dan', qty: 3 }],
      },
    });
    try {
      // Track progress qua call thực — nhưng `getAchievementDef` đã spy.
      // `incrementProgress` sẽ gọi spy → fake def. Goal 1 → ngay complete.
      await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);

      const result = await svc.claimReward(ctx.characterId, 'first_monster_kill');

      expect(result.granted.items).toHaveLength(1);
      expect(result.granted.items[0]).toEqual({
        itemKey: 'huyet_chi_dan',
        qty: 3,
      });

      // Verify InventoryItem row tạo.
      const invRows = await prisma.inventoryItem.findMany({
        where: { characterId: ctx.characterId, itemKey: 'huyet_chi_dan' },
      });
      expect(invRows).toHaveLength(1);
      expect(invRows[0].qty).toBe(3);

      // Verify ItemLedger entry — reason ACHIEVEMENT_REWARD + refType +
      // refId match achievementKey.
      const ledger = await prisma.itemLedger.findMany({
        where: {
          characterId: ctx.characterId,
          reason: 'ACHIEVEMENT_REWARD',
        },
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].itemKey).toBe('huyet_chi_dan');
      expect(ledger[0].qtyDelta).toBe(3);
      expect(ledger[0].refType).toBe('Achievement');
      expect(ledger[0].refId).toBe('first_monster_kill');
    } finally {
      spy.mockRestore();
    }
  });

  it('claim achievement với reward.items empty → granted.items rỗng, không InventoryItem/ItemLedger entry', async () => {
    const ctx = await makeUserChar(prisma);
    // Real catalog `first_monster_kill` không có items → identity path.
    await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);
    const result = await svc.claimReward(ctx.characterId, 'first_monster_kill');

    expect(result.granted.items).toEqual([]);
    const invRows = await prisma.inventoryItem.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(invRows).toHaveLength(0);
    const ledger = await prisma.itemLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'ACHIEVEMENT_REWARD' },
    });
    expect(ledger).toHaveLength(0);
  });

  it('claim 2 lần liên tiếp với reward.items → lần 2 throw ALREADY_CLAIMED, không grant double items', async () => {
    const ctx = await makeUserChar(prisma);
    const realDef = getAchievementDef('first_monster_kill');
    const spy = vi.spyOn(shared, 'getAchievementDef').mockReturnValue({
      ...realDef!,
      reward: {
        ...realDef!.reward,
        items: [{ itemKey: 'huyet_chi_dan', qty: 2 }],
      },
    });
    try {
      await svc.incrementProgress(ctx.characterId, 'first_monster_kill', 1);
      await svc.claimReward(ctx.characterId, 'first_monster_kill');
      await expect(
        svc.claimReward(ctx.characterId, 'first_monster_kill'),
      ).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });

      // Inventory + ledger chỉ 1 grant (qty 2), không double.
      const invRows = await prisma.inventoryItem.findMany({
        where: { characterId: ctx.characterId, itemKey: 'huyet_chi_dan' },
      });
      expect(invRows).toHaveLength(1);
      expect(invRows[0].qty).toBe(2);
      const ledger = await prisma.itemLedger.findMany({
        where: {
          characterId: ctx.characterId,
          reason: 'ACHIEVEMENT_REWARD',
        },
      });
      expect(ledger).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('AchievementService — catalog integrity sanity', () => {
  it('ACHIEVEMENT_CATALOG_COUNT khớp với getAchievementDef lookup', () => {
    expect(ACHIEVEMENT_CATALOG_COUNT).toBeGreaterThan(0);
    expect(getAchievementDef('first_monster_kill')).toBeDefined();
    expect(getAchievementDef('kill_100_monsters')?.goalAmount).toBe(100);
  });
});
