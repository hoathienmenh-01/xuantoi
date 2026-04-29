import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { realmByKey } from '@xuantoi/shared';

/**
 * Smart beta feature §9 — basic leaderboard (tu vi ranking).
 *
 * Sort key (desc):
 *   1. `realmByKey(realmKey).order` — cảnh giới đại ưu tiên (Phàm Nhân < Luyện Khí < ... < Hồng Mông).
 *   2. `realmStage` — trong cùng cảnh giới, trọng cao hơn rank trên.
 *   3. `power` — equal-realm tie-breaker.
 *   4. `level` — final tie-breaker.
 *
 * Loại banned user. Closed-beta scale (< 1000 chars) → fetch all non-banned
 * + sort in JS. Khi scale lên, thay bằng raw SQL với `realmOrder` precomputed.
 */

const HARD_FETCH_CAP = 1000;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/** Map `Sect.name` (DB) sang `sectKey` (FE/shared). Đồng bộ với `character.service.ts`. */
const SECT_NAME_TO_KEY: Record<string, 'thanh_van' | 'huyen_thuy' | 'tu_la'> = {
  'Thanh Vân Môn': 'thanh_van',
  'Huyền Thuỷ Cung': 'huyen_thuy',
  'Tu La Tông': 'tu_la',
};

export interface LeaderboardRow {
  rank: number;
  characterId: string;
  name: string;
  realmKey: string;
  realmStage: number;
  power: number;
  level: number;
  sectKey: string | null;
}

export interface LeaderboardTopupRow {
  rank: number;
  characterId: string;
  name: string;
  realmKey: string;
  realmStage: number;
  totalTienNgoc: number;
  sectKey: string | null;
}

export interface LeaderboardSectRow {
  rank: number;
  sectId: string;
  sectKey: string | null;
  name: string;
  level: number;
  treasuryLinhThach: string;
  memberCount: number;
  leaderName: string | null;
}

function clampLimit(raw: number | undefined): number {
  const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : DEFAULT_LIMIT;
  return Math.min(Math.max(1, n), MAX_LIMIT);
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async topByPower(limit = DEFAULT_LIMIT): Promise<LeaderboardRow[]> {
    const safe = clampLimit(limit);
    const rows = await this.prisma.character.findMany({
      where: { user: { banned: false } },
      select: {
        id: true,
        name: true,
        realmKey: true,
        realmStage: true,
        power: true,
        level: true,
        sect: { select: { name: true } },
      },
      take: HARD_FETCH_CAP,
    });
    const sorted = rows
      .map((r) => ({
        ...r,
        realmOrder: realmByKey(r.realmKey)?.order ?? 0,
      }))
      .sort((a, b) => {
        if (b.realmOrder !== a.realmOrder) return b.realmOrder - a.realmOrder;
        if (b.realmStage !== a.realmStage) return b.realmStage - a.realmStage;
        if (b.power !== a.power) return b.power - a.power;
        return b.level - a.level;
      })
      .slice(0, safe);
    return sorted.map((r, i) => ({
      rank: i + 1,
      characterId: r.id,
      name: r.name,
      realmKey: r.realmKey,
      realmStage: r.realmStage,
      power: r.power,
      level: r.level,
      sectKey: r.sect ? SECT_NAME_TO_KEY[r.sect.name] ?? null : null,
    }));
  }

  /**
   * Smart beta — leaderboard top nạp Tiên Ngọc (only count `APPROVED` orders).
   *
   * Sort: tổng `tienNgocAmount` desc → loại banned user / user chưa tạo character.
   * Closed-beta scale (< 500 user nạp) → groupBy + per-row character lookup OK.
   * Scale up → cache hourly hoặc raw SQL với JOIN.
   */
  async topByTopup(limit = DEFAULT_LIMIT): Promise<LeaderboardTopupRow[]> {
    const safe = clampLimit(limit);
    const groups = await this.prisma.topupOrder.groupBy({
      by: ['userId'],
      where: { status: 'APPROVED' },
      _sum: { tienNgocAmount: true },
      orderBy: { _sum: { tienNgocAmount: 'desc' } },
      take: HARD_FETCH_CAP,
    });
    if (groups.length === 0) return [];
    const userIds = groups.map((g) => g.userId);
    const chars = await this.prisma.character.findMany({
      where: { userId: { in: userIds }, user: { banned: false } },
      select: {
        id: true,
        userId: true,
        name: true,
        realmKey: true,
        realmStage: true,
        sect: { select: { name: true } },
      },
    });
    const charByUser = new Map(chars.map((c) => [c.userId, c]));
    const result: LeaderboardTopupRow[] = [];
    for (const g of groups) {
      const c = charByUser.get(g.userId);
      if (!c) continue;
      const total = g._sum.tienNgocAmount ?? 0;
      if (total <= 0) continue;
      result.push({
        rank: 0, // assigned below after slice
        characterId: c.id,
        name: c.name,
        realmKey: c.realmKey,
        realmStage: c.realmStage,
        totalTienNgoc: total,
        sectKey: c.sect ? SECT_NAME_TO_KEY[c.sect.name] ?? null : null,
      });
      if (result.length >= safe) break;
    }
    return result.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /**
   * Smart beta — leaderboard tông môn theo `treasuryLinhThach` (linh thạch
   * tích luỹ từ donate).
   *
   * Sort: `treasuryLinhThach` desc → `level` desc → `memberCount` desc → `createdAt` asc.
   * Sect số lượng nhỏ (3 seed + tự lập tay) → findMany sort + slice OK.
   */
  async topBySect(limit = DEFAULT_LIMIT): Promise<LeaderboardSectRow[]> {
    const safe = clampLimit(limit);
    const sects = await this.prisma.sect.findMany({
      orderBy: [
        { treasuryLinhThach: 'desc' },
        { level: 'desc' },
        { createdAt: 'asc' },
      ],
      include: { _count: { select: { characters: true } } },
      take: safe,
    });
    if (sects.length === 0) return [];
    const leaderIds = sects
      .map((s) => s.leaderId)
      .filter((x): x is string => !!x);
    const leaders = leaderIds.length
      ? await this.prisma.character.findMany({
          where: { id: { in: leaderIds } },
          select: { id: true, name: true },
        })
      : [];
    const leaderMap = new Map(leaders.map((l) => [l.id, l.name]));
    return sects.map((s, i) => ({
      rank: i + 1,
      sectId: s.id,
      sectKey: SECT_NAME_TO_KEY[s.name] ?? null,
      name: s.name,
      level: s.level,
      treasuryLinhThach: s.treasuryLinhThach.toString(),
      memberCount: s._count.characters,
      leaderName: s.leaderId ? (leaderMap.get(s.leaderId) ?? null) : null,
    }));
  }
}
