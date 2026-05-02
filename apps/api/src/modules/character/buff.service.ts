import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  composeBuffMods,
  computeBuffExpiresAt,
  getBuffDef,
  type ActiveBuff,
  type BuffMods,
  type BuffSource,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Phase 11.8.B Buff MVP runtime — duration-based buff/debuff persistence.
 *
 * Server-authoritative buff service:
 *   - {@link applyBuff} upsert qua composite unique `(characterId, buffKey)`:
 *     non-stackable refresh `expiresAt`; stackable increment `stacks` cap
 *     `def.maxStacks` + refresh `expiresAt`.
 *   - {@link removeBuff} xóa explicit row (rare — usually expiresAt sweep).
 *   - {@link listActive} auto-prune expired trước khi return.
 *   - {@link pruneExpired} batch xóa toàn DB (cron sweep) hoặc theo character.
 *   - {@link getMods} rely vào `composeBuffMods` từ shared catalog (deterministic
 *     pure function — không runtime dependency).
 *
 * Wire FUTURE (NOT in scope 11.8.B MVP):
 *   - tribulation FAIL Tâm Ma → `applyBuff('debuff_taoma', 'tribulation')`.
 *   - alchemy pill → `applyBuff('buff_pill_*', 'pill')`.
 *   - skill DOT/CC → `applyBuff('debuff_*', 'skill')` trong combat tick.
 *   - `getMods()` wire vào `CharacterStatService.computeStats` để mod
 *     atk/def/hpMax/mpMax/spirit áp dụng combat + cultivation tick.
 */
@Injectable()
export class BuffService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply 1 buff lên character. Idempotent qua composite unique
   * `(characterId, buffKey)`:
   *   - Buff không tồn tại → create row mới với `stacks=1` + `expiresAt = now
   *     + def.durationSec`.
   *   - Buff non-stackable đã tồn tại → refresh `expiresAt` (KHÔNG đụng
   *     `stacks`).
   *   - Buff stackable đã tồn tại → `stacks = min(stacks+1, def.maxStacks)` +
   *     refresh `expiresAt`.
   *
   * @param now timestamp gốc cho expiresAt; default `new Date()`. Inject từ
   *   test để control timeline.
   */
  async applyBuff(
    characterId: string,
    buffKey: string,
    source: BuffSource,
    now: Date = new Date(),
  ): Promise<{
    buffKey: string;
    stacks: number;
    source: BuffSource;
    expiresAt: Date;
  }> {
    return this.prisma.$transaction((tx) =>
      this.applyBuffTx(tx, characterId, buffKey, source, now),
    );
  }

  /**
   * Tx-aware variant của `applyBuff` — dùng từ INSIDE 1 `$transaction` đã
   * có sẵn. Giữ nguyên ngữ nghĩa idempotent + stackable cap.
   *
   * Phase 11.8.D-2 wire — `TribulationService.attemptTribulation()` FAIL path
   * apply `debuff_taoma` cùng tx với character update + `TribulationAttemptLog`
   * write — rollback toàn bộ nếu DB fail.
   *
   * @param expiresAtOverride nếu set, dùng làm `expiresAt` thay vì
   *   `computeBuffExpiresAt(now, def)` từ catalog `durationSec`. Use case:
   *   tribulation FAIL có per-tier `taoMaDebuffDurationMinutes` (15/30/60/120)
   *   override default catalog 60 phút.
   *
   * @throws BuffError('BUFF_NOT_FOUND') nếu buffKey không có trong catalog.
   * @throws BuffError('CHARACTER_NOT_FOUND') nếu character không tồn tại.
   */
  async applyBuffTx(
    tx: Prisma.TransactionClient,
    characterId: string,
    buffKey: string,
    source: BuffSource,
    now: Date = new Date(),
    expiresAtOverride?: Date,
  ): Promise<{
    buffKey: string;
    stacks: number;
    source: BuffSource;
    expiresAt: Date;
  }> {
    const def = getBuffDef(buffKey);
    if (!def) throw new BuffError('BUFF_NOT_FOUND');

    const character = await tx.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!character) throw new BuffError('CHARACTER_NOT_FOUND');

    const expiresAt = expiresAtOverride ?? computeBuffExpiresAt(now, def);

    const existing = await tx.characterBuff.findUnique({
      where: {
        characterId_buffKey: { characterId, buffKey },
      },
    });

    if (!existing) {
      const created = await tx.characterBuff.create({
        data: {
          characterId,
          buffKey,
          stacks: 1,
          source,
          expiresAt,
        },
      });
      return {
        buffKey: created.buffKey,
        stacks: created.stacks,
        source: created.source as BuffSource,
        expiresAt: created.expiresAt,
      };
    }

    // Stackable → increment cap maxStacks. Non-stackable → giữ nguyên stacks.
    const newStacks = def.stackable
      ? Math.min(existing.stacks + 1, def.maxStacks)
      : existing.stacks;

    const updated = await tx.characterBuff.update({
      where: {
        characterId_buffKey: { characterId, buffKey },
      },
      data: {
        stacks: newStacks,
        expiresAt,
        // Source có thể đổi (vd buff stat từ pill rồi từ event refresh) —
        // ghi nhận source mới nhất.
        source,
      },
    });

    return {
      buffKey: updated.buffKey,
      stacks: updated.stacks,
      source: updated.source as BuffSource,
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Xóa buff explicit (vd dispel item, sect leave, equip swap). Idempotent —
   * không error nếu buff không tồn tại.
   */
  async removeBuff(characterId: string, buffKey: string): Promise<boolean> {
    const result = await this.prisma.characterBuff.deleteMany({
      where: { characterId, buffKey },
    });
    return result.count > 0;
  }

  /**
   * List active (non-expired) buffs cho character. Auto-prune expired row
   * trước khi return — caller không cần worry về stale data.
   */
  async listActive(
    characterId: string,
    now: Date = new Date(),
  ): Promise<
    Array<{
      buffKey: string;
      stacks: number;
      source: BuffSource;
      expiresAt: Date;
    }>
  > {
    await this.pruneExpired(characterId, now);
    const rows = await this.prisma.characterBuff.findMany({
      where: { characterId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map((r) => ({
      buffKey: r.buffKey,
      stacks: r.stacks,
      source: r.source as BuffSource,
      expiresAt: r.expiresAt,
    }));
  }

  /**
   * Prune buffs đã expired. Nếu `characterId` undefined → batch toàn DB
   * (cron sweep). Return số row đã xóa.
   */
  async pruneExpired(
    characterId?: string,
    now: Date = new Date(),
  ): Promise<number> {
    const where = characterId
      ? { characterId, expiresAt: { lte: now } }
      : { expiresAt: { lte: now } };
    const result = await this.prisma.characterBuff.deleteMany({ where });
    return result.count;
  }

  /**
   * Compose `BuffMods` cho character (combat/stat hệ wire FUTURE). Deterministic
   * — return từ `composeBuffMods(activeBuffs)` với expired buff đã prune.
   */
  async getMods(
    characterId: string,
    now: Date = new Date(),
  ): Promise<BuffMods> {
    const active = await this.listActive(characterId, now);
    const activeBuffs: ActiveBuff[] = active.map((a) => ({
      buffKey: a.buffKey,
      stacks: a.stacks,
    }));
    return composeBuffMods(activeBuffs);
  }
}

export class BuffError extends Error {
  constructor(public code: 'BUFF_NOT_FOUND' | 'CHARACTER_NOT_FOUND') {
    super(code);
  }
}
