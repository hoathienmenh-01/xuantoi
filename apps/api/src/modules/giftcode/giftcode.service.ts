import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';

export type GiftCodeErrorCode =
  | 'NO_CHARACTER'
  | 'CODE_NOT_FOUND'
  | 'CODE_EXPIRED'
  | 'CODE_REVOKED'
  | 'CODE_EXHAUSTED'
  | 'ALREADY_REDEEMED'
  | 'INVALID_INPUT';

export class GiftCodeError extends Error {
  constructor(public code: GiftCodeErrorCode) {
    super(code);
    this.name = 'GiftCodeError';
  }
}

export interface GiftCodeRewardItem {
  itemKey: string;
  qty: number;
}

export interface GiftCodeView {
  id: string;
  code: string;
  rewardLinhThach: string;
  rewardTienNgoc: number;
  rewardExp: string;
  rewardItems: GiftCodeRewardItem[];
  maxRedeems: number | null;
  redeemCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface GiftCodeCreateInput {
  code: string;
  rewardLinhThach?: bigint;
  rewardTienNgoc?: number;
  rewardExp?: bigint;
  rewardItems?: GiftCodeRewardItem[];
  maxRedeems?: number | null;
  expiresAt?: Date | null;
  createdByAdminId?: string | null;
}

export interface GiftCodeRedeemResult {
  code: string;
  grantedLinhThach: string;
  grantedTienNgoc: number;
  grantedExp: string;
  grantedItems: GiftCodeRewardItem[];
}

const CODE_REGEX = /^[A-Za-z0-9_-]{4,32}$/;

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function parseItems(raw: unknown): GiftCodeRewardItem[] {
  if (!Array.isArray(raw)) return [];
  const out: GiftCodeRewardItem[] = [];
  for (const r of raw) {
    if (
      r &&
      typeof r === 'object' &&
      typeof (r as { itemKey?: unknown }).itemKey === 'string' &&
      typeof (r as { qty?: unknown }).qty === 'number'
    ) {
      const it = r as { itemKey: string; qty: number };
      if (it.qty > 0) out.push({ itemKey: it.itemKey, qty: it.qty });
    }
  }
  return out;
}

function serializeItems(items: GiftCodeRewardItem[]): Prisma.InputJsonValue {
  return items.map((i) => ({ itemKey: i.itemKey, qty: i.qty }));
}

function toView(row: {
  id: string;
  code: string;
  rewardLinhThach: bigint;
  rewardTienNgoc: number;
  rewardExp: bigint;
  rewardItems: Prisma.JsonValue;
  maxRedeems: number | null;
  redeemCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): GiftCodeView {
  return {
    id: row.id,
    code: row.code,
    rewardLinhThach: row.rewardLinhThach.toString(),
    rewardTienNgoc: row.rewardTienNgoc,
    rewardExp: row.rewardExp.toString(),
    rewardItems: parseItems(row.rewardItems),
    maxRedeems: row.maxRedeems,
    redeemCount: row.redeemCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class GiftCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly inventory: InventoryService,
  ) {}

  async create(input: GiftCodeCreateInput): Promise<GiftCodeView> {
    const code = normalize(input.code);
    if (!CODE_REGEX.test(input.code.trim())) {
      throw new GiftCodeError('INVALID_INPUT');
    }
    const linhThach = input.rewardLinhThach ?? 0n;
    const tienNgoc = input.rewardTienNgoc ?? 0;
    const exp = input.rewardExp ?? 0n;
    const items = input.rewardItems ?? [];
    if (linhThach < 0n || tienNgoc < 0 || exp < 0n) {
      throw new GiftCodeError('INVALID_INPUT');
    }
    if (items.length > 10) throw new GiftCodeError('INVALID_INPUT');
    for (const it of items) {
      if (!it.itemKey || it.qty <= 0 || it.qty > 999) {
        throw new GiftCodeError('INVALID_INPUT');
      }
    }
    if (input.maxRedeems != null && input.maxRedeems <= 0) {
      throw new GiftCodeError('INVALID_INPUT');
    }

    const existing = await this.prisma.giftCode.findUnique({ where: { code } });
    if (existing) throw new GiftCodeError('INVALID_INPUT');

    const row = await this.prisma.giftCode.create({
      data: {
        code,
        rewardLinhThach: linhThach,
        rewardTienNgoc: tienNgoc,
        rewardExp: exp,
        rewardItems: serializeItems(items),
        maxRedeems: input.maxRedeems ?? null,
        expiresAt: input.expiresAt ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      },
    });
    return toView(row);
  }

  async list(
    limit = 100,
    filters: { q?: string; status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED' } = {},
  ): Promise<GiftCodeView[]> {
    const ands: Prisma.GiftCodeWhereInput[] = [];
    if (filters.q) {
      ands.push({ code: { contains: filters.q.toUpperCase(), mode: 'insensitive' } });
    }
    if (filters.status === 'REVOKED') {
      ands.push({ revokedAt: { not: null } });
    } else if (filters.status === 'EXPIRED') {
      ands.push({ revokedAt: null, expiresAt: { lt: new Date() } });
    } else if (filters.status === 'EXHAUSTED') {
      // maxRedeems != null AND redeemCount >= maxRedeems
      // Prisma không filter trực tiếp được (compare 2 cột) → fetch rồi filter ở app layer.
      // Vì list giới hạn 500 rows, OK. Phải merge `ands` (gồm `q` filter) vào where
      // để combine `q` + `status=EXHAUSTED` hoạt động đúng.
      ands.push({ revokedAt: null, maxRedeems: { not: null } });
      const rows = await this.prisma.giftCode.findMany({
        where: { AND: ands },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(1, limit), 500),
      });
      return rows.filter((r) => r.maxRedeems !== null && r.redeemCount >= r.maxRedeems).map(toView);
    } else if (filters.status === 'ACTIVE') {
      ands.push({
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      });
    }
    const rows = await this.prisma.giftCode.findMany({
      where: ands.length > 0 ? { AND: ands } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 500),
    });
    // ACTIVE còn loại exhaust (Prisma không filter compare 2 cột → app layer).
    if (filters.status === 'ACTIVE') {
      return rows
        .filter((r) => r.maxRedeems === null || r.redeemCount < r.maxRedeems)
        .map(toView);
    }
    return rows.map(toView);
  }

  async revoke(code: string): Promise<GiftCodeView> {
    const norm = normalize(code);
    const row = await this.prisma.giftCode.findUnique({ where: { code: norm } });
    if (!row) throw new GiftCodeError('CODE_NOT_FOUND');
    if (row.revokedAt) return toView(row);
    const upd = await this.prisma.giftCode.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return toView(upd);
  }

  async redeem(userId: string, rawCode: string): Promise<GiftCodeRedeemResult> {
    if (!rawCode || typeof rawCode !== 'string') {
      throw new GiftCodeError('INVALID_INPUT');
    }
    const code = normalize(rawCode);
    if (code.length === 0 || code.length > 32) {
      throw new GiftCodeError('INVALID_INPUT');
    }

    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new GiftCodeError('NO_CHARACTER');

    const row = await this.prisma.giftCode.findUnique({ where: { code } });
    if (!row) throw new GiftCodeError('CODE_NOT_FOUND');
    if (row.revokedAt) throw new GiftCodeError('CODE_REVOKED');
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw new GiftCodeError('CODE_EXPIRED');
    }

    const alreadyRedeemed = await this.prisma.giftCodeRedemption.findUnique({
      where: { giftCodeId_userId: { giftCodeId: row.id, userId } },
    });
    if (alreadyRedeemed) throw new GiftCodeError('ALREADY_REDEEMED');

    const items = parseItems(row.rewardItems);

    await this.prisma.$transaction(async (tx) => {
      // CAS: chỉ tăng redeemCount khi chưa vượt maxRedeems (nếu set).
      const updCount =
        row.maxRedeems == null
          ? await tx.giftCode.updateMany({
              where: { id: row.id, revokedAt: null },
              data: { redeemCount: { increment: 1 } },
            })
          : await tx.giftCode.updateMany({
              where: {
                id: row.id,
                revokedAt: null,
                redeemCount: { lt: row.maxRedeems },
              },
              data: { redeemCount: { increment: 1 } },
            });
      if (updCount.count === 0) {
        const latest = await tx.giftCode.findUnique({ where: { id: row.id } });
        if (latest?.revokedAt) throw new GiftCodeError('CODE_REVOKED');
        throw new GiftCodeError('CODE_EXHAUSTED');
      }

      // Redemption row — unique index ngăn race 2 request cùng user.
      try {
        await tx.giftCodeRedemption.create({
          data: {
            giftCodeId: row.id,
            userId,
            characterId: char.id,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new GiftCodeError('ALREADY_REDEEMED');
        }
        throw err;
      }

      if (row.rewardLinhThach > 0n) {
        await this.currency.applyTx(tx, {
          characterId: char.id,
          currency: CurrencyKind.LINH_THACH,
          delta: row.rewardLinhThach,
          reason: 'GIFTCODE_REDEEM',
          refType: 'GIFTCODE',
          refId: row.id,
        });
      }
      if (row.rewardTienNgoc > 0) {
        await this.currency.applyTx(tx, {
          characterId: char.id,
          currency: CurrencyKind.TIEN_NGOC,
          delta: BigInt(row.rewardTienNgoc),
          reason: 'GIFTCODE_REDEEM',
          refType: 'GIFTCODE',
          refId: row.id,
        });
      }
      if (row.rewardExp > 0n) {
        await tx.character.update({
          where: { id: char.id },
          data: { exp: { increment: row.rewardExp } },
        });
      }
      if (items.length > 0) {
        await this.inventory.grantTx(tx, char.id, items, {
          reason: 'GIFTCODE_REDEEM',
          refType: 'GiftCode',
          refId: row.id,
          extra: { code: row.code },
        });
      }
    });

    return {
      code: row.code,
      grantedLinhThach: row.rewardLinhThach.toString(),
      grantedTienNgoc: row.rewardTienNgoc,
      grantedExp: row.rewardExp.toString(),
      grantedItems: items,
    };
  }
}
