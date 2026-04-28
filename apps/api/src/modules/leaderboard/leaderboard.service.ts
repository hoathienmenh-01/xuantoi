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

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async topByPower(limit = DEFAULT_LIMIT): Promise<LeaderboardRow[]> {
    const safe = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIMIT), MAX_LIMIT);
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
}
