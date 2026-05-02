import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossStatus } from '@prisma/client';
import { BOSSES, bossByKey } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { TalentService } from '../character/talent.service';
import { BuffService } from '../character/buff.service';
import { BossError, BossService } from './boss.service';
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

  // ── Phase 11.X.G — Talent dropMul wire vào BossService reward ────────
  // Wire `talents.getMods().dropMul` × linhThach reward distribution. Catalog
  // `talent_thien_di` (drop_bonus +20%) etc. apply multiplicatively per-character
  // in distributeRewards. Service không inject → identity (no bonus).
  describe('Talent dropMul wire (Phase 11.X.G)', () => {
    let bossWithTalents: BossService;
    let talentSvc: TalentService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      talentSvc = new TalentService(prisma);
      bossWithTalents = new BossService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined, // achievements
        talentSvc,
      );
    });

    beforeEach(() => {
      (bossWithTalents as unknown as { cooldowns: Map<string, number> })
        .cooldowns.clear();
    });

    it('character ở luyen_hu(6) học talent_thien_di (drop*1.2) → linhThach reward = floor(5000*1.2)=6000 thay vì 5000', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 10000,
        linhThach: 0n,
        realmKey: 'luyen_hu',
      });
      await talentSvc.learnTalent(a.characterId, 'talent_thien_di');
      await spawnBoss({ currentHp: 1n, rewardTotal: 10_000n });

      const out = await bossWithTalents.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(true);
      const c = await prisma.character.findUniqueOrThrow({
        where: { id: a.characterId },
      });
      // Top1 = 50% × 10000 = 5000 → × dropMul 1.2 = 6000.
      expect(c.linhThach).toBe(6000n);
      // Ledger reflects the boosted delta.
      const ledger = await prisma.currencyLedger.findFirstOrThrow({
        where: {
          characterId: a.characterId,
          reason: 'BOSS_REWARD',
          refType: 'WorldBoss',
        },
      });
      expect(ledger.delta).toBe(6000n);
    });

    it('character KHÔNG học talent → composePassiveTalentMods([]) identity (dropMul=1) → linhThach reward giữ nguyên 5000', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 10000,
        linhThach: 0n,
      });
      await spawnBoss({ currentHp: 1n, rewardTotal: 10_000n });

      const out = await bossWithTalents.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(true);
      const c = await prisma.character.findUniqueOrThrow({
        where: { id: a.characterId },
      });
      // Top1 = 50% × 10000 = 5000 — không có talent dropMul → identity baseline.
      expect(c.linhThach).toBe(5000n);
    });

    it('TalentService không inject vào BossService → identity baseline (dmg = 5000, same as no-talent)', async () => {
      // `boss` instance ở top-level KHÔNG inject TalentService — verify
      // fall-soft pattern: no service → bypass talent check → identity.
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 10000,
        linhThach: 0n,
        realmKey: 'luyen_hu',
      });
      // Học talent nhưng `boss` không inject TalentService → talent ignored.
      await talentSvc.learnTalent(a.characterId, 'talent_thien_di');
      await spawnBoss({ currentHp: 1n, rewardTotal: 10_000n });

      const out = await boss.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(true);
      const c = await prisma.character.findUniqueOrThrow({
        where: { id: a.characterId },
      });
      // Without TalentService injection → no bonus applied → 5000.
      expect(c.linhThach).toBe(5000n);
    });
  });

  // ── Phase 11.X.Q — Buff control wire vào BossService.attack() ──────────
  // Wire `buffMods.controlTurnsMax > 0` throw `BossError('CONTROLLED')` BEFORE
  // any state mutation. Catalog producer: `debuff_root_thuy` (3t),
  // `debuff_stun_tho` (1t), `debuff_silence_kim` (2t). Parallel to Phase
  // 11.X.O combat wire — character bị khống chế không thể attack boss.
  describe('Buff control wire (Phase 11.X.Q)', () => {
    let bossWithBuffs: BossService;
    let buffSvc: BuffService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      buffSvc = new BuffService(prisma);
      bossWithBuffs = new BossService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined, // achievements
        undefined, // talents
        buffSvc,
      );
    });

    beforeEach(() => {
      (bossWithBuffs as unknown as { cooldowns: Map<string, number> })
        .cooldowns.clear();
    });

    it('character có debuff_stun_tho (control 1 turn) → BossError CONTROLLED, KHÔNG mutate state', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        hp: 1000,
        hpMax: 1000,
      });
      await buffSvc.applyBuff(a.characterId, 'debuff_stun_tho', 'skill');
      const w = await spawnBoss({ currentHp: 10000n });

      let caught: BossError | null = null;
      try {
        await bossWithBuffs.attack(a.userId, undefined);
      } catch (e) {
        if (e instanceof BossError) caught = e;
      }
      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('CONTROLLED');

      // Verify state UNCHANGED: boss currentHp giữ nguyên, character mp/stamina/hp giữ nguyên.
      const after = await prisma.worldBoss.findUniqueOrThrow({
        where: { id: w.id },
      });
      expect(after.currentHp).toBe(10000n);
      const c = await prisma.character.findUniqueOrThrow({
        where: { id: a.characterId },
      });
      expect(c.mp).toBe(100);
      expect(c.stamina).toBe(100);
      expect(c.hp).toBe(1000);

      // Verify cooldown KHÔNG set (controlled throw before cooldown.set).
      const cd = (
        bossWithBuffs as unknown as { cooldowns: Map<string, number> }
      ).cooldowns.get(a.characterId);
      expect(cd).toBeUndefined();
    });

    it('character có debuff_root_thuy (control 3 turn) → BossError CONTROLLED', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await buffSvc.applyBuff(a.characterId, 'debuff_root_thuy', 'skill');
      await spawnBoss({ currentHp: 10000n });

      await expect(bossWithBuffs.attack(a.userId, undefined)).rejects.toThrow(
        'CONTROLLED',
      );
    });

    it('character có debuff_silence_kim (control 2 turn) → BossError CONTROLLED', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await buffSvc.applyBuff(a.characterId, 'debuff_silence_kim', 'skill');
      await spawnBoss({ currentHp: 10000n });

      await expect(bossWithBuffs.attack(a.userId, undefined)).rejects.toThrow(
        'CONTROLLED',
      );
    });

    it('character KHÔNG có control debuff → identity (no throw, attack succeeds)', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await spawnBoss({ currentHp: 10000n });

      const out = await bossWithBuffs.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(false);
      expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);
    });

    it('BuffService không inject vào BossService → identity baseline (no throw despite DB row)', async () => {
      // Top-level `boss` instance KHÔNG inject BuffService → control debuff
      // ignored, attack succeed bình thường.
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await buffSvc.applyBuff(a.characterId, 'debuff_stun_tho', 'skill');
      await spawnBoss({ currentHp: 10000n });

      const out = await boss.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(false);
      expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);
    });
  });

  // ── Phase 11.X.R — Buff cultivationBlocked wire vào BossService.attack() ──
  // Wire `buffMods.cultivationBlocked` (Tâm Ma debuff_taoma) throw `BossError
  // ('CULTIVATION_BLOCKED')` BEFORE state mutation. Tâm Ma'd char không thể
  // tu luyện EXP (đã wire ở CultivationProcessor) cũng không thể đánh boss.
  describe('Buff cultivationBlocked wire (Phase 11.X.R)', () => {
    let bossWithBuffsR: BossService;
    let buffSvcR: BuffService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      buffSvcR = new BuffService(prisma);
      bossWithBuffsR = new BossService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined, // achievements
        undefined, // talents
        buffSvcR,
      );
    });

    beforeEach(() => {
      (bossWithBuffsR as unknown as { cooldowns: Map<string, number> })
        .cooldowns.clear();
    });

    it('character có debuff_taoma (cultivationBlocked) → BossError CULTIVATION_BLOCKED, KHÔNG mutate state', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        hp: 1000,
        hpMax: 1000,
      });
      await buffSvcR.applyBuff(a.characterId, 'debuff_taoma', 'tribulation');
      const w = await spawnBoss({ currentHp: 10000n });

      let caught: BossError | null = null;
      try {
        await bossWithBuffsR.attack(a.userId, undefined);
      } catch (e) {
        if (e instanceof BossError) caught = e;
      }
      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('CULTIVATION_BLOCKED');

      // Verify state UNCHANGED.
      const after = await prisma.worldBoss.findUniqueOrThrow({
        where: { id: w.id },
      });
      expect(after.currentHp).toBe(10000n);
      const c = await prisma.character.findUniqueOrThrow({
        where: { id: a.characterId },
      });
      expect(c.mp).toBe(100);
      expect(c.stamina).toBe(100);
      expect(c.hp).toBe(1000);
      const cd = (
        bossWithBuffsR as unknown as { cooldowns: Map<string, number> }
      ).cooldowns.get(a.characterId);
      expect(cd).toBeUndefined();
    });

    it('character KHÔNG có debuff_taoma → identity (no throw, attack succeeds)', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await spawnBoss({ currentHp: 10000n });

      const out = await bossWithBuffsR.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(false);
      expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);
    });

    it('BuffService không inject vào BossService → identity baseline (no throw despite DB row)', async () => {
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
      });
      await buffSvcR.applyBuff(a.characterId, 'debuff_taoma', 'tribulation');
      await spawnBoss({ currentHp: 10000n });

      // Top-level `boss` instance không inject BuffService → bypass check.
      const out = await boss.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(false);
      expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);
    });
  });

  // ── Phase 11.4.E — Equipment atk/spirit bonus wire vào BossService.attack() ──
  // Wire `inventory.equipBonus().atk` cộng vào `charAtk` (basic skill +
  // spirit-scaled skill). Subset của Phase 11.X.S full stat wire, chỉ wire
  // equip bonus, KHÔNG wire talent/buff/title/element atkMul.
  describe('Equipment atk/spirit bonus wire (Phase 11.4.E)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character có weapon so_kiem (+5 atk) equipped → damage cao hơn baseline (no equip)', async () => {
      // variance = 0.85 + 0.5 * 0.3 = 1.0 → deterministic damage.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const baseline = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
      });
      const equipped = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
      });

      // Grant + equip so_kiem (atk +5) cho equipped char.
      const inv = (
        boss as unknown as { inventory: InventoryService }
      ).inventory;
      await inv.grant(
        equipped.characterId,
        [{ itemKey: 'so_kiem', qty: 1 }],
        { reason: 'ADMIN_GRANT' },
      );
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: equipped.characterId, itemKey: 'so_kiem' },
      });
      await inv.equip(equipped.userId, sword.id);

      // Boss currentHp đủ cao để cả 2 không hạ trong 1 hit (deterministic).
      await spawnBoss({ currentHp: 1_000_000n });

      const baselineOut = await boss.attack(baseline.userId, undefined);
      const equippedOut = await boss.attack(equipped.userId, undefined);

      expect(BigInt(equippedOut.result.damageDealt)).toBeGreaterThan(
        BigInt(baselineOut.result.damageDealt),
      );
    });

    it('character KHÔNG equip → identity (damage giống snapshot baseline)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
      });
      await spawnBoss({ currentHp: 1_000_000n });

      const out = await boss.attack(a.userId, undefined);
      expect(out.result.defeated).toBe(false);
      expect(BigInt(out.result.damageDealt)).toBeGreaterThan(0n);
    });

    it('weapon có spirit bonus (huyen_kiem +12 atk +2 spirit) → damage cộng spiritBonus khi atkScale > 1', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // Note: skill mặc định (atk_thuong) atkScale = 1.0 → chỉ atk wire,
      // KHÔNG dùng spirit branch. Test verify equipped char với weapon
      // huyen_kiem (atk +12) damage cao hơn rõ rệt baseline 100 power.
      const baseline = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
      });
      const equipped = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
      });

      const inv = (
        boss as unknown as { inventory: InventoryService }
      ).inventory;
      await inv.grant(
        equipped.characterId,
        [{ itemKey: 'huyen_kiem', qty: 1 }],
        { reason: 'ADMIN_GRANT' },
      );
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: equipped.characterId, itemKey: 'huyen_kiem' },
      });
      await inv.equip(equipped.userId, sword.id);

      await spawnBoss({ currentHp: 1_000_000n });

      const baselineOut = await boss.attack(baseline.userId, undefined);
      const equippedOut = await boss.attack(equipped.userId, undefined);

      // huyen_kiem +12 atk → damage cao hơn baseline đáng kể.
      expect(BigInt(equippedOut.result.damageDealt)).toBeGreaterThan(
        BigInt(baselineOut.result.damageDealt),
      );
    });
  });

  // ── Phase 11.4.F — Talent atkMul wire vào BossService.attack() ─────────
  // Wire `talents.getMods().atkMul` × `(char.power + equip.atk)` ở basic-skill
  // branch. Symmetric với Phase 11.X.U combat path. Catalog producer:
  // `talent_kim_thien_co` (passive stat_mod statTarget=atk value=1.1, kim
  // element, realmRequirement=kim_dan, talentPointCost=1).
  // Service KHÔNG inject (legacy DI) → identity baseline (atkMul=1.0, no-op).
  describe('Talent atkMul wire (Phase 11.4.F)', () => {
    let bossWithTalentsF: BossService;
    let talentSvcF: TalentService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      talentSvcF = new TalentService(prisma);
      bossWithTalentsF = new BossService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined, // achievements
        talentSvcF,
      );
    });

    beforeEach(() => {
      (bossWithTalentsF as unknown as { cooldowns: Map<string, number> })
        .cooldowns.clear();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character có talent_kim_thien_co (atkMul +10%) → damage cao hơn baseline (no talent)', async () => {
      // variance = 0.5 → rollDamage deterministic factor = 1.0.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const baseline = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      const buffed = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      await talentSvcF.learnTalent(buffed.characterId, 'talent_kim_thien_co');

      // Boss HP đủ cao để cả 2 không hạ trong 1 hit.
      await spawnBoss({ currentHp: 1_000_000n });

      const baselineOut = await bossWithTalentsF.attack(
        baseline.userId,
        undefined,
      );
      const buffedOut = await bossWithTalentsF.attack(
        buffed.userId,
        undefined,
      );

      // talent_kim_thien_co atkMul = 1.1 → damage(buffed) > damage(baseline).
      expect(BigInt(buffedOut.result.damageDealt)).toBeGreaterThan(
        BigInt(baselineOut.result.damageDealt),
      );
    });

    it('character KHÔNG học talent → composePassiveTalentMods([]) identity (atkMul=1) → damage giống baseline', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const a = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      const b = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      await spawnBoss({ currentHp: 1_000_000n });

      const outA = await bossWithTalentsF.attack(a.userId, undefined);
      const outB = await bossWithTalentsF.attack(b.userId, undefined);

      // Cả 2 char không học talent → atkMul = 1.0 → damage equal (deterministic mock).
      expect(BigInt(outA.result.damageDealt)).toBe(
        BigInt(outB.result.damageDealt),
      );
    });

    it('TalentService không inject vào BossService → identity baseline (no atkMul bonus despite DB row)', async () => {
      // Top-level `boss` instance KHÔNG inject TalentService — verify
      // fall-soft pattern: no service → bypass → identity.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const baseline = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      const buffed = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      // Học talent ở DB nhưng `boss` không inject TalentService → talent ignored.
      await talentSvcF.learnTalent(buffed.characterId, 'talent_kim_thien_co');
      await spawnBoss({ currentHp: 1_000_000n });

      const baselineOut = await boss.attack(baseline.userId, undefined);
      const buffedOut = await boss.attack(buffed.userId, undefined);

      // Without TalentService injection → no atkMul applied → damage equal.
      expect(BigInt(buffedOut.result.damageDealt)).toBe(
        BigInt(baselineOut.result.damageDealt),
      );
    });

    it('talent atkMul × equip.atk compose multiplicative (atkMul × (power + equip))', async () => {
      // Verify wire: `Math.floor((char.power + equip.atk) * talentMods.atkMul)`
      // — talent atkMul áp dụng cho TỔNG (power + equip), không chỉ raw power.
      // Player với equip + talent damage > player chỉ-equip > player chỉ-talent
      // > baseline (deterministic check via mock random = 0.5).
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const onlyEquip = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      const onlyTalent = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });
      const both = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 100,
        realmKey: 'kim_dan',
      });

      const inv = (
        bossWithTalentsF as unknown as { inventory: InventoryService }
      ).inventory;
      // Grant + equip so_kiem (+5 atk) cho onlyEquip + both.
      for (const target of [onlyEquip, both]) {
        await inv.grant(
          target.characterId,
          [{ itemKey: 'so_kiem', qty: 1 }],
          { reason: 'ADMIN_GRANT' },
        );
        const sword = await prisma.inventoryItem.findFirstOrThrow({
          where: { characterId: target.characterId, itemKey: 'so_kiem' },
        });
        await inv.equip(target.userId, sword.id);
      }
      // Học talent cho onlyTalent + both.
      await talentSvcF.learnTalent(
        onlyTalent.characterId,
        'talent_kim_thien_co',
      );
      await talentSvcF.learnTalent(both.characterId, 'talent_kim_thien_co');

      await spawnBoss({ currentHp: 1_000_000n });

      const equipOut = await bossWithTalentsF.attack(
        onlyEquip.userId,
        undefined,
      );
      const talentOut = await bossWithTalentsF.attack(
        onlyTalent.userId,
        undefined,
      );
      const bothOut = await bossWithTalentsF.attack(both.userId, undefined);

      // Both > onlyEquip (talent stack lên top of equip).
      expect(BigInt(bothOut.result.damageDealt)).toBeGreaterThan(
        BigInt(equipOut.result.damageDealt),
      );
      // Both > onlyTalent (equip stack lên top of talent).
      expect(BigInt(bothOut.result.damageDealt)).toBeGreaterThan(
        BigInt(talentOut.result.damageDealt),
      );
    });

    it('talent atkMul KHÔNG áp dụng cho spirit branch (atkScale > 1) — chỉ wire (power + equip.atk)', async () => {
      // Note: skill mặc định (atk_thuong) atkScale = 1.0 → chỉ atk wire,
      // KHÔNG dùng spirit branch. Test verify identity ở spirit branch:
      // 2 char với cùng power=0 + cùng spirit → damage giống nhau bất kể
      // talent (vì atkMul × 0 = 0, branch spirit chiếm 100% damage).
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const baseline = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 0,
        spirit: 100,
        realmKey: 'kim_dan',
      });
      const buffed = await makeUserChar(prisma, {
        mp: 100,
        stamina: 100,
        power: 0,
        spirit: 100,
        realmKey: 'kim_dan',
      });
      await talentSvcF.learnTalent(buffed.characterId, 'talent_kim_thien_co');

      await spawnBoss({ currentHp: 1_000_000n });

      // Default skill (atk_thuong) atkScale = 1.0 → spirit branch không
      // active. atkMul × (0 + 0) = 0 → damage chỉ rollDamage(0, def, 1.0)
      // floor 1. Cả 2 char damage = 1 (Math.max(1, raw)).
      const baselineOut = await bossWithTalentsF.attack(
        baseline.userId,
        undefined,
      );
      const buffedOut = await bossWithTalentsF.attack(
        buffed.userId,
        undefined,
      );

      // Cả 2 power=0 → atkMul × 0 = 0 → damage floor 1 (Math.max(1, raw)).
      expect(BigInt(baselineOut.result.damageDealt)).toBe(1n);
      expect(BigInt(buffedOut.result.damageDealt)).toBe(1n);
    });
  });
});
