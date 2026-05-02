import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  computeTribulationFailurePenalty,
  expCostForStage,
  getTribulationForBreakthrough,
  simulateTribulation,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';
import { TribulationError, TribulationService } from './tribulation.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let currency: CurrencyService;
let svc: TribulationService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  currency = new CurrencyService(prisma);
  svc = new TribulationService(prisma, currency);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const KIM_DAN_COST_9 = expCostForStage('kim_dan', 9) ?? 0n;

/** Tạo character đứng đỉnh kim_dan, đủ EXP cost(9), HP đủ vượt minor kiếp. */
async function setupCharAtKimDanPeak(opts?: {
  hpMax?: number;
  exp?: bigint;
  linhThach?: bigint;
}) {
  return makeUserChar(prisma, {
    realmKey: 'kim_dan',
    realmStage: 9,
    exp: opts?.exp ?? KIM_DAN_COST_9 + 1000n,
    hp: opts?.hpMax ?? 10_000,
    hpMax: opts?.hpMax ?? 10_000,
    mp: 200,
    mpMax: 200,
    linhThach: opts?.linhThach ?? 0n,
  });
}

describe('TribulationService.attemptTribulation — SUCCESS path (kim_dan → nguyen_anh, minor lei)', () => {
  it('hpMax đủ vượt 3 wave (minor=800/1080/1458 → ~3338 dmg) → success, advance realm, grant reward, write log + ledger', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    const def = getTribulationForBreakthrough('kim_dan', 'nguyen_anh');
    expect(def).toBeDefined();

    const sim = simulateTribulation(def!, 10_000, () => 1.0);
    expect(sim.success).toBe(true); // sanity: catalog đảm bảo hp>tổng dmg

    const out = await svc.attemptTribulation(ctx.characterId, () => 0.0);

    expect(out.success).toBe(true);
    expect(out.fromRealmKey).toBe('kim_dan');
    expect(out.toRealmKey).toBe('nguyen_anh');
    expect(out.severity).toBe('minor');
    expect(out.type).toBe('lei');
    expect(out.wavesCompleted).toBe(3);
    expect(out.totalDamage).toBe(sim.totalDamage);
    expect(out.attemptIndex).toBe(1);
    expect(out.reward).not.toBeNull();
    expect(out.reward!.linhThach).toBe(5_000); // SEVERITY_REWARD_BASE.minor
    expect(out.reward!.expBonus).toBe(1_000n);
    expect(out.penalty).toBeNull();

    // Character: realm advance + HP/MP refill + cooldown cleared.
    const updated = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(updated?.realmKey).toBe('nguyen_anh');
    expect(updated?.realmStage).toBe(1);
    expect(updated?.exp).toBe(KIM_DAN_COST_9 + 1000n - KIM_DAN_COST_9 + 1_000n);
    expect(updated?.hpMax).toBe(Math.round(10_000 * 1.2));
    expect(updated?.hp).toBe(updated?.hpMax);
    expect(updated?.mpMax).toBe(Math.round(200 * 1.2));
    expect(updated?.mp).toBe(updated?.mpMax);
    expect(updated?.tribulationCooldownAt).toBeNull();
    expect(updated?.taoMaUntil).toBeNull();
    expect(updated?.linhThach).toBe(5_000n);

    // CurrencyLedger row for grant.
    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].reason).toBe('TRIBULATION_REWARD');
    expect(ledger[0].delta).toBe(5_000n);
    expect(ledger[0].refType).toBe('TribulationAttemptLog');
    expect(ledger[0].refId).toBe(out.logId);

    // TribulationAttemptLog row.
    const logs = await prisma.tribulationAttemptLog.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(out.logId);
    expect(logs[0].success).toBe(true);
    expect(logs[0].fromRealmKey).toBe('kim_dan');
    expect(logs[0].toRealmKey).toBe('nguyen_anh');
    expect(logs[0].severity).toBe('minor');
    expect(logs[0].type).toBe('lei');
    expect(logs[0].wavesCompleted).toBe(3);
    expect(logs[0].totalDamage).toBe(sim.totalDamage);
    expect(logs[0].attemptIndex).toBe(1);
    expect(logs[0].linhThachReward).toBe(5_000);
    expect(logs[0].expBonusReward).toBe(1_000n);
    expect(logs[0].titleKeyReward).toBe('tribulation_minor_lei_pass');
    expect(logs[0].expLoss).toBe(0n);
    expect(logs[0].taoMaActive).toBe(false);
    expect(logs[0].taoMaExpiresAt).toBeNull();
    expect(logs[0].cooldownAt).toBeNull();
    expect(logs[0].taoMaRoll).toBe(0.0);
  });

  it('SUCCESS clears pre-existing cooldown + taoMaUntil (after retry post-cooldown)', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    // Set pre-existing cooldown đã expire + taoMa đã expire (test cleanup on success).
    const past = new Date(Date.now() - 10 * 60_000);
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: {
        tribulationCooldownAt: past,
        taoMaUntil: past,
      },
    });

    const out = await svc.attemptTribulation(ctx.characterId, () => 0.0);
    expect(out.success).toBe(true);

    const updated = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(updated?.tribulationCooldownAt).toBeNull();
    expect(updated?.taoMaUntil).toBeNull();
  });
});

