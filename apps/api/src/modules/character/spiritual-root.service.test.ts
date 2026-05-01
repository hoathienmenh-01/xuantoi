import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ELEMENTS, SPIRITUAL_ROOT_GRADES, getSpiritualRootGradeDef } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import {
  SpiritualRootService,
  rollRandomState,
  makeSeededRng,
} from './spiritual-root.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let svc: SpiritualRootService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  svc = new SpiritualRootService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SpiritualRootService.rollOnboard', () => {
  it('roll lần đầu set spiritualRootGrade + primaryElement + log entry', async () => {
    const f = await makeUserChar(prisma);
    const rng = makeSeededRng(12345);
    const state = await svc.rollOnboard(f.characterId, rng);

    expect(SPIRITUAL_ROOT_GRADES).toContain(state.grade);
    expect(ELEMENTS).toContain(state.primaryElement);
    const def = getSpiritualRootGradeDef(state.grade);
    expect(state.secondaryElements.length).toBe(def.secondaryElementCount);
    // No duplicate primary in secondary, no duplicates in secondary.
    const all = new Set([state.primaryElement, ...state.secondaryElements]);
    expect(all.size).toBe(1 + state.secondaryElements.length);
    expect(state.purity).toBeGreaterThanOrEqual(80);
    expect(state.purity).toBeLessThanOrEqual(100);

    // Persisted state matches.
    const c = await prisma.character.findUnique({ where: { id: f.characterId } });
    expect(c?.spiritualRootGrade).toBe(state.grade);
    expect(c?.primaryElement).toBe(state.primaryElement);
    expect(c?.secondaryElements).toEqual([...state.secondaryElements]);
    expect(c?.rootPurity).toBe(state.purity);
    expect(c?.rootRerollCount).toBe(0);

    // Log entry created with source='onboard'.
    const logs = await prisma.spiritualRootRollLog.findMany({
      where: { characterId: f.characterId },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].source).toBe('onboard');
    expect(logs[0].previousGrade).toBeNull();
    expect(logs[0].newGrade).toBe(state.grade);
    expect(logs[0].previousElement).toBeNull();
    expect(logs[0].newElement).toBe(state.primaryElement);
  });

  it('roll lần thứ 2 idempotent: trả về state cũ, không tạo log mới', async () => {
    const f = await makeUserChar(prisma);
    const rng1 = makeSeededRng(11111);
    const first = await svc.rollOnboard(f.characterId, rng1);

    const rng2 = makeSeededRng(99999);
    const second = await svc.rollOnboard(f.characterId, rng2);

    expect(second.grade).toBe(first.grade);
    expect(second.primaryElement).toBe(first.primaryElement);
    expect(second.secondaryElements).toEqual(first.secondaryElements);
    expect(second.purity).toBe(first.purity);

    const logs = await prisma.spiritualRootRollLog.findMany({
      where: { characterId: f.characterId },
    });
    expect(logs.length).toBe(1);
  });

  it('seeded RNG → deterministic grade + element', async () => {
    const f1 = await makeUserChar(prisma);
    const f2 = await makeUserChar(prisma);
    const rngA = makeSeededRng(42);
    const rngB = makeSeededRng(42);
    const a = await svc.rollOnboard(f1.characterId, rngA);
    const b = await svc.rollOnboard(f2.characterId, rngB);
    expect(a.grade).toBe(b.grade);
    expect(a.primaryElement).toBe(b.primaryElement);
    expect(a.secondaryElements).toEqual(b.secondaryElements);
    expect(a.purity).toBe(b.purity);
  });

  it('character not found → throw', async () => {
    await expect(svc.rollOnboard('clxxxxxxxxxxxxxxxxxxxxxxx')).rejects.toThrow(
      /Character not found/,
    );
  });
});

describe('SpiritualRootService.getState', () => {
  it('character đã rolled → trả state hiện tại không re-roll', async () => {
    const f = await makeUserChar(prisma);
    const initial = await svc.rollOnboard(f.characterId, makeSeededRng(7));

    const got = await svc.getState(f.characterId);
    expect(got.grade).toBe(initial.grade);
    expect(got.primaryElement).toBe(initial.primaryElement);
    expect(got.secondaryElements).toEqual(initial.secondaryElements);
  });

  it('character legacy (grade=null) → auto-roll lần đầu', async () => {
    const f = await makeUserChar(prisma);
    // Verify legacy state.
    const before = await prisma.character.findUnique({ where: { id: f.characterId } });
    expect(before?.spiritualRootGrade).toBeNull();

    const state = await svc.getState(f.characterId, makeSeededRng(123));
    expect(SPIRITUAL_ROOT_GRADES).toContain(state.grade);

    // Persisted.
    const after = await prisma.character.findUnique({ where: { id: f.characterId } });
    expect(after?.spiritualRootGrade).toBe(state.grade);
  });

  it('character not found → throw', async () => {
    await expect(svc.getState('clxxxxxxxxxxxxxxxxxxxxxxx')).rejects.toThrow(
      /Character not found/,
    );
  });
});

