import { Injectable } from '@nestjs/common';
import {
  REALMS,
  canCharacterLearnTalent,
  composePassiveTalentMods,
  computeTalentPointBudget,
  getTalentDef,
  type PassiveTalentMods,
  type TalentDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Map ổn định `realmKey → order` build 1 lần khi module load. `REALMS` là
 * `readonly` từ catalog nên map này invariant per-process.
 */
const REALM_KEY_TO_ORDER: ReadonlyMap<string, number> = new Map(
  REALMS.map((r) => [r.key, r.order]),
);

/**
 * Phase 11.7.B Talent (Thần Thông) MVP runtime — passive/active talent
 * persistence service.
 *
 * Server-authoritative talent service:
 *   - {@link learnTalent} validate realm + talent point budget + idempotency
 *     qua composite UNIQUE `(characterId, talentKey)`.
 *   - {@link listLearned} return rows + def metadata.
 *   - {@link getMods} compose `PassiveTalentMods` qua catalog
 *     `composePassiveTalentMods(learnedDefs)` (deterministic pure).
 *
 * Wire FUTURE (NOT in scope 11.7.B MVP):
 *   - `composePassiveTalentMods` vào `CharacterStatService.computeStats`
 *     → atk/def/hpMax/mpMax/spirit + drop/exp multiplier + element
 *     damage_bonus (Phase 11.7.C).
 *   - Active talent ("thần thông") `useActiveTalent` qua mp consume +
 *     cooldown turns enforce trong combat tick (Phase 11.7.C).
 */
@Injectable()
export class TalentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Learn 1 talent. Atomic via `prisma.$transaction`:
   *   1. Validate `getTalentDef(talentKey)` (catalog) → throw `TALENT_NOT_FOUND`.
   *   2. Validate character exists → throw `CHARACTER_NOT_FOUND`.
   *   3. Validate chưa học (composite UNIQUE) → throw `ALREADY_LEARNED`.
   *   4. Compute `currentRealmOrder` từ char.realmKey via `REALM_KEY_TO_ORDER`
   *      → throw `INVALID_REALM` nếu key không có trong catalog (defensive —
   *      legacy character nên có realm hợp lệ).
   *   5. Sum `talentPointCost` của talent đã học khác làm `pointsAlreadySpent`.
   *   6. Call `canCharacterLearnTalent(def, order, map, spent)` → nếu
   *      `!canLearn` throw với mã reason mapped (`REALM_TOO_LOW` |
   *      `INSUFFICIENT_TALENT_POINTS` | `INVALID_REALM_REQUIREMENT`).
   *   7. Insert `CharacterTalent` row + return.
   */
  async learnTalent(
    characterId: string,
    talentKey: string,
  ): Promise<{ talentKey: string; learnedAt: Date }> {
    const def = getTalentDef(talentKey);
    if (!def) throw new TalentError('TALENT_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { id: true, realmKey: true },
      });
      if (!character) throw new TalentError('CHARACTER_NOT_FOUND');

      const currentRealmOrder = REALM_KEY_TO_ORDER.get(character.realmKey);
      if (currentRealmOrder === undefined) {
        throw new TalentError('INVALID_REALM');
      }

      const existing = await tx.characterTalent.findUnique({
        where: {
          characterId_talentKey: { characterId, talentKey },
        },
      });
      if (existing) throw new TalentError('ALREADY_LEARNED');

      // Sum talent point cost của talent đã học khác.
      const learnedRows = await tx.characterTalent.findMany({
        where: { characterId },
        select: { talentKey: true },
      });
      let pointsAlreadySpent = 0;
      for (const row of learnedRows) {
        const learnedDef = getTalentDef(row.talentKey);
        if (learnedDef) pointsAlreadySpent += learnedDef.talentPointCost;
        // Defensive: nếu catalog đổi key → talent học cũ count = 0 (không
        // throw, chỉ skip — character vẫn có thể học talent mới).
      }

      const check = canCharacterLearnTalent(
        def,
        currentRealmOrder,
        REALM_KEY_TO_ORDER,
        pointsAlreadySpent,
      );
      if (!check.canLearn) {
        switch (check.reason) {
          case 'realm_too_low':
            throw new TalentError('REALM_TOO_LOW');
          case 'insufficient_talent_points':
            throw new TalentError('INSUFFICIENT_TALENT_POINTS');
          case 'invalid_realm_requirement':
            throw new TalentError('INVALID_REALM_REQUIREMENT');
          default:
            throw new TalentError('INSUFFICIENT_TALENT_POINTS');
        }
      }

      const created = await tx.characterTalent.create({
        data: { characterId, talentKey },
      });
      return {
        talentKey: created.talentKey,
        learnedAt: created.learnedAt,
      };
    });
  }

  /**
   * List talent character đã học (kèm metadata từ catalog). Defensive: nếu
   * row có `talentKey` không còn trong catalog (legacy / catalog rename) thì
   * skip khỏi return list.
   */
  async listLearned(
    characterId: string,
  ): Promise<
    Array<{ talentKey: string; learnedAt: Date; def: TalentDef }>
  > {
    const rows = await this.prisma.characterTalent.findMany({
      where: { characterId },
      orderBy: { learnedAt: 'asc' },
    });
    const result: Array<{
      talentKey: string;
      learnedAt: Date;
      def: TalentDef;
    }> = [];
    for (const row of rows) {
      const def = getTalentDef(row.talentKey);
      if (!def) continue;
      result.push({ talentKey: row.talentKey, learnedAt: row.learnedAt, def });
    }
    return result;
  }

  /**
   * Compute remaining talent point budget cho character (cho UI hiển thị
   * "còn X điểm ngộ đạo").
   */
  async getRemainingTalentPoints(characterId: string): Promise<number> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { realmKey: true },
    });
    if (!character) throw new TalentError('CHARACTER_NOT_FOUND');

    const currentRealmOrder = REALM_KEY_TO_ORDER.get(character.realmKey);
    if (currentRealmOrder === undefined) {
      throw new TalentError('INVALID_REALM');
    }
    const budget = computeTalentPointBudget(currentRealmOrder);
    const learned = await this.listLearned(characterId);
    const spent = learned.reduce((s, l) => s + l.def.talentPointCost, 0);
    return budget - spent;
  }

  /**
   * Compose `PassiveTalentMods` cho character (combat/stat hệ wire FUTURE
   * Phase 11.7.C). Deterministic — return từ `composePassiveTalentMods` với
   * các `TalentDef` của talent đã học.
   */
  async getMods(characterId: string): Promise<PassiveTalentMods> {
    const learned = await this.listLearned(characterId);
    const keys = learned.map((l) => l.talentKey);
    return composePassiveTalentMods(keys);
  }
}

export class TalentError extends Error {
  constructor(
    public code:
      | 'TALENT_NOT_FOUND'
      | 'CHARACTER_NOT_FOUND'
      | 'ALREADY_LEARNED'
      | 'REALM_TOO_LOW'
      | 'INSUFFICIENT_TALENT_POINTS'
      | 'INVALID_REALM_REQUIREMENT'
      | 'INVALID_REALM',
  ) {
    super(code);
  }
}