describe('TribulationService.attemptTribulation — FAIL path', () => {
  it('hpMax thấp (2000) → fail wave 2, EXP loss 10%, cooldown set, hp=1', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 2_000, exp: KIM_DAN_COST_9 + 100_000n });
    const def = getTribulationForBreakthrough('kim_dan', 'nguyen_anh')!;

    const sim = simulateTribulation(def, 2_000, () => 1.0);
    expect(sim.success).toBe(false); // catalog đảm bảo hp=2000 < tổng dmg

    // rng=0.99 → taoMaRoll cao hơn taoMaDebuffChance (0.05 minor) → KHÔNG taoMa.
    const fakeNow = new Date('2026-05-02T00:00:00Z');
    const out = await svc.attemptTribulation(ctx.characterId, () => 0.99, fakeNow);

    expect(out.success).toBe(false);
    expect(out.wavesCompleted).toBe(sim.wavesCompleted);
    expect(out.reward).toBeNull();
    expect(out.penalty).not.toBeNull();
    expect(out.penalty!.taoMaActive).toBe(false);
    expect(out.penalty!.taoMaExpiresAt).toBeNull();

    // Character: EXP loss áp dụng, realm KHÔNG advance, hp=1, cooldown set.
    const updated = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(updated?.realmKey).toBe('kim_dan');
    expect(updated?.realmStage).toBe(9);
    expect(updated?.hp).toBe(1);
    expect(updated?.taoMaUntil).toBeNull();
    expect(updated?.tribulationCooldownAt).not.toBeNull();
    // 30 phút cooldown cho minor.
    expect(updated?.tribulationCooldownAt?.getTime()).toBe(
      fakeNow.getTime() + 30 * 60_000,
    );

    // EXP loss check via catalog helper (parity).
    const expectedPenalty = computeTribulationFailurePenalty(
      KIM_DAN_COST_9 + 100_000n,
      def,
      fakeNow,
      0.99,
    );
    expect(updated?.exp).toBe(expectedPenalty.expAfter);
    expect(out.penalty!.expBefore).toBe(KIM_DAN_COST_9 + 100_000n);
    expect(out.penalty!.expAfter).toBe(expectedPenalty.expAfter);
    expect(out.penalty!.expLoss).toBe(KIM_DAN_COST_9 + 100_000n - expectedPenalty.expAfter);
  });

  it('rng=0.0 (taoMaRoll < taoMaDebuffChance=0.05) → Tâm Ma debuff trigger, taoMaUntil set', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 2_000 });

    const fakeNow = new Date('2026-05-02T00:00:00Z');
    const out = await svc.attemptTribulation(ctx.characterId, () => 0.0, fakeNow);

    expect(out.success).toBe(false);
    expect(out.penalty!.taoMaActive).toBe(true);
    expect(out.penalty!.taoMaExpiresAt).not.toBeNull();
    // 15 phút Tâm Ma cho minor.
    expect(out.penalty!.taoMaExpiresAt!.getTime()).toBe(
      fakeNow.getTime() + 15 * 60_000,
    );

    const updated = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(updated?.taoMaUntil?.getTime()).toBe(fakeNow.getTime() + 15 * 60_000);
  });

  it('FAIL không grant CurrencyLedger (chỉ SUCCESS mới grant)', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 2_000 });
    const out = await svc.attemptTribulation(ctx.characterId, () => 0.99);
    expect(out.success).toBe(false);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(ledger).toHaveLength(0);
  });

  it('FAIL ghi TribulationAttemptLog với expLoss + cooldownAt, success=false', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 2_000, exp: KIM_DAN_COST_9 + 100_000n });
    const fakeNow = new Date('2026-05-02T00:00:00Z');
    const out = await svc.attemptTribulation(ctx.characterId, () => 0.0, fakeNow);
    expect(out.success).toBe(false);

    const logs = await prisma.tribulationAttemptLog.findMany({
      where: { characterId: ctx.characterId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].success).toBe(false);
    expect(logs[0].expLoss).toBeGreaterThan(0n);
    expect(logs[0].cooldownAt).not.toBeNull();
    expect(logs[0].linhThachReward).toBe(0);
    expect(logs[0].expBonusReward).toBe(0n);
    expect(logs[0].titleKeyReward).toBeNull();
    expect(logs[0].taoMaActive).toBe(true);
    expect(logs[0].taoMaRoll).toBe(0.0);
  });
});

