import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma, Role, TopupStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CharacterService } from '../character/character.service';
import { CurrencyError, CurrencyService } from '../character/currency.service';
import { TopupService, type TopupOrderView } from '../topup/topup.service';
import { RealtimeService } from '../realtime/realtime.service';
import { InventoryService } from '../inventory/inventory.service';
import { auditLedger, auditResultToJson, type AuditResultJson } from './ledger-audit';

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
const MAX_REVOKE_QTY = 999; // chặn admin gõ nhầm lệnh revoke số khổng lồ
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
    private readonly currency: CurrencyService,
    private readonly inventory: InventoryService,
  ) {}

  // ---------- users ----------

  async listUsers(
    q: string | undefined,
    page: number,
    filters: {
      role?: Role;
      banned?: boolean;
      linhThachMin?: bigint;
      linhThachMax?: bigint;
      tienNgocMin?: number;
      tienNgocMax?: number;
      realmKey?: string;
    } = {},
  ): Promise<{
    rows: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const conditions: Prisma.UserWhereInput[] = [];
    if (q) {
      conditions.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { character: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    if (filters.role !== undefined) conditions.push({ role: filters.role });
    if (filters.banned !== undefined) conditions.push({ banned: filters.banned });

    // Smart admin filter: range/realm trên character. User không có character (chưa
    // tạo) sẽ tự động bị loại khỏi kết quả khi bất kỳ filter character nào set.
    const charConditions: Prisma.CharacterWhereInput = {};
    const linhThachFilter: { gte?: bigint; lte?: bigint } = {};
    if (filters.linhThachMin !== undefined) linhThachFilter.gte = filters.linhThachMin;
    if (filters.linhThachMax !== undefined) linhThachFilter.lte = filters.linhThachMax;
    if (linhThachFilter.gte !== undefined || linhThachFilter.lte !== undefined) {
      charConditions.linhThach = linhThachFilter;
    }
    const tienNgocFilter: { gte?: number; lte?: number } = {};
    if (filters.tienNgocMin !== undefined) tienNgocFilter.gte = filters.tienNgocMin;
    if (filters.tienNgocMax !== undefined) tienNgocFilter.lte = filters.tienNgocMax;
    if (tienNgocFilter.gte !== undefined || tienNgocFilter.lte !== undefined) {
      charConditions.tienNgoc = tienNgocFilter;
    }
    if (filters.realmKey) charConditions.realmKey = filters.realmKey;
    if (Object.keys(charConditions).length > 0) {
      conditions.push({ character: { is: charConditions } });
    }

    const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};
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
    if (actorId === targetUserId) throw new AdminError('CANNOT_TARGET_SELF');
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

    // Áp dụng từng đồng tiền qua CurrencyService — mỗi đồng = 1 dòng ledger.
    // Bao trong $transaction để cả 2 cùng pass hoặc cùng rollback (tránh
    // tình huống cộng linh thạch ok nhưng tiên ngọc fail → state nửa vời).
    try {
      await this.prisma.$transaction(async (tx) => {
        if (deltaLinhThach !== 0n) {
          await this.currency.applyTx(tx, {
            characterId: target.id,
            currency: CurrencyKind.LINH_THACH,
            delta: deltaLinhThach,
            reason: 'ADMIN_GRANT',
            refType: 'User',
            refId: targetUserId,
            actorUserId: actorId,
            meta: { reason },
          });
        }
        if (deltaTienNgoc !== 0) {
          await this.currency.applyTx(tx, {
            characterId: target.id,
            currency: CurrencyKind.TIEN_NGOC,
            delta: BigInt(deltaTienNgoc),
            reason: 'ADMIN_GRANT',
            refType: 'User',
            refId: targetUserId,
            actorUserId: actorId,
            meta: { reason },
          });
        }
      });
    } catch (e) {
      if (
        e instanceof CurrencyError &&
        (e.code === 'INSUFFICIENT_FUNDS' || e.code === 'INVALID_INPUT')
      ) {
        throw new AdminError('INVALID_INPUT');
      }
      throw e;
    }

    await this.audit(actorId, 'user.grant', {
      targetUserId,
      deltaLinhThach: deltaLinhThach.toString(),
      deltaTienNgoc,
      reason,
    });

    const state = await this.chars.findByUser(targetUserId);
    if (state) this.realtime.emitToUser(targetUserId, 'state:update', state);
  }

  /**
   * Thu hồi item khỏi túi người chơi — admin tool.
   * Use-case: cấp nhầm, ban cheat, refund item giao dịch lỗi.
   *
   *  - MOD chỉ revoke được PLAYER; ADMIN revoke được MOD/ADMIN.
   *  - Không revoke chính mình (`CANNOT_TARGET_SELF`).
   *  - qty 1..999 — bảo vệ khỏi lệnh nhầm số lớn.
   *  - Không revoke được nếu tổng qty trong túi nhỏ hơn `qty` → `INVALID_INPUT`.
   *  - Ghi `ItemLedger` với `reason=ADMIN_REVOKE` + `actorUserId` + meta reason.
   *  - Ghi audit log `admin.inventory.revoke`.
   */
  async revokeInventory(
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    itemKey: string,
    qty: number,
    reason: string,
  ): Promise<void> {
    if (actorId === targetUserId) throw new AdminError('CANNOT_TARGET_SELF');
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_REVOKE_QTY) {
      throw new AdminError('INVALID_INPUT');
    }
    if (!itemKey || itemKey.length > 80) throw new AdminError('INVALID_INPUT');
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (!targetUser) throw new AdminError('NOT_FOUND');
    if (actorRole !== 'ADMIN' && targetUser.role !== 'PLAYER') {
      throw new AdminError('FORBIDDEN');
    }
    const target = await this.prisma.character.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });
    if (!target) throw new AdminError('NOT_FOUND');

    try {
      await this.inventory.revoke(target.id, itemKey, qty, {
        refType: 'User',
        refId: targetUserId,
        actorUserId: actorId,
        extra: { reason },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ITEM_NOT_FOUND' || code === 'INSUFFICIENT_QTY') {
        throw new AdminError('INVALID_INPUT');
      }
      throw e;
    }

    await this.audit(actorId, 'admin.inventory.revoke', {
      targetUserId,
      itemKey,
      qty,
      reason,
    });

    const state = await this.chars.findByUser(targetUserId);
    if (state) this.realtime.emitToUser(targetUserId, 'state:update', state);
  }

  // ---------- topup ----------

  async listTopups(
    status: TopupStatus | null,
    page: number,
    filters: { fromDate?: Date; toDate?: Date; userEmail?: string } = {},
  ): Promise<{
    rows: (TopupOrderView & { userEmail: string })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const conditions: Prisma.TopupOrderWhereInput[] = [];
    if (status) conditions.push({ status });
    if (filters.fromDate || filters.toDate) {
      const range: Prisma.DateTimeFilter = {};
      if (filters.fromDate) range.gte = filters.fromDate;
      if (filters.toDate) range.lte = filters.toDate;
      conditions.push({ createdAt: range });
    }
    if (filters.userEmail) {
      const matchUsers = await this.prisma.user.findMany({
        where: { email: { contains: filters.userEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      const ids = matchUsers.map((u) => u.id);
      conditions.push({ userId: { in: ids } });
    }
    const where: Prisma.TopupOrderWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};
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
    // Anti-fraud: admin/mod không được tự duyệt đơn của chính mình.
    if (order.userId === actorId) throw new AdminError('CANNOT_TARGET_SELF');

    await this.prisma.$transaction(async (tx) => {
      // Yêu cầu user đã onboard — nếu chưa có character thì không thể credit.
      // Refuse approve để admin không vô tình đánh dấu APPROVED mà không cộng
      // tiền (đơn vẫn ở PENDING, admin có thể chờ user onboard rồi duyệt lại,
      // hoặc reject rồi hoàn tiền ngoài hệ thống).
      const char = await tx.character.findUnique({ where: { userId: order.userId } });
      if (!char) throw new AdminError('NOT_FOUND');

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

      await this.currency.applyTx(tx, {
        characterId: char.id,
        currency: CurrencyKind.TIEN_NGOC,
        delta: BigInt(order.tienNgocAmount),
        reason: 'ADMIN_TOPUP_APPROVE',
        refType: 'TopupOrder',
        refId: order.id,
        actorUserId: actorId,
        meta: { packageKey: order.packageKey, priceVND: order.priceVND },
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
    if (order.userId === actorId) throw new AdminError('CANNOT_TARGET_SELF');
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

  async listAudit(
    page: number,
    filters: { actionPrefix?: string; actorEmail?: string } = {},
  ): Promise<{
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
    const conditions: Prisma.AdminAuditLogWhereInput[] = [];
    if (filters.actionPrefix) {
      conditions.push({ action: { startsWith: filters.actionPrefix } });
    }
    if (filters.actorEmail) {
      const matchUsers = await this.prisma.user.findMany({
        where: { email: { contains: filters.actorEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      const ids = matchUsers.map((u) => u.id);
      conditions.push({ actorUserId: { in: ids } });
    }
    const where: Prisma.AdminAuditLogWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.adminAuditLog.count({ where }),
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

  async stats(): Promise<{
    users: { total: number; banned: number; admins: number };
    characters: {
      total: number;
      cultivating: number;
      bySect: { sectId: string | null; name: string; count: number }[];
    };
    economy: {
      linhThachCirculating: string;
      tienNgocCirculating: string;
      topupPending: number;
      topupApproved: number;
      topupRejected: number;
    };
    activity: {
      last24hLogins: number;
      last7dRegistrations: number;
    };
  }> {
    const now = new Date();
    const d1 = new Date(now.getTime() - 24 * 3600 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [
      usersTotal,
      usersBanned,
      usersAdmin,
      charsTotal,
      charsCultivating,
      bySectRaw,
      sumsRaw,
      topupPending,
      topupApproved,
      topupRejected,
      last24hLogins,
      last7dRegistrations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { banned: true } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.character.count(),
      this.prisma.character.count({ where: { cultivating: true } }),
      this.prisma.character.groupBy({
        by: ['sectId'],
        _count: { _all: true },
      }),
      this.prisma.character.aggregate({
        _sum: { linhThach: true, tienNgoc: true },
      }),
      this.prisma.topupOrder.count({ where: { status: TopupStatus.PENDING } }),
      this.prisma.topupOrder.count({ where: { status: TopupStatus.APPROVED } }),
      this.prisma.topupOrder.count({ where: { status: TopupStatus.REJECTED } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: d1 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    ]);

    const sectIds = bySectRaw
      .map((r) => r.sectId)
      .filter((s): s is string => s != null);
    const sects =
      sectIds.length > 0
        ? await this.prisma.sect.findMany({
            where: { id: { in: sectIds } },
            select: { id: true, name: true },
          })
        : [];
    const sectMap = new Map(sects.map((s) => [s.id, s.name]));
    const bySect = bySectRaw
      .map((r) => ({
        sectId: r.sectId ?? null,
        name: r.sectId ? (sectMap.get(r.sectId) ?? 'unknown') : 'none',
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const linhThachSum = sumsRaw._sum.linhThach ?? 0n;
    const tienNgocSum = sumsRaw._sum.tienNgoc ?? 0;

    return {
      users: { total: usersTotal, banned: usersBanned, admins: usersAdmin },
      characters: { total: charsTotal, cultivating: charsCultivating, bySect },
      economy: {
        linhThachCirculating: linhThachSum.toString(),
        tienNgocCirculating: tienNgocSum.toString(),
        topupPending,
        topupApproved,
        topupRejected,
      },
      activity: {
        last24hLogins,
        last7dRegistrations,
      },
    };
  }

  /**
   * Smart economy alerts cho admin/mod overview.
   *
   * Liệt kê các bất thường economy mà closed-beta cần phát hiện sớm:
   * - characters có currency âm (linhThach/tienNgoc/tienNgocKhoa < 0) — invariant violation.
   * - inventory items có qty < 1 — invariant violation (nên đã bị xoá khi qty=0).
   * - topup orders PENDING quá `staleHours` giờ (mặc định 24h) — admin lười duyệt.
   *
   * Read-only, không gây side-effect, MOD đọc được.
   */
  async getEconomyAlerts(staleHours = 24): Promise<{
    negativeCurrency: {
      characterId: string;
      name: string;
      userEmail: string;
      linhThach: string;
      tienNgoc: number;
      tienNgocKhoa: number;
    }[];
    negativeInventory: {
      inventoryItemId: string;
      characterId: string;
      characterName: string;
      itemKey: string;
      qty: number;
    }[];
    stalePendingTopups: {
      id: string;
      userEmail: string;
      packageKey: string;
      tienNgocAmount: number;
      createdAt: string;
      ageHours: number;
    }[];
    staleHours: number;
    generatedAt: string;
  }> {
    const since = new Date(Date.now() - staleHours * 3600 * 1000);

    const [negChars, negItems, staleTopups] = await Promise.all([
      this.prisma.character.findMany({
        where: {
          OR: [
            { linhThach: { lt: 0n } },
            { tienNgoc: { lt: 0 } },
            { tienNgocKhoa: { lt: 0 } },
          ],
        },
        select: {
          id: true,
          name: true,
          linhThach: true,
          tienNgoc: true,
          tienNgocKhoa: true,
          user: { select: { email: true } },
        },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      this.prisma.inventoryItem.findMany({
        where: { qty: { lt: 1 } },
        select: {
          id: true,
          characterId: true,
          itemKey: true,
          qty: true,
          character: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
        take: 100,
      }),
      this.prisma.topupOrder.findMany({
        where: {
          status: TopupStatus.PENDING,
          createdAt: { lt: since },
        },
        select: {
          id: true,
          packageKey: true,
          tienNgocAmount: true,
          createdAt: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);

    const now = Date.now();
    return {
      negativeCurrency: negChars.map((c) => ({
        characterId: c.id,
        name: c.name,
        userEmail: c.user.email,
        linhThach: c.linhThach.toString(),
        tienNgoc: c.tienNgoc,
        tienNgocKhoa: c.tienNgocKhoa,
      })),
      negativeInventory: negItems.map((i) => ({
        inventoryItemId: i.id,
        characterId: i.characterId,
        characterName: i.character.name,
        itemKey: i.itemKey,
        qty: i.qty,
      })),
      stalePendingTopups: staleTopups.map((t) => ({
        id: t.id,
        userEmail: t.user.email,
        packageKey: t.packageKey,
        tienNgocAmount: t.tienNgocAmount,
        createdAt: t.createdAt.toISOString(),
        ageHours: Math.floor((now - t.createdAt.getTime()) / (3600 * 1000)),
      })),
      staleHours,
      generatedAt: new Date(now).toISOString(),
    };
  }

  /**
   * Smart economy safety: chạy ledger audit on-demand từ admin endpoint.
   *
   * Reuse pure logic `auditLedger()` từ `ledger-audit.ts` (cùng dùng với CLI script
   * `pnpm audit:ledger`). Verify SUM(CurrencyLedger.delta) per character + currency
   * khớp Character.linhThach/tienNgoc; SUM(ItemLedger.qtyDelta) khớp InventoryItem.qty.
   *
   * Read-only — không mutate DB. Discrepancies trả về để FE hiển thị, admin có thể
   * chuyển sang manual investigation flow.
   */
  async runLedgerAudit(): Promise<AuditResultJson> {
    const result = await auditLedger(this.prisma);
    return auditResultToJson(result);
  }

  /**
   * Smart economy report: top whales theo linhThach + tienNgoc + tổng circulation.
   *
   * Mục đích cho closed beta:
   *   - Admin thấy ai đang giàu nhất → xác định reward target / rebalance.
   *   - Tổng circulation = sanity check kinh tế (tăng đột biến = bot/exploit).
   *   - Số character đang cultivate / tổng character giúp đánh giá retention.
   *
   * Read-only, MOD đọc được. Top N = 10 (đủ overview, không quá nhiều rows trên UI).
   * BigInt linhThach serialize thành string để FE format an toàn.
   */
  async getEconomyReport(): Promise<{
    generatedAt: string;
    circulation: {
      linhThachTotal: string;
      tienNgocTotal: number;
      tienNgocKhoaTotal: number;
      characterCount: number;
      cultivatingCount: number;
    };
    topByLinhThach: {
      characterId: string;
      name: string;
      realmKey: string;
      realmStage: number;
      userEmail: string;
      linhThach: string;
    }[];
    topByTienNgoc: {
      characterId: string;
      name: string;
      realmKey: string;
      realmStage: number;
      userEmail: string;
      tienNgoc: number;
    }[];
  }> {
    const TOP_N = 10;

    const [sumsRaw, characterCount, cultivatingCount, topLinhRaw, topTienRaw] =
      await Promise.all([
        this.prisma.character.aggregate({
          _sum: { linhThach: true, tienNgoc: true, tienNgocKhoa: true },
        }),
        this.prisma.character.count(),
        this.prisma.character.count({ where: { cultivating: true } }),
        this.prisma.character.findMany({
          select: {
            id: true,
            name: true,
            realmKey: true,
            realmStage: true,
            linhThach: true,
            user: { select: { email: true } },
          },
          orderBy: { linhThach: 'desc' },
          take: TOP_N,
        }),
        this.prisma.character.findMany({
          select: {
            id: true,
            name: true,
            realmKey: true,
            realmStage: true,
            tienNgoc: true,
            user: { select: { email: true } },
          },
          orderBy: { tienNgoc: 'desc' },
          take: TOP_N,
        }),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      circulation: {
        linhThachTotal: (sumsRaw._sum.linhThach ?? 0n).toString(),
        tienNgocTotal: sumsRaw._sum.tienNgoc ?? 0,
        tienNgocKhoaTotal: sumsRaw._sum.tienNgocKhoa ?? 0,
        characterCount,
        cultivatingCount,
      },
      topByLinhThach: topLinhRaw.map((c) => ({
        characterId: c.id,
        name: c.name,
        realmKey: c.realmKey,
        realmStage: c.realmStage,
        userEmail: c.user.email,
        linhThach: c.linhThach.toString(),
      })),
      topByTienNgoc: topTienRaw.map((c) => ({
        characterId: c.id,
        name: c.name,
        realmKey: c.realmKey,
        realmStage: c.realmStage,
        userEmail: c.user.email,
        tienNgoc: c.tienNgoc,
      })),
    };
  }

  private async audit(actorId: string, action: string, meta: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { actorUserId: actorId, action, meta },
    });
  }
}
