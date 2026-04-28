import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma } from '@prisma/client';
import {
  itemByKey,
  npcShopByKey,
  npcShopEntries,
  toShopEntryView,
  type ShopEntryView,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';

export class ShopError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'ITEM_NOT_IN_SHOP'
      | 'INVALID_QTY'
      | 'NON_STACKABLE_QTY_GT_1'
      | 'INSUFFICIENT_FUNDS',
  ) {
    super(code);
  }
}

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly inventory: InventoryService,
  ) {}

  /** Trả danh sách entries của NPC shop (đã merge ItemDef + price hiệu dụng). */
  list(): ShopEntryView[] {
    return npcShopEntries().map(toShopEntryView);
  }

  /**
   * Mua item từ NPC shop. Atomic trong 1 transaction:
   * 1. Spend currency (CurrencyService.applyTx với LedgerReason='SHOP_BUY').
   * 2. Grant qty vào inventory (InventoryService.grantTx).
   *
   * Validate:
   * - itemKey phải có trong NPC_SHOP catalog (anti-spoof — không cho mua boss item).
   * - qty là integer >= 1, <= 99.
   * - Item non-stackable thì qty phải = 1 (mỗi cái 1 row riêng → muốn nhiều thì
   *   gọi nhiều lần; tránh user mua 99 cái stuck slot).
   */
  async buy(
    userId: string,
    itemKey: string,
    qty: number,
  ): Promise<{ characterId: string; itemKey: string; qty: number; totalPrice: number; currency: CurrencyKind }> {
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new ShopError('INVALID_QTY');
    }
    const shopEntry = npcShopByKey(itemKey);
    if (!shopEntry) throw new ShopError('ITEM_NOT_IN_SHOP');
    const def = itemByKey(itemKey);
    if (!def) throw new ShopError('ITEM_NOT_IN_SHOP');
    if (!def.stackable && qty > 1) {
      throw new ShopError('NON_STACKABLE_QTY_GT_1');
    }

    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!character) throw new ShopError('NO_CHARACTER');

    const totalPrice = shopEntry.price * qty;
    const currencyKind: CurrencyKind =
      shopEntry.entry.currency === 'TIEN_NGOC'
        ? CurrencyKind.TIEN_NGOC
        : CurrencyKind.LINH_THACH;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.currency.applyTx(tx, {
          characterId: character.id,
          currency: currencyKind,
          delta: -BigInt(totalPrice),
          reason: 'SHOP_BUY',
          refType: 'NPC_SHOP',
          refId: itemKey,
          meta: { itemKey, qty, unitPrice: shopEntry.price },
          actorUserId: userId,
        });
        await this.inventory.grantTx(tx, character.id, [{ itemKey, qty }]);
      });
    } catch (e) {
      if (
        e instanceof Error &&
        (e as { code?: string }).code === 'INSUFFICIENT_FUNDS'
      ) {
        throw new ShopError('INSUFFICIENT_FUNDS');
      }
      throw e;
    }

    // Client sẽ tự gọi /character/state lại sau response để refresh balance.
    // Không cần WS push riêng cho mỗi giao dịch shop (giảm noise).

    return {
      characterId: character.id,
      itemKey,
      qty,
      totalPrice,
      currency: currencyKind,
    };
  }

  /** Helper internal cho test/admin: ép Prisma error về InputJsonValue khi cần. */
  static metaToJson(meta: Record<string, unknown>): Prisma.InputJsonValue {
    return meta as Prisma.InputJsonValue;
  }
}
