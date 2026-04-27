import { Injectable } from '@nestjs/common';
import { Prisma, Role, TopupStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CharacterService } from '../character/character.service';
import { TopupService, type TopupOrderView } from '../topup/topup.service';
import { RealtimeService } from '../realtime/realtime.service';

export class AdminError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'INVALID_INPUT'
      | 'FORBIDDEN'
      | 'ALREADY_PROCESSED'
      | 'CANNOT_TARGET_SELF',
  ) {
    super(code);
  }
}

const MAX_GRANT_LINH_THACH = 1_000_000_000n; // 1 tỷ
const MAX_GRANT_TIEN_NGOC = 1_000_000;
const PAGE_SIZE = 30;

export interface AdminUserRow {
  id: string;
  email: string;
  role: Role;
  banned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  character: {
    id: string;
    name: string;
    realmKey: string;
    realmStage: number;
    linhThach: string;
    tienNgoc: number;
  } | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chars: CharacterService,
    private readonly topup: TopupService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------- users ----------

  async listUsers(q: string | undefined, page: number): Promise<{
    rows: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { character: { is: { name: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { character: true },
        orderBy: { createdAt: 'desc' },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      rows: rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        banned: u.banned,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        character: u.character
          ? {
              id: u.character.id,
              name: u.character.name,
              realmKey: u.character.realmKey,
              realmStage: u.character.realmStage,
              linhThach: u.character.linhThach.toString(),
              tienNgoc: u.character.tienNgoc,
            }
          : null,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async setBanned(
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    banned: boolean,
  ): Promise<void> {
    if (actorId === targetUserId) throw new AdminError('CANNOT_TARGET_SELF');
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new AdminError('NOT_FOUND');
    // Hierarchy: MOD chỉ thao tác lên PLAYER. Chỉ ADMIN mới ban được MOD/ADMIN.
    if (actorRole !== 'ADMIN' && target.role !== 'PLAYER') {
      throw new AdminError('FORBIDDEN');
    }
    await this.prisma.user.update({ where: { id: targetUserId }, data: { banned } });
    await this.audit(actorId, banned ? 'user.ban' : 'user.unban', { targetUserId });
  }

  async setRole(
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    role: Role,
  ): Promise<void> {
    // Chỉ ADMIN mới được đổi role.
    if (actorRole !== 'ADMIN') throw new AdminError('FORBIDDEN');
    if (actorId === targetUserId) throw new AdminError('CANNOT_TARGET_SELF');
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new AdminError('NOT_FOUND');
    await this.prisma.user.update({ where: { id: targetUserId }, data: { role } });
    await this.audit(actorId, 'user.setRole', { targetUserId, role });
  }

  /**
   * Cộng linh thạch / tiên ngọc (có thể âm để trừ).
   * Linh thạch dùng atomic { increment } trên BigInt (chuyển sang Number không an toàn).
   */
  async grant(
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    deltaLinhThach: bigint,
    deltaTienNgoc: number,
    reason: string,
  ): Promise<void> {
    if (deltaLinhThach === 0n && deltaTienNgoc === 0) throw new AdminError('INVALID_INPUT');
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (!targetUser) throw new AdminError('NOT_FOUND');
    if (actorRole !== 'ADMIN' && targetUser.role !== 'PLAYER') {
      throw new AdminError('FORBIDDEN');
    }
    if (deltaLinhThach > MAX_GRANT_LINH_THACH || deltaLinhThach < -MAX_GRANT_LINH_THACH) {
      throw new AdminError('INVALID_INPUT');
    }
    if (
      deltaTienNgoc > MAX_GRANT_TIEN_NGOC ||
      deltaTienNgoc < -MAX_GRANT_TIEN_NGOC
    ) {
      throw new AdminError('INVALID_INPUT');
    }

    const target = await this.prisma.character.findUnique({
      where: { userId: targetUserId },
      select: { id: true, linhThach: true, tienNgoc: true },
    });
    if (!target) throw new AdminError('NOT_FOUND');

    // Guard không để âm: dùng updateMany với điều kiện gte |delta| khi trừ.
    const upd = await this.prisma.character.updateMany({
      where: {
        id: target.id,
        ...(deltaLinhThach < 0n ? { linhThach: { gte: -deltaLinhThach } } : {}),
        ...(deltaTienNgoc < 0 ? { tienNgoc: { gte: -deltaTienNgoc } } : {}),
      },
      data: {
        linhThach: { increment: deltaLinhThach },
        tienNgoc: { increment: deltaTienNgoc },
      },
    });
    if (upd.count === 0) throw new AdminError('INVALID_INPUT');

    await this.audit(actorId, 'user.grant', {
      targetUserId,
      deltaLinhThach: deltaLinhThach.toString(),
      deltaTienNgoc,
      reason,
    });

    const state = await this.chars.findByUser(targetUserId);
    if (state) this.realtime.emitToUser(targetUserId, 'state:update', state);
  }

  // ---------- topup ----------

  async listTopups(status: TopupStatus | null, page: number): Promise<{
    rows: (TopupOrderView & { userEmail: string })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.TopupOrderWhereInput = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.topupOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.topupOrder.count({ where }),
    ]);
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    const approverIds = rows
      .map((r) => r.approvedById)
      .filter((id): id is string => Boolean(id));
    const approvers = approverIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, email: true },
        })
      : [];
    const approverMap = new Map(approvers.map((u) => [u.id, u.email]));
    return {
      rows: rows.map((r) => ({
        ...this.topup.toView(
          r,
          r.approvedById ? approverMap.get(r.approvedById) ?? null : null,
        ),
        userEmail: userMap.get(r.userId) ?? '???',
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async approveTopup(actorId: string, orderId: string, note: string): Promise<void> {
    const order = await this.prisma.topupOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AdminError('NOT_FOUND');
    if (order.status !== 'PENDING') throw new AdminError('ALREADY_PROCESSED');

    await this.prisma.$transaction(async (tx) => {
      // Flip atomic.
      const flip = await tx.topupOrder.updateMany({
        where: { id: orderId, status: TopupStatus.PENDING },
        data: {
          status: TopupStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date(),
          note,
        },
      });
      if (flip.count === 0) throw new AdminError('ALREADY_PROCESSED');

      // Cộng tiên ngọc cho character (yêu cầu user đã onboard).
      const char = await tx.character.findUnique({ where: { userId: order.userId } });
      if (!char) {
        // Vẫn approve nhưng note thêm — admin có thể cấp lại tay sau.
        return;
      }
      await tx.character.update({
        where: { id: char.id },
        data: { tienNgoc: { increment: order.tienNgocAmount } },
      });
    });

    await this.audit(actorId, 'topup.approve', {
      orderId,
      userId: order.userId,
      tienNgoc: order.tienNgocAmount,
    });

    const state = await this.chars.findByUser(order.userId);
    if (state) this.realtime.emitToUser(order.userId, 'state:update', state);
  }

  async rejectTopup(actorId: string, orderId: string, note: string): Promise<void> {
    const order = await this.prisma.topupOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AdminError('NOT_FOUND');
    if (order.status !== 'PENDING') throw new AdminError('ALREADY_PROCESSED');
    const flip = await this.prisma.topupOrder.updateMany({
      where: { id: orderId, status: TopupStatus.PENDING },
      data: {
        status: TopupStatus.REJECTED,
        approvedById: actorId,
        approvedAt: new Date(),
        note,
      },
    });
    if (flip.count === 0) throw new AdminError('ALREADY_PROCESSED');
    await this.audit(actorId, 'topup.reject', { orderId, note });
  }

  // ---------- audit ----------

  async listAudit(page: number): Promise<{
    rows: {
      id: string;
      actorUserId: string;
      actorEmail: string | null;
      action: string;
      meta: Prisma.JsonValue;
      createdAt: string;
    }[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    const actorIds = Array.from(new Set(rows.map((r) => r.actorUserId)));
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true },
    });
    const actorMap = new Map(actors.map((u) => [u.id, u.email]));
    return {
      rows: rows.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorEmail: actorMap.get(r.actorUserId) ?? null,
        action: r.action,
        meta: r.meta,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  private async audit(actorId: string, action: string, meta: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { actorUserId: actorId, action, meta },
    });
  }
}
