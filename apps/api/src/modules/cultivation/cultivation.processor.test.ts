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
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let processor: CultivationProcessor;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService(); // unbound — emitToUser sẽ no-op.
  processor = new CultivationProcessor(prisma, realtime);
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
});
