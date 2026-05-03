import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from './character.service';
import { CurrencyService } from './currency.service';
import { TribulationError, TribulationService } from './tribulation.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

class StubRealtime {
  emitToUser(): void {
    /* no-op */
  }
}

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let currency: CurrencyService;
let svc: TribulationService;
let charSvc: CharacterService;

const KIM_DAN_PEAK_EXP = 60_448n;
const TRIB_KEY = 'tribulation_kim_dan_nguyen_anh';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  currency = new CurrencyService(prisma);
  svc = new TribulationService(prisma, currency);
  charSvc = new CharacterService(
    prisma,
    new StubRealtime() as unknown as RealtimeService,
  );
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Helper: char ở peak Kim Đan, exp đủ trigger kiếp. */
async function makePeakKimDanChar(opts?: {
  hpMax?: number;
  taoMaActive?: boolean;
  tribulationCooldownAt?: Date | null;
  exp?: bigint;
  realmStage?: number;
  linhThach?: bigint;
}) {
  const fixture = await makeUserChar(prisma, {
    realmKey: 'kim_dan',
    realmStage: opts?.realmStage ?? 9,
    exp: opts?.exp ?? KIM_DAN_PEAK_EXP,
    hpMax: opts?.hpMax ?? 5000,
    hp: opts?.hpMax ?? 5000,
    linhThach: opts?.linhThach ?? 1000n,
  });
  if (
    opts?.taoMaActive !== undefined ||
    opts?.tribulationCooldownAt !== undefined
  ) {
    await prisma.character.update({
      where: { id: fixture.characterId },
      data: {
        ...(opts.taoMaActive !== undefined
          ? { taoMaActive: opts.taoMaActive }
          : {}),
        ...(opts.tribulationCooldownAt !== undefined
          ? { tribulationCooldownAt: opts.tribulationCooldownAt }
          : {}),
      },
    });
  }
  return fixture;
}

describe('TribulationService.attemptTribulation — happy path (success)', () => {
  it('hpMax đủ tank 3 wave Tiểu Kim Lôi (3338 dmg) → success: ghi attempt + reward + clear cooldown/Tâm Ma + set title', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 5000 });

    const outcome = await svc.attemptTribulation(ctx.userId, () => 0.99); // skip drop

    expect(outcome.success).toBe(true);
    expect(outcome.tribulationKey).toBe(TRIB_KEY);
    expect(outcome.fromRealmKey).toBe('kim_dan');
    expect(outcome.toRealmKey).toBe('nguyen_anh');
    expect(outcome.severity).toBe('minor');
    expect(outcome.type).toBe('lei');
    expect(outcome.wavesCompleted).toBe(3);
    expect(outcome.totalDamage).toBe(3338);
    expect(outcome.finalHp).toBe(5000 - 3338);
    expect(outcome.attemptCount).toBe(1);
    expect(outcome.reward).not.toBeNull();
    expect(outcome.reward!.linhThach).toBe(5000);
    expect(outcome.reward!.expBonus).toBe('1000');
    expect(outcome.reward!.titleKey).toBe('tribulation_minor_lei_pass');
    expect(outcome.failurePenalty).toBeNull();

    // DB row inserted.
    const row = await prisma.tribulationAttempt.findFirst({
      where: { characterId: ctx.characterId, success: true },
    });
    expect(row).not.toBeNull();
    expect(row!.tribulationKey).toBe(TRIB_KEY);

    // Character title set, exp += 1000, linhThach += 5000.
    const c = await prisma.character.findUnique({ where: { id: ctx.characterId } });
    expect(c!.title).toBe('tribulation_minor_lei_pass');
    expect(c!.exp).toBe(KIM_DAN_PEAK_EXP + 1000n);
    expect(c!.linhThach).toBe(1000n + 5000n);
    expect(c!.taoMaActive).toBe(false);
    expect(c!.tribulationCooldownAt).toBeNull();

    // CurrencyLedger reason='TRIBULATION_REWARD' inserted.
    const led = await prisma.currencyLedger.findFirst({
      where: { characterId: ctx.characterId, reason: 'TRIBULATION_REWARD' },
    });
    expect(led).not.toBeNull();
    expect(led!.delta).toBe(5000n);
  });

  it('idempotent — re-attempt sau khi cleared throw ALREADY_CLEARED', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 5000 });
    await svc.attemptTribulation(ctx.userId, () => 0.99);

    await expect(
      svc.attemptTribulation(ctx.userId, () => 0.99),
    ).rejects.toBeInstanceOf(TribulationError);
    await expect(
      svc.attemptTribulation(ctx.userId, () => 0.99),
    ).rejects.toMatchObject({ code: 'ALREADY_CLEARED' });
  });
});

