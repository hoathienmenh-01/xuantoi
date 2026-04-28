import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { expCostForStage } from '@xuantoi/shared';

/**
 * Smart next-action — gợi ý "Nên làm gì tiếp?" dựa trên trạng thái nhân vật.
 *
 * Mỗi gợi ý có:
 * - `key`: i18n key (FE map sang text VN/EN).
 * - `priority`: 1 (urgent/cao) → 5 (thấp). Sort ASC.
 * - `params`: tham số i18n (count / name / level…).
 * - `route`: link chuyển khi user click (FE router push).
 *
 * Service-level: pure read-only Prisma queries, không side-effect.
 */

export type NextActionKey =
  | 'NO_CHARACTER'
  | 'BREAKTHROUGH_READY'
  | 'MISSION_CLAIMABLE'
  | 'MAIL_UNCLAIMED'
  | 'MAIL_UNREAD'
  | 'BOSS_ACTIVE'
  | 'TOPUP_PENDING'
  | 'CULTIVATE_IDLE';

export interface NextAction {
  key: NextActionKey;
  priority: number;
  params: Record<string, string | number>;
  route: string;
}

@Injectable()
export class NextActionService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<NextAction[]> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        realmKey: true,
        realmStage: true,
        exp: true,
        cultivating: true,
      },
    });

    if (!character) {
      return [
        {
          key: 'NO_CHARACTER',
          priority: 1,
          params: {},
          route: '/onboarding',
        },
      ];
    }

    const now = new Date();
    const characterId = character.id;

    const [
      missionRows,
      mailUnclaimed,
      mailUnread,
      activeBoss,
      pendingTopup,
    ] = await Promise.all([
      // Prisma không so sánh 2 cột trong `where`; mỗi character có ≤ ~10 row,
      // fetch all rồi filter trong code rẻ hơn raw SQL.
      this.prisma.missionProgress.findMany({
        where: { characterId, claimed: false },
        select: { currentAmount: true, goalAmount: true },
      }),
      this.prisma.mail.count({
        where: {
          recipientId: characterId,
          claimedAt: null,
          OR: [
            { rewardLinhThach: { gt: 0n } },
            { rewardTienNgoc: { gt: 0 } },
            { rewardExp: { gt: 0n } },
          ],
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          ],
        },
      }),
      this.prisma.mail.count({
        where: {
          recipientId: characterId,
          readAt: null,
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          ],
        },
      }),
      this.prisma.worldBoss.findFirst({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now },
        },
        select: { name: true, level: true },
        orderBy: { spawnedAt: 'desc' },
      }),
      this.prisma.topupOrder.findFirst({
        where: {
          userId,
          status: 'PENDING',
        },
        select: { transferCode: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const actions: NextAction[] = [];

    // Breakthrough ready: realmStage === 9 (peak) + exp đã đạt expNext.
    const expNext = expCostForStage(character.realmKey, character.realmStage);
    if (character.realmStage === 9 && expNext !== null && character.exp >= expNext) {
      actions.push({
        key: 'BREAKTHROUGH_READY',
        priority: 1,
        params: {},
        route: '/',
      });
    }

    const missionClaimable = missionRows.filter(
      (m) => m.currentAmount >= m.goalAmount,
    ).length;
    if (missionClaimable > 0) {
      actions.push({
        key: 'MISSION_CLAIMABLE',
        priority: 1,
        params: { count: missionClaimable },
        route: '/missions',
      });
    }

    if (mailUnclaimed > 0) {
      actions.push({
        key: 'MAIL_UNCLAIMED',
        priority: 2,
        params: { count: mailUnclaimed },
        route: '/mail',
      });
    } else if (mailUnread > 0) {
      // Chỉ gợi ý "đọc" nếu không có thư có thưởng chờ nhận (tránh spam 2 hint cùng lúc).
      actions.push({
        key: 'MAIL_UNREAD',
        priority: 3,
        params: { count: mailUnread },
        route: '/mail',
      });
    }

    if (activeBoss) {
      actions.push({
        key: 'BOSS_ACTIVE',
        priority: 3,
        params: { name: activeBoss.name, level: activeBoss.level },
        route: '/boss',
      });
    }

    if (pendingTopup) {
      actions.push({
        key: 'TOPUP_PENDING',
        priority: 4,
        params: { code: pendingTopup.transferCode },
        route: '/settings',
      });
    }

    if (!character.cultivating && actions.length === 0) {
      // Empty fallback — nếu không có gì cấp thiết, gợi ý nhập định.
      actions.push({
        key: 'CULTIVATE_IDLE',
        priority: 5,
        params: {},
        route: '/',
      });
    }

    actions.sort((a, b) => a.priority - b.priority);
    return actions;
  }
}
