import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { LeaderboardService } from './leaderboard.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let svc: LeaderboardService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  svc = new LeaderboardService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

describe('LeaderboardService.topByPower', () => {
  it('rỗng khi chưa có character', async () => {
    const rows = await svc.topByPower();
    expect(rows).toEqual([]);
  });

  it('sort theo realm order desc → realmStage desc → power desc', async () => {
    // A: phamnhan stage=1 power=999 (realm thấp nhất, power cao)
    const a = await makeUserChar(prisma, {
      realmKey: 'phamnhan',
      realmStage: 1,
      power: 999,
    });
    // B: luyenkhi stage=1 power=10 (realm cao hơn, power thấp)
    const b = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 1,
      power: 10,
    });
    // C: luyenkhi stage=5 power=5 (realm cao + stage cao)
    const c = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 5,
      power: 5,
    });
    const rows = await svc.topByPower(10);
    expect(rows.map((r) => r.characterId)).toEqual([
      c.characterId, // luyenkhi stage 5
      b.characterId, // luyenkhi stage 1
      a.characterId, // phamnhan stage 1
    ]);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
    expect(rows[2].rank).toBe(3);
  });

  it('exclude banned user', async () => {
    const banned = await makeUserChar(prisma, {
      realmKey: 'kim_dan',
      realmStage: 9,
      power: 9999,
    });
    await prisma.user.update({
      where: { id: banned.userId },
      data: { banned: true },
    });
    const ok = await makeUserChar(prisma, {
      realmKey: 'phamnhan',
      realmStage: 1,
      power: 5,
    });
    const rows = await svc.topByPower();
    expect(rows.map((r) => r.characterId)).toEqual([ok.characterId]);
  });

  it('limit clamp: nhập <1 → trả về 1, nhập >100 → cap 100', async () => {
    // Tạo 5 char để test slice
    for (let i = 0; i < 5; i += 1) {
      await makeUserChar(prisma, {
        realmKey: 'phamnhan',
        realmStage: 1,
        power: 10 + i,
      });
    }
    const tiny = await svc.topByPower(0); // → clamp to 1
    expect(tiny).toHaveLength(1);
    const big = await svc.topByPower(200); // → cap 100, only 5 chars exist
    expect(big.length).toBeLessThanOrEqual(100);
    expect(big).toHaveLength(5);
  });

  it('default limit = 50 khi không truyền', async () => {
    const rows = await svc.topByPower();
    expect(rows.length).toBeLessThanOrEqual(50);
  });

  it('row contains expected fields', async () => {
    const fix = await makeUserChar(prisma, {
      realmKey: 'truc_co',
      realmStage: 3,
      power: 250,
    });
    const rows = await svc.topByPower(1);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r).toMatchObject({
      rank: 1,
      characterId: fix.characterId,
      name: fix.name,
      realmKey: 'truc_co',
      realmStage: 3,
      power: 250,
      sectKey: null,
    });
    expect(typeof r.level).toBe('number');
  });

  it('sectKey populated khi character có sect', async () => {
    const sect = await prisma.sect.create({
      data: { name: 'Thanh Vân Môn' },
    });
    const fix = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 2,
      power: 50,
      sectId: sect.id,
    });
    const rows = await svc.topByPower(1);
    expect(rows[0].characterId).toBe(fix.characterId);
    expect(rows[0].sectKey).toBe('thanh_van');
  });
});
