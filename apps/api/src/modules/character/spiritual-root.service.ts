import { Injectable } from '@nestjs/common';
import {
  ELEMENTS,
  SPIRITUAL_ROOT_GRADE_DEFS,
  getSpiritualRootGradeDef,
  type ElementKey,
  type SpiritualRootGrade,
  type SpiritualRootGradeDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Phase 11.3.A — Linh căn / Spiritual Root server-authoritative service.
 *
 * Trách nhiệm:
 *   - `rollOnboard(characterId, rng?)` — tạo linh căn lần đầu khi onboard
 *     character. Idempotent: nếu đã có log `source='onboard'` thì trả về
 *     state hiện tại không roll lại.
 *   - `getState(characterId)` — đọc linh căn hiện tại của character. Nếu
 *     character pre-Phase 11.3 (legacy `spiritualRootGrade=null`), tự động
 *     lazy-roll lần đầu.
 *
 * Tất cả RNG đều inject được `(rng?: () => number)` cho test deterministic;
 * default `Math.random` ở runtime.
 *
 * KHÔNG implement reroll bằng item trong Phase 11.3.A — đó là 11.3.B
 * (cần `linh_can_dan` ItemLedger consume + cost gating + rate-limit).
 */
@Injectable()
export class SpiritualRootService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roll linh căn lần đầu khi onboard character. Idempotent: nếu đã có log
   * `source='onboard'` cho characterId này thì return state hiện tại.
   *
   * Server-authoritative: KHÔNG nhận grade/element từ client.
   *
   * @param characterId — character đang onboard.
   * @param rng — optional injected RNG (test). Default `Math.random`.
   */
  async rollOnboard(
    characterId: string,
    rng: () => number = Math.random,
  ): Promise<SpiritualRootStateOut> {
    // Idempotency check — nếu đã có onboard log, không roll lại.
    const existing = await this.prisma.spiritualRootRollLog.findFirst({
      where: { characterId, source: 'onboard' },
    });
    if (existing) {
      const c = await this.prisma.character.findUnique({
        where: { id: characterId },
      });
      if (!c) {
        throw new Error(`Character not found: ${characterId}`);
      }
      return toStateOut(c);
    }

    return this.rollAndPersist(characterId, 'onboard', rng);
  }

  /**
   * Đọc state linh căn hiện tại. Nếu character legacy (pre-Phase 11.3) thì
   * tự auto-roll onboard lần đầu (lazy migration).
   */
  async getState(
    characterId: string,
    rng: () => number = Math.random,
  ): Promise<SpiritualRootStateOut> {
    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!c) {
      throw new Error(`Character not found: ${characterId}`);
    }
    if (!c.spiritualRootGrade || !c.primaryElement) {
      return this.rollOnboard(characterId, rng);
    }
    return toStateOut(c);
  }

  /**
   * Internal — roll RNG + persist Character + insert log row trong transaction.
   */
  private async rollAndPersist(
    characterId: string,
    source: 'onboard' | 'reroll',
    rng: () => number,
  ): Promise<SpiritualRootStateOut> {
    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!c) {
      throw new Error(`Character not found: ${characterId}`);
    }

    const previous = {
      grade: c.spiritualRootGrade,
      element: c.primaryElement,
      secondary: c.secondaryElements,
      purity: c.spiritualRootGrade ? c.rootPurity : null,
    };

    const rolled = rollRandomState(rng);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.character.update({
        where: { id: characterId },
        data: {
          spiritualRootGrade: rolled.grade,
          primaryElement: rolled.primaryElement,
          secondaryElements: [...rolled.secondaryElements],
          rootPurity: rolled.purity,
          rootRerollCount: source === 'reroll' ? c.rootRerollCount + 1 : c.rootRerollCount,
        },
      });

      await tx.spiritualRootRollLog.create({
        data: {
          characterId,
          source,
          previousGrade: previous.grade,
          newGrade: rolled.grade,
          previousElement: previous.element,
          newElement: rolled.primaryElement,
          previousSecondaryElements: previous.secondary ?? [],
          newSecondaryElements: [...rolled.secondaryElements],
          previousPurity: previous.purity,
          newPurity: rolled.purity,
        },
      });

      return toStateOut(updated);
    });
  }
}

export interface SpiritualRootStateOut {
  grade: SpiritualRootGrade;
  primaryElement: ElementKey;
  secondaryElements: readonly ElementKey[];
  purity: number;
  rerollCount: number;
}

interface RolledState {
  grade: SpiritualRootGrade;
  primaryElement: ElementKey;
  secondaryElements: readonly ElementKey[];
  purity: number;
}

/**
 * Pure RNG — pick grade theo weighted distribution + random element +
 * random secondary elements (no duplicate). Tách khỏi service để test
 * deterministic dễ hơn.
 *
 * Default distribution: pham 60% / linh 25% / huyen 10% / tien 4% / than 1%.
 * Purity: 80-100 (random uniform integer).
 */
export function rollRandomState(rng: () => number): RolledState {
  const grade = pickGradeWeighted(rng);
  const def = getSpiritualRootGradeDef(grade);
  const primaryElement = pickFromList([...ELEMENTS], rng);
  const secondaryElements = pickSecondaryElements(primaryElement, def, rng);
  const purity = 80 + Math.floor(rng() * 21); // 80-100 inclusive
  return { grade, primaryElement, secondaryElements, purity };
}

function pickGradeWeighted(rng: () => number): SpiritualRootGrade {
  const totalWeight = SPIRITUAL_ROOT_GRADE_DEFS.reduce(
    (sum, g) => sum + g.rollWeight,
    0,
  );
  let r = rng() * totalWeight;
  for (const g of SPIRITUAL_ROOT_GRADE_DEFS) {
    r -= g.rollWeight;
    if (r <= 0) return g.key;
  }
  // Fallback (RNG edge case if rng() returns exactly totalWeight via float).
  return SPIRITUAL_ROOT_GRADE_DEFS[SPIRITUAL_ROOT_GRADE_DEFS.length - 1].key;
}

function pickFromList<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)];
}

function pickSecondaryElements(
  primary: ElementKey,
  def: SpiritualRootGradeDef,
  rng: () => number,
): readonly ElementKey[] {
  if (def.secondaryElementCount === 0) return [];
  const candidates = ELEMENTS.filter((e) => e !== primary);
  // Fisher-Yates partial shuffle.
  const arr = [...candidates];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, def.secondaryElementCount);
}

function toStateOut(c: {
  spiritualRootGrade: string | null;
  primaryElement: string | null;
  secondaryElements: string[];
  rootPurity: number;
  rootRerollCount: number;
}): SpiritualRootStateOut {
  // Defensive: if legacy character somehow read directly (caller bug),
  // default to 'pham' / 'kim' / [] / 100. Caller should use getState() to
  // auto-roll instead.
  const grade = (c.spiritualRootGrade ?? 'pham') as SpiritualRootGrade;
  const primaryElement = (c.primaryElement ?? 'kim') as ElementKey;
  return {
    grade,
    primaryElement,
    secondaryElements: c.secondaryElements as ElementKey[],
    purity: c.rootPurity,
    rerollCount: c.rootRerollCount,
  };
}

/**
 * Build a deterministic seeded RNG from a numeric seed — Mulberry32.
 * Test-only helper; runtime should use `Math.random`.
 */
export function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
