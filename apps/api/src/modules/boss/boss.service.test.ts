import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BossStatus } from '@prisma/client';
import { BOSSES, bossByKey } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { BossService } from './boss.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let boss: BossService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const inventory = new InventoryService(prisma, realtime, chars);
  const currency = new CurrencyService(prisma);
  boss = new BossService(prisma, realtime, chars, inventory, currency);
});

beforeEach(async () => {
  await wipeAll(prisma);
  // Reset cooldown map giữa các test (private field, cast để truy cập).
  (boss as unknown as { cooldowns: Map<string, number> }).cooldowns.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const DEF = BOSSES[0];

async function spawnBoss(
  opts: { currentHp?: bigint; rewardTotal?: bigint; level?: number } = {},
) {
  const def = bossByKey(DEF.key)!;
  const level = opts.level ?? 1;
  const maxHp = BigInt(def.baseMaxHp) * BigInt(level);
  return prisma.worldBoss.create({
    data: {
      bossKey: def.key,
      name: def.name,
      level,
      maxHp,
      currentHp: opts.currentHp ?? maxHp,
      status: BossStatus.ACTIVE,
      spawnedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      rewardTotal: opts.rewardTotal ?? BigInt(def.baseRewardLinhThach) * BigInt(level),
    },
  });
}

describe('BossService', () => {
  it('attack: 1 hit ghi BossDamage cho character + giảm currentHp boss', async () => {
    const a = await makeUserChar(prisma, { mp: 100, stamina: 100 });
    const w = await spawnBoss({ currentHp: 10000n });

    const out = await boss.attack(a.userId, undefined);
    expect(out.result.defeated).toBe(false);
    expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);

    const dmgRow = await prisma.bossDamage.findUniqueOrThrow({
      where: { bossId_characterId: { bossId: w.id, characterId: a.characterId } },
    });
    expect(dmgRow.hits).toBe(1);
    expect(dmgRow.totalDamage).toBeGreaterThan(0n);

    const updated = await prisma.worldBoss.findUniqueOrThrow({ where: { id: w.id } });
    expect(updated.currentHp).toBeLessThan(10000n);
    expect(updated.status).toBe(BossStatus.ACTIVE);
  });

  it('attack: hạ boss → status DEFEATED + chia thưởng top1 (50%) + ghi ledger BOSS_REWARD', async () => {
    const a = await makeUserChar(prisma, {
      mp: 100,
      stamina: 100,
      power: 10000, // power cực cao để 1 hit chắc chắn giết
      linhThach: 0n,
    });
    const w = await spawnBoss({ currentHp: 1n, rewardTotal: 10_000n });

    const out = await boss.attack(a.userId, undefined);
    expect(out.result.defeated).toBe(true);
    expect(out.defeated).not.toBeNull();

    const updated = await prisma.worldBoss.findUniqueOrThrow({ where: { id: w.id } });
    expect(updated.status).toBe(BossStatus.DEFEATED);
    expect(updated.currentHp).toBe(0n);

    // Top1 = 50% pool = 5000
    const c = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    expect(c.linhThach).toBe(5000n);

    const ledger = await prisma.currencyLedger.findFirstOrThrow({
      where: {
        characterId: a.characterId,
        reason: 'BOSS_REWARD',
        refType: 'WorldBoss',
        refId: w.id,
      },
    });
    expect(ledger.delta).toBe(5000n);
  });

  it('attack: 3 character → top1 50% + top2 15% + top3 15% + ghi 3 ledger row', async () => {
    const a = await makeUserChar(prisma, { mp: 100, stamina: 100, power: 50000, linhThach: 0n });
    const b = await makeUserChar(prisma, { mp: 100, stamina: 100, power: 1000, linhThach: 0n });
    const c = await makeUserChar(prisma, { mp: 100, stamina: 100, power: 100, linhThach: 0n });
    // Boss HP nhỏ để 1 hit của a giết, nhưng đủ để b/c hit trước không die.
    await spawnBoss({ currentHp: 30_000n, rewardTotal: 10_000n });

    // b và c hit trước (damage thấp), a hit sau (damage cực cao) để giết.
    await boss.attack(c.userId, undefined);
    (boss as unknown as { cooldowns: Map<string, number> }).cooldowns.clear();
    await boss.attack(b.userId, undefined);
    (boss as unknown as { cooldowns: Map<string, number> }).cooldowns.clear();
    const out = await boss.attack(a.userId, undefined);
    expect(out.result.defeated).toBe(true);

    const cA = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    const cB = await prisma.character.findUniqueOrThrow({ where: { id: b.characterId } });
    const cC = await prisma.character.findUniqueOrThrow({ where: { id: c.characterId } });
    expect(cA.linhThach).toBe(5000n); // 50%
    expect(cB.linhThach).toBe(1500n); // 15%
    expect(cC.linhThach).toBe(1500n); // 15%

    const ledgerA = await prisma.currencyLedger.findMany({
      where: { characterId: a.characterId, reason: 'BOSS_REWARD' },
    });
    const ledgerB = await prisma.currencyLedger.findMany({
      where: { characterId: b.characterId, reason: 'BOSS_REWARD' },
    });
    const ledgerC = await prisma.currencyLedger.findMany({
      where: { characterId: c.characterId, reason: 'BOSS_REWARD' },
    });
    expect(ledgerA.length + ledgerB.length + ledgerC.length).toBe(3);
    const metaA = ledgerA[0].meta as Record<string, unknown>;
    expect(metaA.rank).toBe(1);
  });

  it('attack: cooldown chặn hit dồn dập', async () => {
    const a = await makeUserChar(prisma, { mp: 100, stamina: 100 });
    await spawnBoss({ currentHp: 1_000_000n });

    await boss.attack(a.userId, undefined);
    await expect(boss.attack(a.userId, undefined)).rejects.toMatchObject({
      code: 'COOLDOWN',
    });
  });

  it('attack: stamina thấp → STAMINA_LOW', async () => {
    const a = await makeUserChar(prisma, { mp: 100, stamina: 0 });
    await spawnBoss({ currentHp: 1_000_000n });
    await expect(boss.attack(a.userId, undefined)).rejects.toMatchObject({
      code: 'STAMINA_LOW',
    });
  });

  it('attack: không có boss ACTIVE → NO_ACTIVE_BOSS', async () => {
    const a = await makeUserChar(prisma, { mp: 100, stamina: 100 });
    await expect(boss.attack(a.userId, undefined)).rejects.toMatchObject({
      code: 'NO_ACTIVE_BOSS',
    });
  });
});
