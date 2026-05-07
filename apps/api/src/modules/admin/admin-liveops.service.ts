import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LIVE_OPS_DEFAULT_TZ,
  LIVE_OPS_EVENTS,
  WORLD_BOSS_REGION_KEY,
  activeLiveOpsEvents,
  bossByKey,
  bossesByRegion,
  getLiveOpsEventDef,
  liveOpsEventsForToday,
  type BossDef,
  type LiveOpsEventDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { BossError, BossService } from '../boss/boss.service';

/**
 * Phase 13.1.B — Admin LiveOps Controls service.
 *
 * Mục tiêu PR (intentional minimal — KHÔNG full CMS):
 *   - GET status: list catalog + override hiện tại + computed today/active.
 *   - POST toggle: upsert `LiveOpsEventOverride` với `enabled` + optional
 *     window. Mọi mutation log vào `AdminAuditLedger` reason
 *     `ADMIN_LIVEOPS_OVERRIDE`.
 *   - GET sect-war/status: snapshot leaderboard + cumulative weeks count
 *     (read-only audit).
 *   - POST sect-war/recalculate: lazy / no-op trong PR này (catalog-driven
 *     Sect War KHÔNG cần recalc — placeholder cho Phase 13.2 cross-sect).
 *
 * Audit:
 *   - Mọi POST endpoint đều ghi `AdminAuditLedger` qua
 *     `AdminAuditLedgerService.write` (mirror existing admin pattern).
 *   - Catalog read-only (KHÔNG mutate `LIVE_OPS_EVENTS`); `enabled`
 *     hiệu dụng = catalog AND override (override.enabled = false ⇒ disable;
 *     override absent ⇒ catalog default; override.enabled = true với
 *     `startsAt`/`endsAt` ⇒ window override).
 */

export type AdminLiveOpsErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_REGION_KEY'
  | 'INVALID_BOSS_KEY'
  | 'BOSS_ALREADY_ACTIVE';

export class AdminLiveOpsError extends Error {
  readonly code: AdminLiveOpsErrorCode;
  constructor(code: AdminLiveOpsErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AdminLiveOpsError';
    this.code = code;
  }
}

