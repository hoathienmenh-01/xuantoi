import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';

export class MailError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'MAIL_NOT_FOUND'
      | 'MAIL_EXPIRED'
      | 'NO_REWARD'
      | 'ALREADY_CLAIMED'
      | 'RECIPIENT_NOT_FOUND'
      | 'INVALID_INPUT',
  ) {
    super(code);
  }
}

export interface MailRewardItem {
  itemKey: string;
  qty: number;
}

export interface MailView {
  id: string;
  senderName: string;
  subject: string;
  body: string;
  rewardLinhThach: string;
  rewardTienNgoc: number;
  rewardExp: string;
  rewardItems: MailRewardItem[];
  readAt: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** Có reward gì đó (LT/TN/EXP/item) và chưa claim + chưa hết hạn. */
  claimable: boolean;
}

export interface MailSendInput {
  recipientCharacterId: string;
  subject: string;
  body: string;
  senderName?: string;
  rewardLinhThach?: bigint;
  rewardTienNgoc?: number;
  rewardExp?: bigint;
  rewardItems?: MailRewardItem[];
  expiresAt?: Date;
  createdByAdminId?: string;
}

export interface MailBroadcastInput {
  subject: string;
  body: string;
  senderName?: string;
  rewardLinhThach?: bigint;
  rewardTienNgoc?: number;
  rewardExp?: bigint;
  rewardItems?: MailRewardItem[];
  expiresAt?: Date;
  createdByAdminId?: string;
}

const MAX_INBOX = 100;
const MAX_ITEMS_PER_MAIL = 10;

/**
 * Service thư hệ thống + thư từ admin.
 *
 * - `inbox(userId)`: 100 thư gần nhất của nhân vật (desc `createdAt`).
 * - `markRead(userId, id)`: set `readAt=now()` (idempotent).
 * - `claim(userId, id)`: atomic — trao tiền (ledger `MAIL_CLAIM`) + item + exp
 *   rồi set `claimedAt=now()`. Không claim được nếu:
 *   - thư không tồn tại / không thuộc về user,
 *   - không có reward gì (NO_REWARD),
 *   - đã claim (ALREADY_CLAIMED),
 *   - đã hết hạn (MAIL_EXPIRED).
 * - `sendToCharacter(...)`: admin gửi 1 thư cho 1 nhân vật.
 * - `broadcast(...)`: admin gửi 1 thư cho TẤT CẢ nhân vật hiện có.
 */
