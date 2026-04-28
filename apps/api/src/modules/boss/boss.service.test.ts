import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BossStatus } from '@prisma/client';
import { BOSSES, bossByKey } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { BossService } from './boss.service';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let boss: BossService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const inventory = new InventoryService(prisma, realtime, chars);
  const currency = new CurrencyService(prisma);
  const missions = makeMissionService(prisma);
  boss = new BossService(prisma, realtime, chars, inventory, currency, missions);
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

  describe('adminSpawn', () => {
    it('không có boss ACTIVE → spawn mới + ghi audit BOSS_SPAWN', async () => {
      const admin = await prisma.user.create({
        data: {
          email: `admin-${Date.now()}@xt.local`,
          passwordHash: 'x',
          role: 'ADMIN',
        },
      });

      const r = await boss.adminSpawn(admin.id, { bossKey: DEF.key, level: 3 });

      expect(r.bossKey).toBe(DEF.key);
      expect(r.level).toBe(3);

      const w = await prisma.worldBoss.findUniqueOrThrow({ where: { id: r.id } });
      expect(w.status).toBe(BossStatus.ACTIVE);
      expect(w.level).toBe(3);
      expect(w.maxHp).toBe(BigInt(bossByKey(DEF.key)!.baseMaxHp) * 3n);

      const audit = await prisma.adminAuditLog.findFirstOrThrow({
        where: { actorUserId: admin.id, action: 'BOSS_SPAWN' },
      });
      expect((audit.meta as { bossId: string }).bossId).toBe(w.id);
      expect((audit.meta as { forced: boolean }).forced).toBe(false);
    });

    it('default level=1 nếu không truyền', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const r = await boss.adminSpawn(admin.id, { bossKey: DEF.key });
      expect(r.level).toBe(1);
    });

    it('không truyền bossKey → auto-rotate theo count', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const r = await boss.adminSpawn(admin.id, {});
      expect(BOSSES.some((b) => b.key === r.bossKey)).toBe(true);
    });

    it('không truyền bossKey + có level → tôn trọng level admin chọn (không bị auto-rotate ghi đè)', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const r = await boss.adminSpawn(admin.id, { level: 5 });
      expect(r.level).toBe(5);
      const w = await prisma.worldBoss.findUniqueOrThrow({ where: { id: r.id } });
      expect(w.level).toBe(5);
      expect(w.maxHp).toBe(BigInt(bossByKey(r.bossKey)!.baseMaxHp) * 5n);
    });

    it('boss ACTIVE đang có + force=false → throw BOSS_ALREADY_ACTIVE', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      await spawnBoss();
      await expect(
        boss.adminSpawn(admin.id, { bossKey: DEF.key, level: 1 }),
      ).rejects.toMatchObject({ code: 'BOSS_ALREADY_ACTIVE' });
    });

    it('boss ACTIVE + force=true → expire boss cũ + spawn boss mới + audit ghi replacedBossId', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const old = await spawnBoss();
      const r = await boss.adminSpawn(admin.id, { bossKey: DEF.key, level: 2, force: true });

      const oldUpdated = await prisma.worldBoss.findUniqueOrThrow({ where: { id: old.id } });
      expect(oldUpdated.status).toBe(BossStatus.EXPIRED);
      expect(oldUpdated.defeatedAt).not.toBeNull();

      const audit = await prisma.adminAuditLog.findFirstOrThrow({
        where: { actorUserId: admin.id, action: 'BOSS_SPAWN' },
      });
      const meta = audit.meta as { replacedBossId: string | null; forced: boolean };
      expect(meta.replacedBossId).toBe(old.id);
      expect(meta.forced).toBe(true);

      // boss mới khác id boss cũ
      expect(r.id).not.toBe(old.id);
    });

    it('boss đã DEFEATED giữa findFirst và update + force=true → KHÔNG ghi đè status (không làm hỏng historical record)', async () => {
      // Race condition guard: Devin Review #36 #3153196860.
      // Mô phỏng: findFirst trả về boss ACTIVE, nhưng sau đó player kill được
      // boss → status đổi thành DEFEATED + defeatedAt được set với reward đã
      // distribute. adminSpawn force không được rollback DEFEATED về EXPIRED.
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const old = await spawnBoss();
      const defeatedAt = new Date('2024-01-01T00:00:00Z');
      // Player giết boss giữa findFirst và update.
      await prisma.worldBoss.update({
        where: { id: old.id },
        data: { status: BossStatus.DEFEATED, defeatedAt },
      });
      // Spawn force=true sau đó không được flip DEFEATED → EXPIRED.
      const r = await boss.adminSpawn(admin.id, { bossKey: DEF.key, level: 2, force: true });
      const oldAfter = await prisma.worldBoss.findUniqueOrThrow({ where: { id: old.id } });
      expect(oldAfter.status).toBe(BossStatus.DEFEATED);
      // defeatedAt giữ nguyên thời điểm player kill, không bị overwrite.
      expect(oldAfter.defeatedAt?.toISOString()).toBe(defeatedAt.toISOString());
      // Boss mới vẫn được tạo bình thường.
      expect(r.id).not.toBe(old.id);
      // Audit log cho lần spawn race-defeated KHÔNG được nói dối là admin
      // đã thay boss đó (replacedBossId phải null vì flip.count=0).
      const audit = await prisma.adminAuditLog.findFirstOrThrow({
        where: { actorUserId: admin.id, action: 'BOSS_SPAWN' },
        orderBy: { createdAt: 'desc' },
      });
      const meta = audit.meta as { replacedBossId: string | null; forced: boolean };
      expect(meta.replacedBossId).toBeNull();
      expect(meta.forced).toBe(true);
    });

    it('force-expire boss có người tham chiến → distribute 60% reward EXPIRED cho player (không mất trắng)', async () => {
      // Devin Review #36 #3153247323.
      // Người chơi đã đầu tư stamina/MP fight boss; nếu admin force-spawn
      // mà không phát thưởng EXPIRED, người chơi mất trắng phần thưởng.
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      const player = await prisma.user.create({
        data: { email: `p-${Date.now()}@xt.local`, passwordHash: 'x', role: 'PLAYER' },
      });
      const sect = await prisma.sect.create({ data: { name: `Boss-Sect-${Date.now()}` } });
      const playerChar = await prisma.character.create({
        data: {
          userId: player.id,
          name: `BP_${Date.now()}`,
          realmKey: 'luyenkhi',
          realmStage: 1,
          spirit: 8,
          linhThach: 100n,
          tienNgoc: 0,
          sectId: sect.id,
          stamina: 100,
          staminaMax: 100,
          hp: 100,
          hpMax: 100,
          mp: 50,
          mpMax: 50,
          power: 10,
          speed: 10,
          luck: 5,
        },
      });
      const old = await spawnBoss();
      // Mock player damage record.
      await prisma.bossDamage.create({
        data: {
          bossId: old.id,
          characterId: playerChar.id,
          characterName: playerChar.name,
          totalDamage: 10_000n,
          hits: 5,
        },
      });
      const before = await prisma.character.findUniqueOrThrow({
        where: { id: playerChar.id },
      });

      await boss.adminSpawn(admin.id, { bossKey: DEF.key, level: 2, force: true });

      // Player nhận được linh thạch (>0) — chứng tỏ distributeRewardsExpired
      // đã chạy trên boss bị force-expire.
      const after = await prisma.character.findUniqueOrThrow({
        where: { id: playerChar.id },
      });
      expect(after.linhThach).toBeGreaterThan(before.linhThach);
      // Có ít nhất 1 dòng ledger BOSS_REWARD cho character này.
      const ledger = await prisma.currencyLedger.findFirst({
        where: {
          characterId: playerChar.id,
          reason: 'BOSS_REWARD',
          refType: 'WorldBoss',
          refId: old.id,
        },
      });
      expect(ledger).not.toBeNull();
    });

    it('bossKey không có trong catalog → throw INVALID_BOSS_KEY, không tạo gì', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      await expect(boss.adminSpawn(admin.id, { bossKey: 'fake_boss' })).rejects.toMatchObject({
        code: 'INVALID_BOSS_KEY',
      });
      expect(await prisma.worldBoss.count()).toBe(0);
      expect(await prisma.adminAuditLog.count()).toBe(0);
    });

    it('level ngoài 1..10 → throw INVALID_LEVEL', async () => {
      const admin = await prisma.user.create({
        data: { email: `admin-${Date.now()}@xt.local`, passwordHash: 'x', role: 'ADMIN' },
      });
      await expect(boss.adminSpawn(admin.id, { level: 0 })).rejects.toMatchObject({
        code: 'INVALID_LEVEL',
      });
      await expect(boss.adminSpawn(admin.id, { level: 11 })).rejects.toMatchObject({
        code: 'INVALID_LEVEL',
      });
      await expect(boss.adminSpawn(admin.id, { level: 1.5 })).rejects.toMatchObject({
        code: 'INVALID_LEVEL',
      });
    });
  });
});