export interface LiveOpsOverrideView {
  key: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface LiveOpsEventStatusView {
  key: string;
  type: LiveOpsEventDef['type'];
  catalogEnabled: boolean;
  /** Effective enabled = catalog `enabled` AND (override absent OR override.enabled). */
  effectiveEnabled: boolean;
  override: LiveOpsOverrideView | null;
  titleI18nKey: string;
  descriptionI18nKey: string;
  dailyTime?: string;
  durationMinutes?: number;
  daysOfWeek?: ReadonlyArray<number>;
  regionKey?: string;
  bossKey?: string;
  startTime?: string;
  endTime?: string;
}

export interface LiveOpsStatusView {
  /** Catalog version + tz cho FE display. */
  tz: string;
  events: ReadonlyArray<LiveOpsEventStatusView>;
  /** Computed today (effective). */
  todayKeys: ReadonlyArray<string>;
  activeKeys: ReadonlyArray<string>;
}

export interface LiveOpsOverrideToggleInput {
  key: string;
  enabled: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  reason?: string | null;
}

export interface SectWarStatusView {
  weekKey: string;
  totalSects: number;
  totalContributors: number;
  totalContributions: number;
  topSects: ReadonlyArray<{
    sectId: string;
    sectName: string;
    points: number;
    contributors: number;
  }>;
}

/**
 * Phase 13.1.B advanced — admin force-spawn boss input. Region scope optional
 * (default `world` mirror `BossService.adminSpawn` semantics); `bossKey`
 * optional (default = catalog rotation cho region đó). `force=true` bypass
 * `BOSS_ALREADY_ACTIVE` (expire current ACTIVE region đó + spawn replacement).
 */
export interface ForceBossSchedInput {
  regionKey?: string | null;
  bossKey?: string | null;
  level?: number | null;
  force?: boolean | null;
  reason?: string | null;
}

export interface ForceBossSchedResult {
  id: string;
  bossKey: string;
  level: number;
  maxHp: string;
  regionKey: string;
  triggeredAt: string;
}

@Injectable()
export class AdminLiveOpsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BossService))
    private readonly boss: BossService,
  ) {}

  /** Audit helper — mirror `AdminService.audit` private pattern. */
  private async writeAudit(
    actorUserId: string,
    action: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { actorUserId, action, meta: meta as Prisma.InputJsonValue },
    });
  }

  /**
   * GET /admin/liveops — list catalog + DB overrides + computed today/active.
   */
  async getStatus(now: Date = new Date()): Promise<LiveOpsStatusView> {
    const overrides = await this.prisma.liveOpsEventOverride.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    const overridesByKey = new Map(overrides.map((o) => [o.key, o]));

    const events: LiveOpsEventStatusView[] = LIVE_OPS_EVENTS.map((def) => {
      const ovr = overridesByKey.get(def.key);
      const overrideView: LiveOpsOverrideView | null = ovr
        ? {
            key: ovr.key,
            enabled: ovr.enabled,
            startsAt: ovr.startsAt ? ovr.startsAt.toISOString() : null,
            endsAt: ovr.endsAt ? ovr.endsAt.toISOString() : null,
            reason: ovr.reason ?? null,
            updatedBy: ovr.updatedBy,
            updatedAt: ovr.updatedAt.toISOString(),
            createdAt: ovr.createdAt.toISOString(),
          }
        : null;
      const effectiveEnabled = def.enabled && (!ovr || ovr.enabled);
      return {
        key: def.key,
        type: def.type,
        catalogEnabled: def.enabled,
        effectiveEnabled,
        override: overrideView,
        titleI18nKey: def.titleI18nKey,
        descriptionI18nKey: def.descriptionI18nKey,
        dailyTime: def.dailyTime,
        durationMinutes: def.durationMinutes,
        daysOfWeek: def.daysOfWeek,
        regionKey: def.regionKey,
        bossKey: def.bossKey,
        startTime: def.startTime,
        endTime: def.endTime,
      };
    });

    // Computed today/active dựa trên catalog (effective enabled overlay).
    const tz = LIVE_OPS_DEFAULT_TZ;
    const todayDefs = liveOpsEventsForToday(now, tz);
    const activeDefs = activeLiveOpsEvents(now, tz);
    const todayKeys = todayDefs
      .filter((e) => events.find((v) => v.key === e.key)?.effectiveEnabled)
      .map((e) => e.key);
    const activeKeys = activeDefs
      .filter((e) => events.find((v) => v.key === e.key)?.effectiveEnabled)
      .map((e) => e.key);

    return { tz, events, todayKeys, activeKeys };
  }

  /**
   * POST /admin/liveops/event/toggle — upsert override + audit log.
   * `enabled=true` + no window ⇒ remove override (revert to catalog default).
   */
  async toggleEvent(
    actorUserId: string,
    input: LiveOpsOverrideToggleInput,
  ): Promise<LiveOpsOverrideView> {
    const def = getLiveOpsEventDef(input.key);
    if (!def) throw new AdminLiveOpsError('EVENT_NOT_FOUND');

    const startsAt = input.startsAt ?? null;
    const endsAt = input.endsAt ?? null;
    if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
      throw new AdminLiveOpsError('INVALID_INPUT', 'startsAt must be <= endsAt');
    }

    const reason = input.reason ?? null;

    const result = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.liveOpsEventOverride.upsert({
        where: { key: input.key },
        create: {
          key: input.key,
          enabled: input.enabled,
          startsAt,
          endsAt,
          reason,
          updatedBy: actorUserId,
        },
        update: {
          enabled: input.enabled,
          startsAt,
          endsAt,
          reason,
          updatedBy: actorUserId,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId,
          action: 'ADMIN_LIVEOPS_OVERRIDE',
          meta: {
            targetType: 'LiveOpsEvent',
            targetId: input.key,
            enabled: input.enabled,
            startsAt: startsAt ? startsAt.toISOString() : null,
            endsAt: endsAt ? endsAt.toISOString() : null,
            reason,
            catalogEnabled: def.enabled,
          } as Prisma.InputJsonValue,
        },
      });
      return upserted;
    });

    return {
      key: result.key,
      enabled: result.enabled,
      startsAt: result.startsAt ? result.startsAt.toISOString() : null,
      endsAt: result.endsAt ? result.endsAt.toISOString() : null,
      reason: result.reason ?? null,
      updatedBy: result.updatedBy,
      updatedAt: result.updatedAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    };
  }

  /**
   * GET /admin/sect-war/status — read-only snapshot weekly leaderboard +
   * cumulative weeks count. KHÔNG mutate.
   */
  async getSectWarStatus(weekKey: string): Promise<SectWarStatusView> {
    const grouped = await this.prisma.sectWarContribution.groupBy({
      by: ['sectId'],
      where: { weekKey },
      _sum: { points: true },
      _count: { _all: true },
    });
    const totalContribRows = grouped.reduce(
      (acc, g) => acc + (g._count._all ?? 0),
      0,
    );
    const sectIds = grouped.map((g) => g.sectId);
    const sects =
      sectIds.length > 0
        ? await this.prisma.sect.findMany({
            where: { id: { in: sectIds } },
            select: { id: true, name: true },
          })
        : [];
    const sectNameById = new Map(sects.map((s) => [s.id, s.name]));
    const distinctContribs = sectIds.length > 0
      ? await this.prisma.sectWarContribution.findMany({
          where: { weekKey, sectId: { in: sectIds } },
          select: { sectId: true, characterId: true },
          distinct: ['sectId', 'characterId'],
        })
      : [];
    const contribMap = new Map<string, Set<string>>();
    for (const r of distinctContribs) {
      let s = contribMap.get(r.sectId);
      if (!s) {
        s = new Set<string>();
        contribMap.set(r.sectId, s);
      }
      s.add(r.characterId);
    }
    const topSects = grouped
      .map((g) => ({
        sectId: g.sectId,
        sectName: sectNameById.get(g.sectId) ?? '',
        points: g._sum.points ?? 0,
        contributors: contribMap.get(g.sectId)?.size ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.sectId.localeCompare(b.sectId))
      .slice(0, 10);

    const totalContributors = Array.from(contribMap.values()).reduce(
      (acc, s) => acc + s.size,
      0,
    );

    return {
      weekKey,
      totalSects: grouped.length,
      totalContributors,
      totalContributions: totalContribRows,
      topSects,
    };
  }

  /**
   * POST /admin/sect-war/recalculate — placeholder cho Phase 13.2 cross-sect
   * recompute. PR 13.1.B: log audit + no-op (sect war catalog-driven, không
   * cần recalc internal state). Trả về `noop=true` cho FE confirm.
   */
  async recalculateSectWar(
    actorUserId: string,
    weekKey: string,
    reason?: string,
  ): Promise<{ noop: true; weekKey: string }> {
    await this.writeAudit(actorUserId, 'ADMIN_SECT_WAR_RECALCULATE', {
      targetType: 'SectWarWeek',
      targetId: weekKey,
      reason: reason ?? null,
      noop: true,
    });
    return { noop: true, weekKey };
  }

  /**
   * Phase 13.1.B advanced — admin force-spawn boss theo region/schedule.
   *
   * Delegate spawn logic vào `BossService.adminSpawn` (race-safe partial
   * unique flow) rồi ghi thêm audit `ADMIN_FORCE_BOSS_SCHEDULE` riêng để
   * tách traceability liveops khỏi audit `BOSS_SPAWN` mặc định
   * (`BossService.adminSpawn` vẫn tự ghi `BOSS_SPAWN`). Hai audit row =
   * 1 hành động: `ADMIN_FORCE_BOSS_SCHEDULE` ghi nhận intent liveops + reason
   * + linked `bossId` để dashboard admin trace tuyến vận hành.
   *
   * Validation:
   *   - `regionKey` (nếu truyền) phải là region có catalog boss spawn-able
   *     (`bossesByRegion(regionKey).length > 0`); empty region → INVALID_REGION_KEY.
   *   - `bossKey` (nếu truyền) phải tồn tại trong catalog; def.regionKey
   *     mismatch với `regionKey` truyền in → INVALID_BOSS_KEY.
   *   - Nếu cả `regionKey` lẫn `bossKey` đều null → default `world` region
   *     auto-rotation (mirror `BossService.adminSpawn` semantics).
   *   - `level` (nếu truyền) ∈ [1, 10]; ngoài range → INVALID_INPUT.
   *
   * Idempotency:
   *   - Nếu region đã có ACTIVE và `force=false` → throw `BOSS_ALREADY_ACTIVE`,
   *     KHÔNG ghi audit (boss admin yêu cầu chưa được tạo).
   *   - `force=true` → expire ACTIVE region đó + spawn replacement;
   *     `replacedBossId` ghi vào meta audit nếu flip thành công.
   */
  async forceBossSchedule(
    actorUserId: string,
    input: ForceBossSchedInput,
  ): Promise<ForceBossSchedResult> {
    const regionKey = input.regionKey ?? null;
    const bossKey = input.bossKey ?? null;
    const level = input.level ?? null;
    const force = !!input.force;
    const reason = input.reason ?? null;

    // Validation tier 1 — level range (giữ song song với `BossService.adminSpawn`
    // INVALID_LEVEL nhưng surface qua `AdminLiveOpsError.INVALID_INPUT` để FE
    // toast nhất quán với toggle/recalc errors).
    if (level !== null) {
      if (!Number.isInteger(level) || level < 1 || level > 10) {
        throw new AdminLiveOpsError('INVALID_INPUT', 'level must be integer in [1, 10]');
      }
    }

    // Validation tier 2 — regionKey existence trong catalog.
    let resolvedRegion: string;
    if (regionKey) {
      if (regionKey !== WORLD_BOSS_REGION_KEY) {
        const regionBosses = bossesByRegion(regionKey);
        if (regionBosses.length === 0) {
          throw new AdminLiveOpsError('INVALID_REGION_KEY');
        }
      }
      resolvedRegion = regionKey;
    } else {
      resolvedRegion = WORLD_BOSS_REGION_KEY;
    }

    // Validation tier 3 — bossKey existence trong catalog + region match.
    let def: BossDef | undefined;
    if (bossKey) {
      def = bossByKey(bossKey);
      if (!def) {
        throw new AdminLiveOpsError('INVALID_BOSS_KEY');
      }
      const defRegion = def.regionKey ?? WORLD_BOSS_REGION_KEY;
      if (regionKey && defRegion !== regionKey) {
        throw new AdminLiveOpsError('INVALID_BOSS_KEY', 'boss region mismatch');
      }
      // Nếu user không truyền regionKey → derive từ def.
      if (!regionKey) {
        resolvedRegion = defRegion;
      }
    }

    // Delegate spawn vào `BossService.adminSpawn`. Surface BossError →
    // AdminLiveOpsError tương ứng để FE consistent error mapping.
    let spawned;
    try {
      spawned = await this.boss.adminSpawn(actorUserId, {
        bossKey: bossKey ?? undefined,
        level: level ?? undefined,
        force,
        regionKey: resolvedRegion,
      });
    } catch (e) {
      if (e instanceof BossError) {
        switch (e.code) {
          case 'INVALID_BOSS_KEY':
            throw new AdminLiveOpsError('INVALID_BOSS_KEY');
          case 'INVALID_LEVEL':
            throw new AdminLiveOpsError('INVALID_INPUT', 'INVALID_LEVEL');
          case 'BOSS_ALREADY_ACTIVE':
            throw new AdminLiveOpsError('BOSS_ALREADY_ACTIVE');
        }
      }
      throw e;
    }

    const triggeredAt = new Date().toISOString();
    await this.writeAudit(actorUserId, 'ADMIN_FORCE_BOSS_SCHEDULE', {
      targetType: 'WorldBoss',
      targetId: spawned.id,
      bossId: spawned.id,
      bossKey: spawned.bossKey,
      regionKey: spawned.regionKey,
      level: spawned.level,
      forced: force,
      reason,
      triggeredAt,
    });

    return {
      id: spawned.id,
      bossKey: spawned.bossKey,
      level: spawned.level,
      maxHp: spawned.maxHp.toString(),
      regionKey: spawned.regionKey,
      triggeredAt,
    };
  }

  /**
   * Phase 13.1.B advanced — audit hành động admin xem `getSectWarStatus`.
   * Tách khỏi `getSectWarStatus` để giữ method đó pure (read-only, KHÔNG
   * side-effect) — controller gọi `auditSectWarStatusRead` SAU khi GET success
   * cho cả 2 endpoint `/admin/sect-war/status` (sect-war read) + tương lai có
   * thể reuse cho cron snapshot. Audit row có `weekKey` + actor để admin
   * dashboard trace ai đã pull leaderboard tuần nào.
   */
  async auditSectWarStatusRead(
    actorUserId: string,
    weekKey: string,
  ): Promise<void> {
    await this.writeAudit(actorUserId, 'ADMIN_SECT_WAR_STATUS', {
      targetType: 'SectWarWeek',
      targetId: weekKey,
    });
  }

  /** Helper internal — meta cast cho audit.write. */
  static metaToJson(meta: Record<string, unknown>): Prisma.InputJsonValue {
    return meta as Prisma.InputJsonValue;
  }
}
