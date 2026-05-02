import { Injectable } from '@nestjs/common';
import { CurrencyKind } from '@prisma/client';
import {
  ACHIEVEMENTS,
  achievementsByGoalKind,
  getAchievementDef,
  titleForAchievement,
  type AchievementDef,
  type MissionGoalKind,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';
import { TitleService } from './title.service';

/**
 * Phase 11.10.B/C-1 Achievement (Thành Tựu) runtime — progress + completion
 * persistence + reward claim.
 *
 * Server-authoritative achievement service:
 *   - {@link incrementProgress} idempotent qua composite UNIQUE
 *     `(characterId, achievementKey)`. Atomic upsert; cap progress tại
 *     `def.goalAmount`; set `completedAt` một lần khi đạt goal (immutable
 *     sau đó).
 *   - {@link trackEvent} bulk-increment tất cả achievement cùng `goalKind`
 *     qua `achievementsByGoalKind` lookup. Dùng cho event listener tương
 *     lai (combat/dungeon/breakthrough/cultivate/market/chat/sect).
 *   - {@link getProgress} return state cho 1 achievement.
 *   - {@link listAll} return all rows + def metadata (defensive skip nếu
 *     catalog rename).
 *   - {@link listCompleted} filter rows đã completed.
 *   - {@link getProgressByGoalKind} list achievement state theo goalKind.
 *   - {@link claimReward} (Phase 11.10.C-1) atomic grant linhThach/tienNgoc
 *     /exp via `CurrencyService.applyTx` (reason='ACHIEVEMENT_REWARD') +
 *     auto-unlock title qua `TitleService.unlockTitleTx`
 *     (`titleForAchievement(achievementKey)`). CAS guard `claimedAt: null`
 *     đảm bảo idempotent (concurrent call chỉ 1 winner).
 *
 * Wire FUTURE (NOT in scope 11.10.C-1):
 *   - Item rewards (`def.reward.items`) — current 32 baseline không có items;
 *     khi catalog cần sẽ extract AchievementModule + add `ItemLedger` reason
 *     `ACHIEVEMENT_REWARD` (Phase 11.10.D, tránh circular dep CharacterModule
 *     ↔ InventoryModule).
 *   - Event listener wire vào combat/dungeon/breakthrough/cultivate/market
 *     /chat/sect cho mỗi `goalKind` để auto-call `incrementProgress` (Phase
 *     11.10.C-2).
 */
@Injectable()
export class AchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly title: TitleService,
  ) {}

  /**
   * Increment progress cho 1 achievement của character.
   *
   * Atomic upsert qua composite UNIQUE `(characterId, achievementKey)`:
   *   - Row chưa tồn tại → create mới với `progress = min(amount, goalAmount)`,
   *     set `completedAt = now()` nếu đạt goal.
   *   - Row đã tồn tại + chưa complete → tăng progress (cap `goalAmount`),
   *     set `completedAt = now()` nếu đạt goal.
   *   - Row đã complete → idempotent no-op (KHÔNG tăng progress, giữ
   *     `completedAt` ban đầu).
   *
   * `amount` phải là số nguyên dương (>= 1). `amount = 0` hoặc âm throw
   * INVALID_AMOUNT.
   *
   * @throws AchievementError('ACHIEVEMENT_NOT_FOUND') nếu key không có catalog.
   * @throws AchievementError('CHARACTER_NOT_FOUND') nếu character không tồn tại.
   * @throws AchievementError('INVALID_AMOUNT') nếu amount <= 0.
   */
  async incrementProgress(
    characterId: string,
    achievementKey: string,
    amount = 1,
  ): Promise<{
    achievementKey: string;
    progress: number;
    completedAt: Date | null;
    justCompleted: boolean;
  }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new AchievementError('INVALID_AMOUNT');
    }
    const def = getAchievementDef(achievementKey);
    if (!def) throw new AchievementError('ACHIEVEMENT_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { id: true },
      });
      if (!character) throw new AchievementError('CHARACTER_NOT_FOUND');

      const existing = await tx.characterAchievement.findUnique({
        where: {
          characterId_achievementKey: { characterId, achievementKey },
        },
      });

      if (existing && existing.completedAt !== null) {
        return {
          achievementKey: existing.achievementKey,
          progress: existing.progress,
          completedAt: existing.completedAt,
          justCompleted: false,
        };
      }

      const currentProgress = existing?.progress ?? 0;
      const newProgress = Math.min(currentProgress + amount, def.goalAmount);
      const reachedGoal = newProgress >= def.goalAmount;
      const completedAt = reachedGoal ? new Date() : null;

      const upserted = await tx.characterAchievement.upsert({
        where: {
          characterId_achievementKey: { characterId, achievementKey },
        },
        create: {
          characterId,
          achievementKey,
          progress: newProgress,
          completedAt,
        },
        update: {
          progress: newProgress,
          completedAt,
        },
      });

      return {
        achievementKey: upserted.achievementKey,
        progress: upserted.progress,
        completedAt: upserted.completedAt,
        justCompleted: reachedGoal,
      };
    });
  }

  /**
   * Bulk increment tất cả achievement cùng `goalKind`. Dùng cho event
   * listener (combat tick KILL_MONSTER, dungeon clear CLEAR_DUNGEON, ...).
   *
   * Lookup qua `achievementsByGoalKind(goalKind)` → mỗi achievement match
   * gọi `incrementProgress`. Skip silently nếu character không tồn tại
   * (event listener không nên throw).
   *
   * Trả về danh sách kết quả mỗi achievement. Empty nếu goalKind không có
   * achievement nào.
   */
  async trackEvent(
    characterId: string,
    goalKind: MissionGoalKind,
    amount = 1,
  ): Promise<
    Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date | null;
      justCompleted: boolean;
    }>
  > {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new AchievementError('INVALID_AMOUNT');
    }
    const matching = achievementsByGoalKind(goalKind);
    const results: Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date | null;
      justCompleted: boolean;
    }> = [];
    for (const def of matching) {
      try {
        const r = await this.incrementProgress(characterId, def.key, amount);
        results.push(r);
      } catch (err) {
        if (
          err instanceof AchievementError &&
          err.code === 'CHARACTER_NOT_FOUND'
        ) {
          // Bubble lên — caller chịu trách nhiệm validate character trước.
          throw err;
        }
        throw err;
      }
    }
    return results;
  }

  /**
   * Get progress state cho 1 achievement. Trả về null nếu chưa từng track
   * (chưa có row).
   *
   * @throws AchievementError('ACHIEVEMENT_NOT_FOUND') nếu key không có catalog.
   */
  async getProgress(
    characterId: string,
    achievementKey: string,
  ): Promise<{
    achievementKey: string;
    progress: number;
    completedAt: Date | null;
    def: AchievementDef;
  } | null> {
    const def = getAchievementDef(achievementKey);
    if (!def) throw new AchievementError('ACHIEVEMENT_NOT_FOUND');

    const row = await this.prisma.characterAchievement.findUnique({
      where: {
        characterId_achievementKey: { characterId, achievementKey },
      },
    });
    if (!row) return null;
    return {
      achievementKey: row.achievementKey,
      progress: row.progress,
      completedAt: row.completedAt,
      def,
    };
  }

  /**
   * List ALL achievement rows của character + def metadata. Defensive skip
   * nếu catalog rename (achievementKey không còn trong catalog).
   *
   * Sort `createdAt asc` (thứ tự track lần đầu).
   */
  async listAll(
    characterId: string,
  ): Promise<
    Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date | null;
      def: AchievementDef;
    }>
  > {
    const rows = await this.prisma.characterAchievement.findMany({
      where: { characterId },
      orderBy: { createdAt: 'asc' },
    });
    const out: Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date | null;
      def: AchievementDef;
    }> = [];
    for (const row of rows) {
      const def = getAchievementDef(row.achievementKey);
      if (!def) continue;
      out.push({
        achievementKey: row.achievementKey,
        progress: row.progress,
        completedAt: row.completedAt,
        def,
      });
    }
    return out;
  }

  /**
   * List achievement đã complete (`completedAt != null`). Sort `completedAt
   * asc` (thứ tự đạt được).
   */
  async listCompleted(
    characterId: string,
  ): Promise<
    Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date;
      def: AchievementDef;
    }>
  > {
    const rows = await this.prisma.characterAchievement.findMany({
      where: { characterId, completedAt: { not: null } },
      orderBy: { completedAt: 'asc' },
    });
    const out: Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date;
      def: AchievementDef;
    }> = [];
    for (const row of rows) {
      const def = getAchievementDef(row.achievementKey);
      if (!def || row.completedAt === null) continue;
      out.push({
        achievementKey: row.achievementKey,
        progress: row.progress,
        completedAt: row.completedAt,
        def,
      });
    }
    return out;
  }

  /**
   * List achievement state theo `goalKind`. Trả về 1 entry cho mỗi
   * achievement match (ngay cả khi character chưa track — `progress = 0`,
   * `completedAt = null`).
   *
   * Dùng cho UI achievement screen filter theo category/goalKind, hoặc
   * audit "còn bao nhiêu achievement chưa hoàn thành".
   */
  /**
   * Claim reward của 1 achievement đã complete. Atomic + idempotent.
   *
   * Pre-conditions:
   *   - Achievement def tồn tại (`getAchievementDef`).
   *   - Character tồn tại.
   *   - Row `CharacterAchievement` tồn tại (đã từng track progress).
   *   - `completedAt != null` (đã đạt goal).
   *   - `claimedAt == null` (chưa từng claim).
   *
   * Atomic flow (`prisma.$transaction`):
   *   1. Validate tiền điều kiện.
   *   2. CAS update `where { id, claimedAt: null }` → `data { claimedAt: now }`.
   *      Nếu `count !== 1` thì throw ALREADY_CLAIMED (race-safe).
   *   3. Grant `linhThach` qua `CurrencyService.applyTx` reason `ACHIEVEMENT_REWARD`.
   *   4. Grant `tienNgoc` qua `CurrencyService.applyTx` reason `ACHIEVEMENT_REWARD`.
   *   5. Grant `exp` qua `tx.character.update({ exp: increment })`.
   *   6. Nếu `def.rewardTitleKey` set + `titleForAchievement` match →
   *      `TitleService.unlockTitleTx(source='achievement')` idempotent.
   *   7. Nếu `def.reward.items` non-empty → throw `ITEMS_NOT_SUPPORTED`
   *      (defensive guard — current 32 baseline catalog không có items;
   *      Phase 11.10.D sẽ add khi extract AchievementModule).
   *
   * @throws AchievementError('ACHIEVEMENT_NOT_FOUND') key không trong catalog.
   * @throws AchievementError('CHARACTER_NOT_FOUND') character không tồn tại.
   * @throws AchievementError('NOT_FOUND_PROGRESS') chưa từng track row.
   * @throws AchievementError('NOT_COMPLETED') row.completedAt đang null.
   * @throws AchievementError('ALREADY_CLAIMED') row.claimedAt đã set.
   * @throws AchievementError('ITEMS_NOT_SUPPORTED') def.reward.items non-empty
   *   (defer Phase 11.10.D — current catalog không đụng).
   */
  async claimReward(
    characterId: string,
    achievementKey: string,
  ): Promise<{
    achievementKey: string;
    claimedAt: Date;
    granted: {
      linhThach: number;
      tienNgoc: number;
      exp: number;
      titleKey: string | null;
    };
  }> {
    const def = getAchievementDef(achievementKey);
    if (!def) throw new AchievementError('ACHIEVEMENT_NOT_FOUND');

    if (def.reward.items && def.reward.items.length > 0) {
      throw new AchievementError('ITEMS_NOT_SUPPORTED');
    }

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { id: true },
      });
      if (!character) throw new AchievementError('CHARACTER_NOT_FOUND');

      const row = await tx.characterAchievement.findUnique({
        where: {
          characterId_achievementKey: { characterId, achievementKey },
        },
      });
      if (!row) throw new AchievementError('NOT_FOUND_PROGRESS');
      if (row.completedAt === null) {
        throw new AchievementError('NOT_COMPLETED');
      }
      if (row.claimedAt !== null) {
        throw new AchievementError('ALREADY_CLAIMED');
      }

      // CAS race guard: chỉ set claimedAt nếu vẫn null.
      const claimedAt = new Date();
      const upd = await tx.characterAchievement.updateMany({
        where: { id: row.id, claimedAt: null },
        data: { claimedAt },
      });
      if (upd.count !== 1) {
        throw new AchievementError('ALREADY_CLAIMED');
      }

      const linhThach = def.reward.linhThach ?? 0;
      const tienNgoc = def.reward.tienNgoc ?? 0;
      const exp = def.reward.exp ?? 0;

      if (linhThach > 0) {
        await this.currency.applyTx(tx, {
          characterId,
          currency: CurrencyKind.LINH_THACH,
          delta: BigInt(linhThach),
          reason: 'ACHIEVEMENT_REWARD',
          refType: 'Achievement',
          refId: achievementKey,
        });
      }
      if (tienNgoc > 0) {
        await this.currency.applyTx(tx, {
          characterId,
          currency: CurrencyKind.TIEN_NGOC,
          delta: BigInt(tienNgoc),
          reason: 'ACHIEVEMENT_REWARD',
          refType: 'Achievement',
          refId: achievementKey,
        });
      }
      if (exp > 0) {
        await tx.character.update({
          where: { id: characterId },
          data: { exp: { increment: BigInt(exp) } },
        });
      }

      let unlockedTitleKey: string | null = null;
      if (def.rewardTitleKey) {
        const titleDef = titleForAchievement(achievementKey);
        if (titleDef && titleDef.key === def.rewardTitleKey) {
          await this.title.unlockTitleTx(
            tx,
            characterId,
            titleDef.key,
            'achievement',
          );
          unlockedTitleKey = titleDef.key;
        }
      }

      return {
        achievementKey,
        claimedAt,
        granted: {
          linhThach,
          tienNgoc,
          exp,
          titleKey: unlockedTitleKey,
        },
      };
    });
  }

  async getProgressByGoalKind(
    characterId: string,
    goalKind: MissionGoalKind,
  ): Promise<
    Array<{
      achievementKey: string;
      progress: number;
      completedAt: Date | null;
      def: AchievementDef;
    }>
  > {
    const defs = achievementsByGoalKind(goalKind);
    if (defs.length === 0) return [];
    const rows = await this.prisma.characterAchievement.findMany({
      where: {
        characterId,
        achievementKey: { in: defs.map((d) => d.key) },
      },
    });
    const byKey = new Map(rows.map((r) => [r.achievementKey, r] as const));
    return defs.map((def) => {
      const row = byKey.get(def.key);
      return {
        achievementKey: def.key,
        progress: row?.progress ?? 0,
        completedAt: row?.completedAt ?? null,
        def,
      };
    });
  }
}

export type AchievementErrorCode =
  | 'ACHIEVEMENT_NOT_FOUND'
  | 'CHARACTER_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'NOT_FOUND_PROGRESS'
  | 'NOT_COMPLETED'
  | 'ALREADY_CLAIMED'
  | 'ITEMS_NOT_SUPPORTED';

export class AchievementError extends Error {
  readonly name = 'AchievementError';
  constructor(public readonly code: AchievementErrorCode, message?: string) {
    super(message ?? code);
  }
}

/** Re-export catalog count cho test/audit. */
export const ACHIEVEMENT_CATALOG_COUNT = ACHIEVEMENTS.length;