@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly inventory: InventoryService,
  ) {}

  async inbox(userId: string): Promise<MailView[]> {
    const char = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!char) throw new MailError('NO_CHARACTER');
    const rows = await this.prisma.mail.findMany({
      where: { recipientId: char.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_INBOX,
    });
    const now = new Date();
    return rows.map((r) => toView(r, now));
  }

  async markRead(userId: string, mailId: string): Promise<MailView> {
    const char = await this.requireCharacter(userId);
    const mail = await this.prisma.mail.findFirst({
      where: { id: mailId, recipientId: char.id },
    });
    if (!mail) throw new MailError('MAIL_NOT_FOUND');
    if (!mail.readAt) {
      await this.prisma.mail.update({
        where: { id: mailId },
        data: { readAt: new Date() },
      });
    }
    const updated = await this.prisma.mail.findUniqueOrThrow({
      where: { id: mailId },
    });
    return toView(updated, new Date());
  }

  async claim(userId: string, mailId: string): Promise<MailView> {
    const char = await this.requireCharacter(userId);

    await this.prisma.$transaction(async (tx) => {
      const mail = await tx.mail.findFirst({
        where: { id: mailId, recipientId: char.id },
      });
      if (!mail) throw new MailError('MAIL_NOT_FOUND');
      if (mail.claimedAt) throw new MailError('ALREADY_CLAIMED');
      if (mail.expiresAt && mail.expiresAt.getTime() <= Date.now()) {
        throw new MailError('MAIL_EXPIRED');
      }
      const items = parseItems(mail.rewardItems);
      const hasReward =
        mail.rewardLinhThach > 0n ||
        mail.rewardTienNgoc > 0 ||
        mail.rewardExp > 0n ||
        items.length > 0;
      if (!hasReward) throw new MailError('NO_REWARD');

      // CAS: chỉ set claimedAt nếu vẫn null.
      const upd = await tx.mail.updateMany({
        where: { id: mailId, claimedAt: null },
        data: { claimedAt: new Date(), readAt: mail.readAt ?? new Date() },
      });
      if (upd.count !== 1) throw new MailError('ALREADY_CLAIMED');

      if (mail.rewardLinhThach > 0n) {
        await this.currency.applyTx(tx, {
          characterId: char.id,
          currency: CurrencyKind.LINH_THACH,
          delta: mail.rewardLinhThach,
          reason: 'MAIL_CLAIM',
          refType: 'MAIL',
          refId: mailId,
        });
      }
      if (mail.rewardTienNgoc > 0) {
        await this.currency.applyTx(tx, {
          characterId: char.id,
          currency: CurrencyKind.TIEN_NGOC,
          delta: BigInt(mail.rewardTienNgoc),
          reason: 'MAIL_CLAIM',
          refType: 'MAIL',
          refId: mailId,
        });
      }
      if (mail.rewardExp > 0n) {
        await tx.character.update({
          where: { id: char.id },
          data: { exp: { increment: mail.rewardExp } },
        });
      }
      if (items.length > 0) {
        await this.inventory.grantTx(tx, char.id, items);
      }
    });

    const updated = await this.prisma.mail.findUniqueOrThrow({
      where: { id: mailId },
    });
    return toView(updated, new Date());
  }

  async sendToCharacter(input: MailSendInput): Promise<MailView> {
    this.validateInput(input);
    const exists = await this.prisma.character.findUnique({
      where: { id: input.recipientCharacterId },
      select: { id: true },
    });
    if (!exists) throw new MailError('RECIPIENT_NOT_FOUND');
    const row = await this.prisma.mail.create({
      data: {
        recipientId: input.recipientCharacterId,
        senderName: input.senderName ?? 'Thiên Đạo Sứ Giả',
        subject: input.subject,
        body: input.body,
        rewardLinhThach: input.rewardLinhThach ?? 0n,
        rewardTienNgoc: input.rewardTienNgoc ?? 0,
        rewardExp: input.rewardExp ?? 0n,
        rewardItems: (input.rewardItems ?? []) as unknown as Prisma.InputJsonValue,
        expiresAt: input.expiresAt ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      },
    });
    return toView(row, new Date());
  }

  /** Gửi cho TẤT CẢ nhân vật hiện có. Trả về số thư đã tạo. */
  async broadcast(input: MailBroadcastInput): Promise<number> {
    this.validateInput(input);
    const chars = await this.prisma.character.findMany({ select: { id: true } });
    if (chars.length === 0) return 0;
    await this.prisma.mail.createMany({
      data: chars.map((c) => ({
        recipientId: c.id,
        senderName: input.senderName ?? 'Thiên Đạo Sứ Giả',
        subject: input.subject,
        body: input.body,
        rewardLinhThach: input.rewardLinhThach ?? 0n,
        rewardTienNgoc: input.rewardTienNgoc ?? 0,
        rewardExp: input.rewardExp ?? 0n,
        rewardItems: (input.rewardItems ?? []) as unknown as Prisma.InputJsonValue,
        expiresAt: input.expiresAt ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      })),
    });
    return chars.length;
  }

  /** Xoá thư đã claim + quá hạn. Cron có thể gọi. */
  async pruneExpired(olderThan: Date): Promise<number> {
    const res = await this.prisma.mail.deleteMany({
      where: {
        OR: [
          { claimedAt: { lt: olderThan } },
          { expiresAt: { lt: new Date() }, rewardLinhThach: 0n, rewardTienNgoc: 0, rewardExp: 0n },
        ],
      },
    });
    return res.count;
  }

  private async requireCharacter(userId: string): Promise<{ id: string }> {
    const char = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!char) throw new MailError('NO_CHARACTER');
    return char;
  }

  private validateInput(input: MailSendInput | MailBroadcastInput): void {
    if (!input.subject || input.subject.length > 120) {
      throw new MailError('INVALID_INPUT');
    }
    if (!input.body || input.body.length > 2000) {
      throw new MailError('INVALID_INPUT');
    }
    if (input.rewardLinhThach !== undefined && input.rewardLinhThach < 0n) {
      throw new MailError('INVALID_INPUT');
    }
    if (input.rewardTienNgoc !== undefined && input.rewardTienNgoc < 0) {
      throw new MailError('INVALID_INPUT');
    }
    if (input.rewardExp !== undefined && input.rewardExp < 0n) {
      throw new MailError('INVALID_INPUT');
    }
    if (input.rewardItems && input.rewardItems.length > MAX_ITEMS_PER_MAIL) {
      throw new MailError('INVALID_INPUT');
    }
    for (const it of input.rewardItems ?? []) {
      if (!it.itemKey || it.qty <= 0) throw new MailError('INVALID_INPUT');
    }
  }
}

function parseItems(raw: unknown): MailRewardItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MailRewardItem[] = [];
  for (const r of raw) {
    if (r && typeof r === 'object' && 'itemKey' in r && 'qty' in r) {
      const v = r as { itemKey: unknown; qty: unknown };
      if (typeof v.itemKey === 'string' && typeof v.qty === 'number' && v.qty > 0) {
        out.push({ itemKey: v.itemKey, qty: v.qty });
      }
    }
  }
  return out;
}

function toView(
  row: {
    id: string;
    senderName: string;
    subject: string;
    body: string;
    rewardLinhThach: bigint;
    rewardTienNgoc: number;
    rewardExp: bigint;
    rewardItems: Prisma.JsonValue;
    readAt: Date | null;
    claimedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  },
  now: Date,
): MailView {
  const items = parseItems(row.rewardItems);
  const expired = row.expiresAt ? row.expiresAt.getTime() <= now.getTime() : false;
  const hasReward =
    row.rewardLinhThach > 0n ||
    row.rewardTienNgoc > 0 ||
    row.rewardExp > 0n ||
    items.length > 0;
  return {
    id: row.id,
    senderName: row.senderName,
    subject: row.subject,
    body: row.body,
    rewardLinhThach: row.rewardLinhThach.toString(),
    rewardTienNgoc: row.rewardTienNgoc,
    rewardExp: row.rewardExp.toString(),
    rewardItems: items,
    readAt: row.readAt?.toISOString() ?? null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    claimable: hasReward && !row.claimedAt && !expired,
  };
}