describe('TribulationService.attemptTribulation — gating', () => {
  it('throws NOT_AT_PEAK khi realmStage < 9', async () => {
    const ctx = await makeUserChar(prisma, {
      realmKey: 'kim_dan',
      realmStage: 8,
      exp: KIM_DAN_COST_9,
      hp: 10_000,
      hpMax: 10_000,
    });
    await expect(svc.attemptTribulation(ctx.characterId)).rejects.toMatchObject({
      code: 'NOT_AT_PEAK',
    });
  });

  it('throws NOT_AT_PEAK khi exp < cost(9)', async () => {
    const ctx = await makeUserChar(prisma, {
      realmKey: 'kim_dan',
      realmStage: 9,
      exp: KIM_DAN_COST_9 - 1n,
      hp: 10_000,
      hpMax: 10_000,
    });
    await expect(svc.attemptTribulation(ctx.characterId)).rejects.toMatchObject({
      code: 'NOT_AT_PEAK',
    });
  });

  it('throws NO_TRIBULATION_FOR_TRANSITION khi catalog không có def (luyenkhi → truc_co)', async () => {
    const luyenkhiCost9 = expCostForStage('luyenkhi', 9) ?? 0n;
    const ctx = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 9,
      exp: luyenkhiCost9,
      hp: 10_000,
      hpMax: 10_000,
    });
    await expect(svc.attemptTribulation(ctx.characterId)).rejects.toMatchObject({
      code: 'NO_TRIBULATION_FOR_TRANSITION',
    });
  });

  it('throws COOLDOWN_ACTIVE khi tribulationCooldownAt > now', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    const future = new Date(Date.now() + 10 * 60_000);
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { tribulationCooldownAt: future },
    });
    await expect(svc.attemptTribulation(ctx.characterId)).rejects.toMatchObject({
      code: 'COOLDOWN_ACTIVE',
    });
  });

  it('cho phép retry sau khi cooldown expire (now > tribulationCooldownAt)', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    const past = new Date(Date.now() - 10 * 60_000);
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { tribulationCooldownAt: past },
    });
    const out = await svc.attemptTribulation(ctx.characterId, () => 0.0);
    expect(out.success).toBe(true);
  });

  it('throws CHARACTER_NOT_FOUND khi characterId không tồn tại', async () => {
    await expect(
      svc.attemptTribulation('char-does-not-exist'),
    ).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('throws INVALID_RNG khi rng() return out-of-range', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    await expect(
      svc.attemptTribulation(ctx.characterId, () => 1.5),
    ).rejects.toMatchObject({ code: 'INVALID_RNG' });
    await expect(
      svc.attemptTribulation(ctx.characterId, () => -0.1),
    ).rejects.toMatchObject({ code: 'INVALID_RNG' });
    await expect(
      svc.attemptTribulation(ctx.characterId, () => Number.NaN),
    ).rejects.toMatchObject({ code: 'INVALID_RNG' });
  });
});

describe('TribulationService.attemptTribulation — cross-character + idempotency', () => {
  it('attemptIndex tăng dần qua nhiều fail attempts (cooldown clear giữa các attempts)', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 2_000 });

    // 1st fail.
    const first = await svc.attemptTribulation(ctx.characterId, () => 0.99);
    expect(first.success).toBe(false);
    expect(first.attemptIndex).toBe(1);

    // Clear cooldown manually (simulate time passing).
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: {
        tribulationCooldownAt: null,
        // EXP refill về peak gate.
        exp: KIM_DAN_COST_9 + 1000n,
      },
    });

    // 2nd fail.
    const second = await svc.attemptTribulation(ctx.characterId, () => 0.99);
    expect(second.success).toBe(false);
    expect(second.attemptIndex).toBe(2);

    const logs = await prisma.tribulationAttemptLog.findMany({
      where: { characterId: ctx.characterId },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0].attemptIndex).toBe(1);
    expect(logs[1].attemptIndex).toBe(2);
  });

  it('Char A cooldown KHÔNG block Char B (cross-character isolation)', async () => {
    const charA = await setupCharAtKimDanPeak({ hpMax: 2_000 });
    const charB = await setupCharAtKimDanPeak({ hpMax: 10_000 });

    // A fail → cooldown set.
    const aOut = await svc.attemptTribulation(charA.characterId, () => 0.99);
    expect(aOut.success).toBe(false);

    const aChar = await prisma.character.findUnique({
      where: { id: charA.characterId },
    });
    expect(aChar?.tribulationCooldownAt).not.toBeNull();

    // B vẫn attempt được (cooldown của A không liên quan).
    const bOut = await svc.attemptTribulation(charB.characterId, () => 0.0);
    expect(bOut.success).toBe(true);
    expect(bOut.attemptIndex).toBe(1); // B's attemptIndex riêng.
  });
});

describe('TribulationService.attemptTribulation — atomicity', () => {
  it('throws TribulationError instance (không leak Prisma error)', async () => {
    const ctx = await setupCharAtKimDanPeak({ hpMax: 10_000 });
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { realmStage: 5 },
    });
    try {
      await svc.attemptTribulation(ctx.characterId);
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TribulationError);
      expect((e as TribulationError).code).toBe('NOT_AT_PEAK');
    }
  });
});
