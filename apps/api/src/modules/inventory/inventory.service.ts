import { Injectable } from '@nestjs/common';
import type { EquipSlot, Prisma } from '@prisma/client';
import { itemByKey, type ItemDef, type RolledLoot } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';

/**
 * Lý do thay đổi vật phẩm — ghi vào `ItemLedger.reason`.
 * - Inflow:  COMBAT_LOOT | BOSS_REWARD | MARKET_BUY | MISSION_CLAIM
 *           | MAIL_CLAIM | GIFTCODE_REDEEM | SHOP_BUY | ADMIN_GRANT
 * - Outflow: USE | MARKET_SELL | ADMIN_REVOKE
 */
export type ItemLedgerReason =
  | 'COMBAT_LOOT'
  | 'BOSS_REWARD'
  | 'MARKET_BUY'
  | 'MARKET_SELL'
  | 'MISSION_CLAIM'
  | 'MAIL_CLAIM'
  | 'GIFTCODE_REDEEM'
  | 'SHOP_BUY'
  | 'ADMIN_GRANT'
  | 'ADMIN_REVOKE'
  | 'USE';

export interface ItemLedgerMeta {
  reason: ItemLedgerReason;
  refType?: string;
  refId?: string;
  actorUserId?: string;
  extra?: Prisma.InputJsonValue;
}

class InventoryError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'ITEM_NOT_FOUND'
      | 'INVENTORY_ITEM_NOT_FOUND'
      | 'NOT_EQUIPPABLE'
      | 'NOT_USABLE'
      | 'WRONG_SLOT'
      | 'ALREADY_USED'
      | 'INSUFFICIENT_QTY',
  ) {
    super(code);
  }
}

export interface InventoryView {
  id: string;
  itemKey: string;
  qty: number;
  equippedSlot: EquipSlot | null;
  item: ItemDef;
}

