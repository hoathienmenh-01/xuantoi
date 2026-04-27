import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/**
 * Các trường currency hợp lệ trên Character. Khi thêm currency mới, **luôn**
 * cập nhật danh sách này — đồng nghĩa với việc các module khác không được tự
 * cộng/trừ currency, mọi thay đổi phải đi qua CurrencyService để tạo ledger.
 */
export const CURRENCY_KEYS = [
  'linhThach',
  'tienNgoc',
  'tienNgocKhoa',
  'tienTe',
  'nguyenThach',
  'congHien',
  'congDuc',
  'chienCongTongMon',
] as const;
export type CurrencyKey = (typeof CURRENCY_KEYS)[number];

const BIGINT_KEYS: ReadonlySet<CurrencyKey> = new Set(['linhThach']);

export interface CurrencyMutation {
  charId: string;
  currencyKey: CurrencyKey;
  /** Lượng cộng (>0) hoặc trừ (<0). */
  amount: bigint;
  reason: string;
  refType?: string;
  refId?: string;
}

export interface CurrencyChangeResult {
  currencyKey: CurrencyKey;
  amount: bigint;
  balanceAfter: bigint;
}

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cộng/trừ currency + ghi `CurrencyLedger`. Atomic trong 1 transaction. */
  async mutate(
    m: CurrencyMutation,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrencyChangeResult> {
    const run = async (client: Prisma.TransactionClient): Promise<CurrencyChangeResult> => {
      const char = await client.character.findUnique({ where: { id: m.charId } });
      if (!char) throw new Error('CHAR_NOT_FOUND');

      const before = readCurrency(char, m.currencyKey);
      const after = before + m.amount;
      if (after < 0n) throw new Error('CURRENCY_UNDERFLOW');

      await client.character.update({
        where: { id: m.charId },
        data: writeCurrency(m.currencyKey, after),
      });
      await client.currencyLedger.create({
        data: {
          charId: m.charId,
          currencyKey: m.currencyKey,
          amount: m.amount,
          balanceAfter: after,
          reason: m.reason,
          refType: m.refType ?? null,
          refId: m.refId ?? null,
        },
      });
      return { currencyKey: m.currencyKey, amount: m.amount, balanceAfter: after };
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((c) => run(c));
  }

  add(
    charId: string,
    currencyKey: CurrencyKey,
    amount: bigint,
    reason: string,
    ref?: { refType?: string; refId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<CurrencyChangeResult> {
    if (amount <= 0n) throw new Error('INVALID_CURRENCY_AMOUNT');
    return this.mutate({ charId, currencyKey, amount, reason, ...ref }, tx);
  }

  subtract(
    charId: string,
    currencyKey: CurrencyKey,
    amount: bigint,
    reason: string,
    ref?: { refType?: string; refId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<CurrencyChangeResult> {
    if (amount <= 0n) throw new Error('INVALID_CURRENCY_AMOUNT');
    return this.mutate({ charId, currencyKey, amount: -amount, reason, ...ref }, tx);
  }

  async getBalance(charId: string, currencyKey: CurrencyKey): Promise<bigint> {
    const char = await this.prisma.character.findUnique({ where: { id: charId } });
    if (!char) throw new Error('CHAR_NOT_FOUND');
    return readCurrency(char, currencyKey);
  }
}

function readCurrency(
  char: Record<string, unknown>,
  key: CurrencyKey,
): bigint {
  const v = char[key];
  if (BIGINT_KEYS.has(key)) {
    return typeof v === 'bigint' ? v : BigInt((v as number | string | null) ?? 0);
  }
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'bigint') return v;
  return 0n;
}

function writeCurrency(key: CurrencyKey, value: bigint): Record<string, bigint | number> {
  if (BIGINT_KEYS.has(key)) return { [key]: value };
  // các trường Int — cap ở Number range
  const asNumber = Number(value);
  return { [key]: asNumber };
}