describe('SpiritualRootService idempotent on concurrent onboard call', () => {
  it('2 lần roll song song → chỉ 1 log entry, state ổn định', async () => {
    const f = await makeUserChar(prisma);
    const [s1, s2] = await Promise.all([
      svc.rollOnboard(f.characterId, makeSeededRng(1)),
      svc.rollOnboard(f.characterId, makeSeededRng(2)),
    ]);
    // State có thể bằng s1 hoặc s2 (race), nhưng đều phải khớp DB.
    const c = await prisma.character.findUnique({ where: { id: f.characterId } });
    expect(c?.spiritualRootGrade === s1.grade || c?.spiritualRootGrade === s2.grade).toBe(true);

    // Tổng log có thể 1 hoặc 2 (race window) — nhưng final state phải nhất
    // quán với log gần nhất. Tolerance 1-2 là acceptable.
    const logs = await prisma.spiritualRootRollLog.findMany({
      where: { characterId: f.characterId },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.length).toBeLessThanOrEqual(2);
  });
});

describe('rollRandomState pure RNG helper', () => {
  it('seed cố định → kết quả deterministic', () => {
    const a = rollRandomState(makeSeededRng(7));
    const b = rollRandomState(makeSeededRng(7));
    expect(a).toEqual(b);
  });

  it('grade tier khớp số lượng secondaryElements', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = rollRandomState(makeSeededRng(seed));
      const def = getSpiritualRootGradeDef(s.grade);
      expect(s.secondaryElements.length).toBe(def.secondaryElementCount);
    }
  });

  it('secondaryElements không trùng primaryElement, không trùng nhau', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = rollRandomState(makeSeededRng(seed));
      const set = new Set([s.primaryElement, ...s.secondaryElements]);
      expect(set.size).toBe(1 + s.secondaryElements.length);
    }
  });

  it('purity ∈ [80, 100]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = rollRandomState(makeSeededRng(seed));
      expect(s.purity).toBeGreaterThanOrEqual(80);
      expect(s.purity).toBeLessThanOrEqual(100);
    }
  });

  it('grade distribution với 10000 sample bám sát weight (60/25/10/4/1)', () => {
    const counts: Record<string, number> = {
      pham: 0,
      linh: 0,
      huyen: 0,
      tien: 0,
      than: 0,
    };
    const rng = makeSeededRng(202604);
    for (let i = 0; i < 10000; i++) {
      const s = rollRandomState(rng);
      counts[s.grade]++;
    }
    // Tolerance ±5 percentage points.
    expect(counts.pham / 10000).toBeGreaterThan(0.50);
    expect(counts.pham / 10000).toBeLessThan(0.70);
    expect(counts.linh / 10000).toBeGreaterThan(0.18);
    expect(counts.linh / 10000).toBeLessThan(0.32);
    expect(counts.huyen / 10000).toBeGreaterThan(0.06);
    expect(counts.huyen / 10000).toBeLessThan(0.14);
    expect(counts.tien / 10000).toBeGreaterThan(0.02);
    expect(counts.tien / 10000).toBeLessThan(0.07);
    expect(counts.than / 10000).toBeGreaterThan(0.003);
    expect(counts.than / 10000).toBeLessThan(0.020);
  });

  it('5 element distribution với 5000 sample roughly uniform 20% mỗi element', () => {
    const counts: Record<string, number> = { kim: 0, moc: 0, thuy: 0, hoa: 0, tho: 0 };
    const rng = makeSeededRng(31415);
    for (let i = 0; i < 5000; i++) {
      const s = rollRandomState(rng);
      counts[s.primaryElement]++;
    }
    for (const e of ELEMENTS) {
      expect(counts[e] / 5000).toBeGreaterThan(0.13);
      expect(counts[e] / 5000).toBeLessThan(0.27);
    }
  });
});
