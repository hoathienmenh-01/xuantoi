import { Injectable } from '@nestjs/common';
import { Prisma, TopupStatus } from '@prisma/client';
import { topupPackageByKey, TOPUP_BANK_INFO } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

export class TopupError extends Error {
  constructor(
    public code:
      | 'NO_USER'
      | 'INVALID_PACKAGE'
      | 'TOO_MANY_PENDING'
      | 'NOT_FOUND'
      | 'ALREADY_PROCESSED',
  ) {
    super(code);
  }
}

export interface TopupOrderView {
  id: string;
  packageKey: string;
  packageName: string;
  tienNgocAmount: number;
  priceVND: number;
  transferCode: string;
  status: TopupStatus;
  note: string;
  createdAt: string;
  approvedAt: string | null;
  /** Admin-side: tên người duyệt (nếu user gọi /me thì luôn null). */
  approvedByEmail: string | null;
}

const MAX_PENDING_PER_USER = 5;

function genTransferCode(): string {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TOPUP-${rnd}`;
}

@Injectable()
export class TopupService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, packageKey: string): Promise<TopupOrderView> {
    const pkg = topupPackageByKey(packageKey);
    if (!pkg) throw new TopupError('INVALID_PACKAGE');

    const pending = await this.prisma.topupOrder.count({
      where: { userId, status: TopupStatus.PENDING },
    });
    if (pending >= MAX_PENDING_PER_USER) throw new TopupError('TOO_MANY_PENDING');

    // Retry tối đa 3 lần nếu transferCode đụng (xác suất ~ 1/36^6).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const order = await this.prisma.topupOrder.create({
          data: {
            userId,
            packageKey: pkg.key,
            tienNgocAmount: pkg.tienNgoc + pkg.bonus,
            priceVND: pkg.priceVND,
            transferCode: genTransferCode(),
          },
        });
        return this.toView(order, null);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new TopupError('TOO_MANY_PENDING');
  }

  async listForUser(userId: string): Promise<TopupOrderView[]> {
    const rows = await this.prisma.topupOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.toView(r, null));
  }

  bankInfo() {
    return TOPUP_BANK_INFO;
  }

  // ---------- helpers ----------

  toView(
    order: {
      id: string;
      packageKey: string;
      tienNgocAmount: number;
      priceVND: number;
      transferCode: string;
      status: TopupStatus;
      note: string;
      createdAt: Date;
      approvedAt: Date | null;
    },
    approvedByEmail: string | null,
  ): TopupOrderView {
    const pkg = topupPackageByKey(order.packageKey);
    return {
      id: order.id,
      packageKey: order.packageKey,
      packageName: pkg?.name ?? order.packageKey,
      tienNgocAmount: order.tienNgocAmount,
      priceVND: order.priceVND,
      transferCode: order.transferCode,
      status: order.status,
      note: order.note,
      createdAt: order.createdAt.toISOString(),
      approvedAt: order.approvedAt ? order.approvedAt.toISOString() : null,
      approvedByEmail,
    };
  }
}