describe('TribulationService.attemptTribulation — failure path', () => {
  it('hpMax thấp chết wave 1 → fail: ghi fail row + apply expLoss + cooldown', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 500 });

    // taoMaRoll=0.99 → > 0.05 → no Tâm Ma debuff.
    const outcome = await svc.attemptTribulation(ctx.userId, () => 0.99);

    expect(outcome.success).toBe(false);
    expect(outcome.wavesCompleted).toBe(1);
    // simulateTribulationWave: effectiveDamage = baseDamage × elementResistMultiplier
    // (not capped by HP); finalHp = max(0, hp - dmg). hp=500, wave1 baseDamage=800.
    expect(outcome.totalDamage).toBe(800);
    expect(outcome.finalHp).toBe(0);
    expect(outcome.reward).toBeNull();
    expect(outcome.failurePenalty).not.toBeNull();
    expect(outcome.failurePenalty!.taoMaActive).toBe(false);
    expect(outcome.failurePenalty!.taoMaExpiresAt).toBeNull();

    // DB row inserted.
    const row = await prisma.tribulationAttempt.findFirst({
      where: { characterId: ctx.characterId, success: false },
    });
    expect(row).not.toBeNull();
    expect(row!.taoMaTriggered).toBe(false);

    // BigInt expLoss = 60448n × (0.1 * 1_000_000)/1_000_000 = 6044n;
    // expAfter = 60448 − 6044 = 54404.
    const c = await prisma.character.findUnique({ where: { id: ctx.characterId } });
    expect(c!.exp).toBe(54404n);
    expect(c!.tribulationCooldownAt).not.toBeNull();
    expect(c!.taoMaActive).toBe(false);
  });

  it('fail + taoMaRoll < 0.05 → Tâm Ma debuff trigger', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 500 });

    // Use 2-call sequence: dropRoll first (success path uses dropRoll), but this is fail path
    // → dùng taoMaRoll=0.04 (< 0.05) → trigger debuff.
    const outcome = await svc.attemptTribulation(ctx.userId, () => 0.04);

    expect(outcome.success).toBe(false);
    expect(outcome.failurePenalty!.taoMaActive).toBe(true);
    expect(outcome.failurePenalty!.taoMaExpiresAt).not.toBeNull();

    const c = await prisma.character.findUnique({ where: { id: ctx.characterId } });
    expect(c!.taoMaActive).toBe(true);
    expect(c!.taoMaExpiresAt).not.toBeNull();

    const row = await prisma.tribulationAttempt.findFirst({
      where: { characterId: ctx.characterId, success: false },
    });
    expect(row!.taoMaTriggered).toBe(true);
  });

  it('retry sau fail nhưng còn cooldown → throw IN_COOLDOWN', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 500 });
    await svc.attemptTribulation(ctx.userId, () => 0.99);

    // ngay sau fail, cooldown chưa hết → throw.
    await expect(
      svc.attemptTribulation(ctx.userId, () => 0.99),
    ).rejects.toMatchObject({ code: 'IN_COOLDOWN' });
  });

  it('retry sau khi cooldown hết → re-attempt OK, attemptCount tăng', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 500 });
    await svc.attemptTribulation(ctx.userId, () => 0.99);

    // Manually expire cooldown.
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { tribulationCooldownAt: new Date(Date.now() - 1000) },
    });
    // Bump hp để pass kiếp lần 2 (giả lập sau bồi tu).
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { hpMax: 5000, hp: 5000, exp: KIM_DAN_PEAK_EXP },
    });

    const outcome2 = await svc.attemptTribulation(ctx.userId, () => 0.99);
    expect(outcome2.success).toBe(true);
    expect(outcome2.attemptCount).toBe(2);

    const rows = await prisma.tribulationAttempt.findMany({
      where: { characterId: ctx.characterId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].success).toBe(false);
    expect(rows[1].success).toBe(true);
  });
});

