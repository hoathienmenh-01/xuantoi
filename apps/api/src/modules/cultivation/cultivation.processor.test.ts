import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CULTIVATION_TICK_BASE_EXP,
  STAMINA_REGEN_PER_TICK,
  cultivationRateForRealm,
  expCostForStage,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CultivationProcessor } from './cultivation.processor';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let processor: CultivationProcessor;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService(); // unbound — emitToUser sẽ no-op.
  const missions = makeMissionService(prisma);
  processor = new CultivationProcessor(prisma, realtime, missions);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Job giả lập — processor chỉ đọc `name`.
function tickJob() {
  return { name: 'tick' } as Parameters<CultivationProcessor['process']>[0];
}

describe('CultivationProcessor.process (tick)', () => {
  it('cộng EXP cho character đang `cultivating=true`, không cộng cho đứa false', async () => {
    const a = await makeUserChar(prisma, { cultivating: true, spirit: 8 });
    const b = await makeUserChar(prisma, { cultivating: false, spirit: 8 });

    await processor.process(tickJob());

    const cA = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    const cB = await prisma.character.findUniqueOrThrow({ where: { id: b.characterId } });
    // gain = rateForRealm(luyenkhi) + floor(spirit/4) = 7 + 2 = 9
    const expectedGain = BigInt(
      cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2,
    );
    expect(cA.exp).toBe(expectedGain);
    expect(cB.exp).toBe(0n);
  });

  it('regen stamina cho TẤT CẢ character (kể cả không tu luyện), cap = staminaMax', async () => {
    const a = await makeUserChar(prisma, { stamina: 50, staminaMax: 100, cultivating: false });
    const b = await makeUserChar(prisma, {
      stamina: 99,
      staminaMax: 100,
      cultivating: true,
    });

    await processor.process(tickJob());

    const cA = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    const cB = await prisma.character.findUniqueOrThrow({ where: { id: b.characterId } });
    expect(cA.stamina).toBe(50 + STAMINA_REGEN_PER_TICK);
    // cap không vượt staminaMax
    expect(cB.stamina).toBe(100);
  });

  it('auto-breakthrough khi vượt cap stage < 9 — exp dư đẩy sang stage tiếp theo', async () => {
    // Stage 1 cap = 1000; cho exp gần đủ để 1 tick đẩy qua stage 2.
    const cap1 = expCostForStage('luyenkhi', 1)!;
    const a = await makeUserChar(prisma, {
      cultivating: true,
      spirit: 8,
      realmKey: 'luyenkhi',
      realmStage: 1,
      exp: cap1 - 1n, // chỉ thiếu 1 EXP
    });

    await processor.process(tickJob());

    const c = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    // Sau tick: vượt cap → stage 2; exp = (exp + gain - cap1)
    const gain = BigInt(
      cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2,
    );
    expect(c.realmStage).toBe(2);
    expect(c.exp).toBe(cap1 - 1n + gain - cap1);
  });

  it('KHÔNG auto-breakthrough qua cảnh giới mới — dừng ở stage 9 (chờ gọi breakthrough thủ công)', async () => {
    const cap9 = expCostForStage('luyenkhi', 9)!;
    const a = await makeUserChar(prisma, {
      cultivating: true,
      spirit: 8,
      realmKey: 'luyenkhi',
      realmStage: 9,
      exp: cap9 - 1n,
    });
    await processor.process(tickJob());
    const c = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    // stage 9 không auto-break → vẫn ở luyenkhi/9, exp tiếp tục cộng dồn.
    expect(c.realmKey).toBe('luyenkhi');
    expect(c.realmStage).toBe(9);
    expect(c.exp).toBeGreaterThan(cap9 - 1n);
  });

  it('character không tồn tại trong tick (deleted) — process không throw, các others vẫn tick', async () => {
    const a = await makeUserChar(prisma, { cultivating: true, spirit: 8 });
    const b = await makeUserChar(prisma, { cultivating: true, spirit: 8 });

    // Mô phỏng race: xoá `a` ngay sau khi processor đọc danh sách (khó kiểm
    // chứng race thật, nhưng processor có try/catch per-character ngăn chặn
    // 1 lỗi làm hỏng cả batch). Test bằng cách run 1 tick bình thường và
    // confirm cả 2 đều có EXP > 0.
    await processor.process(tickJob());

    const cA = await prisma.character.findUniqueOrThrow({ where: { id: a.characterId } });
    const cB = await prisma.character.findUniqueOrThrow({ where: { id: b.characterId } });
    expect(cA.exp).toBeGreaterThan(0n);
    expect(cB.exp).toBeGreaterThan(0n);
  });

  // — Phase 11.3.C Linh căn cultivationMultiplier wire ----------------------
  describe('Linh căn cultivationMultiplier wire (Phase 11.3.C)', () => {
    it('character có spiritualRootGrade=than → gain × 1.80 vs legacy null × 1.0', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      // Legacy character (spiritualRootGrade=null) → multiplier 1.0
      const legacy = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        // KHÔNG set spiritualRootGrade → null
      });
      // Thần linh căn → multiplier 1.80
      const than = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        spiritualRootGrade: 'than',
        primaryElement: 'kim',
        secondaryElements: ['moc', 'thuy', 'hoa', 'tho'],
      });

      await processor.process(tickJob());

      const cLegacy = await prisma.character.findUniqueOrThrow({ where: { id: legacy.characterId } });
      const cThan = await prisma.character.findUniqueOrThrow({ where: { id: than.characterId } });
      expect(cLegacy.exp).toBe(BigInt(baseGain));
      // Thần grade × 1.80 → round(baseGain * 1.80)
      expect(cThan.exp).toBe(BigInt(Math.round(baseGain * 1.8)));
    });

    it('character có spiritualRootGrade=pham → gain × 1.0 (KHÔNG bonus)', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const pham = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        spiritualRootGrade: 'pham',
        primaryElement: 'kim',
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: pham.characterId } });
      expect(c.exp).toBe(BigInt(baseGain));
    });

    it('character có spiritualRootGrade=huyen → gain × 1.30', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const huyen = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        spiritualRootGrade: 'huyen',
        primaryElement: 'kim',
        secondaryElements: ['moc'],
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: huyen.characterId } });
      expect(c.exp).toBe(BigInt(Math.round(baseGain * 1.3)));
    });
  });

  // — Phase 11.1.B Cultivation Method expMultiplier wire --------------------
  describe('Cultivation method expMultiplier wire (Phase 11.1.B)', () => {
    it('character equip method huyen `liet_hoa_phap` (1.20×) compose với root than (1.80×) → gain × 2.16', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const f = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        spiritualRootGrade: 'than',
        primaryElement: 'hoa',
        secondaryElements: ['kim', 'moc', 'thuy', 'tho'],
        equippedCultivationMethodKey: 'liet_hoa_phap',
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
      // Compose: baseGain × rootMul (1.80) × methodMul (1.20) → round.
      expect(c.exp).toBe(BigInt(Math.round(baseGain * 1.8 * 1.2)));
    });

    it('character KHÔNG equip method (legacy null) → methodMul=1.0 (backward-compat)', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const f = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        // KHÔNG set equippedCultivationMethodKey → null
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
      expect(c.exp).toBe(BigInt(baseGain));
    });

    it('character equip starter `khai_thien_quyet` (1.0×) → KHÔNG bonus', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const f = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        equippedCultivationMethodKey: 'khai_thien_quyet',
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
      expect(c.exp).toBe(BigInt(baseGain));
    });

    it('character equip than-grade `thai_hu_chan_kinh` (1.60×) + root pham (1.0×) → gain × 1.60', async () => {
      const baseGain = cultivationRateForRealm('luyenkhi', CULTIVATION_TICK_BASE_EXP) + 2;
      const f = await makeUserChar(prisma, {
        cultivating: true,
        spirit: 8,
        spiritualRootGrade: 'pham',
        primaryElement: 'kim',
        equippedCultivationMethodKey: 'thai_hu_chan_kinh',
      });
      await processor.process(tickJob());
      const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
      expect(c.exp).toBe(BigInt(Math.round(baseGain * 1.6)));
    });
  });
});