export interface EquipBonusSummary {
  atk: number;
  def: number;
  hpMaxBonus: number;
  mpMaxBonus: number;
  spiritBonus: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly chars: CharacterService,
  ) {}

  async list(characterId: string): Promise<InventoryView[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: { characterId },
      orderBy: [{ equippedSlot: 'asc' }, { createdAt: 'asc' }],
    });
    const out: InventoryView[] = [];
    for (const r of rows) {
      const item = itemByKey(r.itemKey);
      if (!item) continue;
      out.push({
        id: r.id,
        itemKey: r.itemKey,
        qty: r.qty,
        equippedSlot: r.equippedSlot,
        item,
      });
    }
    return out;
  }

  /** Tổng bonus từ trang bị đang đeo của 1 character. Dùng trong combat. */
  async equipBonus(characterId: string): Promise<EquipBonusSummary> {
    const equipped = await this.prisma.inventoryItem.findMany({
      where: { characterId, equippedSlot: { not: null } },
    });
    let atk = 0;
    let def = 0;
    let hpMaxBonus = 0;
    let mpMaxBonus = 0;
    let spiritBonus = 0;
    for (const r of equipped) {
      const def_ = itemByKey(r.itemKey);
      if (!def_?.bonuses) continue;
      atk += def_.bonuses.atk ?? 0;
      def += def_.bonuses.def ?? 0;
      hpMaxBonus += def_.bonuses.hpMax ?? 0;
      mpMaxBonus += def_.bonuses.mpMax ?? 0;
      spiritBonus += def_.bonuses.spirit ?? 0;
    }
    return { atk, def, hpMaxBonus, mpMaxBonus, spiritBonus };
  }

  /**
   * Thêm item vào túi: stackable thì gộp qty, không thì tạo row mới.
   * Mọi grant đều ghi `ItemLedger` để audit (qtyDelta dương).
   */
  async grant(
    characterId: string,
    loot: RolledLoot[],
    meta: ItemLedgerMeta,
  ): Promise<void> {
    for (const l of loot) {
      await this.grantOneTx(this.prisma, characterId, l.itemKey, l.qty, meta);
    }
  }

  /** Tx-aware grant — dùng trong reward distribution boss/market/mail/giftcode. */
  async grantTx(
    tx: Prisma.TransactionClient,
    characterId: string,
    items: { itemKey: string; qty: number }[],
    meta: ItemLedgerMeta,
  ): Promise<void> {
    for (const it of items) {
      await this.grantOneTx(tx, characterId, it.itemKey, it.qty, meta);
    }
  }

  private async grantOneTx(
    db: Prisma.TransactionClient | PrismaService,
    characterId: string,
    itemKey: string,
    qty: number,
    meta: ItemLedgerMeta,
  ): Promise<void> {
    const def = itemByKey(itemKey);
    if (!def) return;
    if (qty <= 0) return;
    if (def.stackable) {
      const existing = await db.inventoryItem.findFirst({
        where: { characterId, itemKey, equippedSlot: null },
      });
      if (existing) {
        await db.inventoryItem.update({
          where: { id: existing.id },
          data: { qty: { increment: qty } },
        });
        await this.writeLedgerTx(db, characterId, itemKey, qty, meta);
        return;
      }
    }
    await db.inventoryItem.create({
      data: { characterId, itemKey, qty },
    });
    await this.writeLedgerTx(db, characterId, itemKey, qty, meta);
  }

  private async writeLedgerTx(
    db: Prisma.TransactionClient | PrismaService,
    characterId: string,
    itemKey: string,
    qtyDelta: number,
    meta: ItemLedgerMeta,
  ): Promise<void> {
    await db.itemLedger.create({
      data: {
        characterId,
        itemKey,
        qtyDelta,
        reason: meta.reason,
        refType: meta.refType ?? null,
        refId: meta.refId ?? null,
        actorUserId: meta.actorUserId ?? null,
        meta: meta.extra ?? {},
      },
    });
  }

  /**
   * Admin revoke — thu hồi item khỏi túi người chơi. Ghi ledger `ADMIN_REVOKE`.
   *
   * Logic:
   *  1. Tổng qty của `itemKey` trên character = Σ qty của mọi row (equipped + unequipped stack).
   *  2. Nếu tổng < qty yêu cầu → throw `INSUFFICIENT_QTY`. KHÔNG trừ một phần (atomic).
   *  3. Ưu tiên trừ từ row KHÔNG equipped trước (tránh làm player bị mất trang bị đang đeo
   *     đột ngột). Nếu hết row non-equipped mà vẫn còn nợ → đụng row equipped,
   *     nhưng clear `equippedSlot` khi hết sạch row đó.
   *  4. Row qty → 0: delete row.
   *  5. Ghi ledger với `qtyDelta = -qty` (total), `reason = ADMIN_REVOKE`.
   *
   * Caller (AdminService) chịu trách nhiệm check role hierarchy + audit log.
   */
  async revoke(
    characterId: string,
    itemKey: string,
    qty: number,
    meta: Omit<ItemLedgerMeta, 'reason'>,
  ): Promise<void> {
    if (qty <= 0) throw new InventoryError('INSUFFICIENT_QTY');
    const def = itemByKey(itemKey);
    if (!def) throw new InventoryError('ITEM_NOT_FOUND');

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.inventoryItem.findMany({
        where: { characterId, itemKey },
        orderBy: [
          // non-equipped trước (equippedSlot IS NULL → true → xếp trước)
          { equippedSlot: 'asc' },
          { createdAt: 'asc' },
        ],
      });
      const total = rows.reduce((s, r) => s + r.qty, 0);
      if (total < qty) throw new InventoryError('INSUFFICIENT_QTY');

      let remaining = qty;
      // Chiến lược "non-equipped trước": sort lại thủ công vì Prisma sort NULL
      // theo locale DB, không ổn định.
      const sorted = [...rows].sort((a, b) => {
        const ae = a.equippedSlot === null ? 0 : 1;
        const be = b.equippedSlot === null ? 0 : 1;
        if (ae !== be) return ae - be;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      for (const r of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(r.qty, remaining);
        remaining -= take;
        if (r.qty === take) {
          await tx.inventoryItem.delete({ where: { id: r.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: r.id },
            data: { qty: r.qty - take },
          });
        }
      }

      await this.writeLedgerTx(tx, characterId, itemKey, -qty, {
        reason: 'ADMIN_REVOKE',
        refType: meta.refType,
        refId: meta.refId,
        actorUserId: meta.actorUserId,
        extra: meta.extra,
      });
    });
  }

  async equip(userId: string, inventoryItemId: string): Promise<InventoryView[]> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new InventoryError('NO_CHARACTER');
    const inv = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!inv || inv.characterId !== char.id) {
      throw new InventoryError('INVENTORY_ITEM_NOT_FOUND');
    }
    const def = itemByKey(inv.itemKey);
    if (!def) throw new InventoryError('ITEM_NOT_FOUND');
    if (!def.slot) throw new InventoryError('NOT_EQUIPPABLE');

    await this.prisma.$transaction(async (tx) => {
      // Tháo món hiện tại ở slot này (nếu có)
      const cur = await tx.inventoryItem.findFirst({
        where: { characterId: char.id, equippedSlot: def.slot ?? undefined },
      });
      if (cur && cur.id !== inv.id) {
        await tx.inventoryItem.update({
          where: { id: cur.id },
          data: { equippedSlot: null },
        });
      }
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { equippedSlot: def.slot ?? null },
      });
    });

    await this.refreshState(userId);
    return this.list(char.id);
  }

  async unequip(userId: string, slot: EquipSlot): Promise<InventoryView[]> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new InventoryError('NO_CHARACTER');
    const cur = await this.prisma.inventoryItem.findFirst({
      where: { characterId: char.id, equippedSlot: slot },
    });
    if (!cur) throw new InventoryError('INVENTORY_ITEM_NOT_FOUND');
    await this.prisma.inventoryItem.update({
      where: { id: cur.id },
      data: { equippedSlot: null },
    });
    await this.refreshState(userId);
    return this.list(char.id);
  }

  async use(userId: string, inventoryItemId: string): Promise<InventoryView[]> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new InventoryError('NO_CHARACTER');
    const inv = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!inv || inv.characterId !== char.id) {
      throw new InventoryError('INVENTORY_ITEM_NOT_FOUND');
    }
    const def = itemByKey(inv.itemKey);
    if (!def) throw new InventoryError('ITEM_NOT_FOUND');
    if (!def.effect) throw new InventoryError('NOT_USABLE');

    const updates: Record<string, unknown> = {};
    if (def.effect.hp) {
      updates.hp = Math.min(char.hpMax, char.hp + def.effect.hp);
    }
    if (def.effect.mp) {
      updates.mp = Math.min(char.mpMax, char.mp + def.effect.mp);
    }
    if (def.effect.exp) {
      updates.exp = { increment: BigInt(def.effect.exp) };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.character.update({ where: { id: char.id }, data: updates });
      if (inv.qty > 1) {
        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: { qty: inv.qty - 1 },
        });
      } else {
        await tx.inventoryItem.delete({ where: { id: inv.id } });
      }
      await this.writeLedgerTx(tx, char.id, inv.itemKey, -1, {
        reason: 'USE',
        refType: 'InventoryItem',
        refId: inv.id,
      });
    });

    await this.refreshState(userId);
    return this.list(char.id);
  }

  private async refreshState(userId: string): Promise<void> {
    const state = await this.chars.findByUser(userId);
    if (state) this.realtime.emitToUser(userId, 'state:update', state);
  }
}

export { InventoryError };