describe('TribulationService.attemptTribulation — gating errors', () => {
  it('character không tồn tại → NO_CHARACTER', async () => {
    await expect(
      svc.attemptTribulation('non-existent-user-id'),
    ).rejects.toMatchObject({ code: 'NO_CHARACTER' });
  });

  it('character chưa ở peak (stage<9) → NOT_AT_PEAK', async () => {
    const ctx = await makePeakKimDanChar({ realmStage: 5 });
    await expect(svc.attemptTribulation(ctx.userId)).rejects.toMatchObject({
      code: 'NOT_AT_PEAK',
    });
  });

  it('character ở peak nhưng exp<cost(9) → NOT_AT_PEAK', async () => {
    const ctx = await makePeakKimDanChar({ exp: 0n });
    await expect(svc.attemptTribulation(ctx.userId)).rejects.toMatchObject({
      code: 'NOT_AT_PEAK',
    });
  });

  it('character ở realm không có kiếp (luyenkhi peak) → NO_TRIBULATION', async () => {
    // luyenkhi → truc_co không có kiếp (catalog không list — 4 tribulation đầu
    // bắt đầu từ kim_dan→nguyen_anh).
    const fixture = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 9,
      exp: 100_000n,
    });
    await expect(svc.attemptTribulation(fixture.userId)).rejects.toMatchObject({
      code: 'NO_TRIBULATION',
    });
  });
});

describe('TribulationService.previewNext', () => {
  it('peak Kim Đan trả def kim_dan→nguyen_anh', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 5000 });
    const def = await svc.previewNext(ctx.userId);
    expect(def).not.toBeNull();
    expect(def!.key).toBe(TRIB_KEY);
  });

  it('character không tồn tại → null', async () => {
    const def = await svc.previewNext('non-existent');
    expect(def).toBeNull();
  });

  it('luyenkhi peak → null (không có kiếp)', async () => {
    const fixture = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 9,
    });
    const def = await svc.previewNext(fixture.userId);
    expect(def).toBeNull();
  });
});

describe('CharacterService.breakthrough — Phase 11.6.B Tribulation gate', () => {
  it('peak Kim Đan (có kiếp) chưa vượt → throw TRIBULATION_REQUIRED', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 5000 });

    await expect(charSvc.breakthrough(ctx.userId)).rejects.toMatchObject({
      code: 'TRIBULATION_REQUIRED',
    });

    // Realm chưa advance.
    const c = await prisma.character.findUnique({ where: { id: ctx.characterId } });
    expect(c!.realmKey).toBe('kim_dan');
  });

  it('peak Kim Đan + cleared trib → breakthrough OK, advance kim_dan→nguyen_anh', async () => {
    const ctx = await makePeakKimDanChar({ hpMax: 5000 });
    await svc.attemptTribulation(ctx.userId, () => 0.99); // success run

    // Re-fetch exp sau khi reward (exp += 1000 từ trib).
    const before = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(before!.exp).toBe(KIM_DAN_PEAK_EXP + 1000n);

    const after = await charSvc.breakthrough(ctx.userId);
    expect(after.realmKey).toBe('nguyen_anh');
    expect(after.realmStage).toBe(1);
  });

  it('peak Luyện Khí (không có kiếp) → breakthrough OK, không gate', async () => {
    const fixture = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 9,
      exp: 1_000_000n, // dư cost
    });
    const after = await charSvc.breakthrough(fixture.userId);
    expect(after.realmKey).toBe('truc_co');
    expect(after.realmStage).toBe(1);
  });
});

describe('CharacterService.setCultivating — Phase 11.6.B Tâm Ma gate', () => {
  it('character có Tâm Ma debuff active không tu luyện được → TAO_MA_ACTIVE', async () => {
    const ctx = await makePeakKimDanChar({
      taoMaActive: true,
      tribulationCooldownAt: new Date(Date.now() + 30 * 60_000),
    });
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { taoMaExpiresAt: new Date(Date.now() + 15 * 60_000) },
    });
    await expect(charSvc.setCultivating(ctx.userId, true)).rejects.toMatchObject({
      code: 'TAO_MA_ACTIVE',
    });
  });

  it('Tâm Ma debuff hết hạn → auto-clear + cho cultivating', async () => {
    const ctx = await makePeakKimDanChar({
      taoMaActive: true,
    });
    await prisma.character.update({
      where: { id: ctx.characterId },
      data: { taoMaExpiresAt: new Date(Date.now() - 1000) },
    });
    const state = await charSvc.setCultivating(ctx.userId, true);
    expect(state.cultivating).toBe(true);

    const c = await prisma.character.findUnique({ where: { id: ctx.characterId } });
    expect(c!.taoMaActive).toBe(false);
    expect(c!.taoMaExpiresAt).toBeNull();
  });
});
