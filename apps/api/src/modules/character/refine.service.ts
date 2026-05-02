import { Injectable } from '@nestjs/common';
import { CurrencyKind } from '@prisma/client';
import {
  REFINE_MAX_LEVEL,
  REFINE_PROTECTION_ITEM_KEY,
  getRefineLevelDef,
  itemByKey,
  simulateRefineAttempt,
  type RefineAttemptResult,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';

/**
 * Phase 11.5.B Refine MVP runtime service — luyện khí trang bị.
 *
 * Server-authoritative:
 *   - Verify equipment ownership + equipped/unequipped đều OK (luyện khí
 *     cho item bất kỳ trong inventory).
 *   - Verify currentLevel < `REFINE_MAX_LEVEL` (15).
 *   - Verify enough material qty (`tinh_thiet`/`yeu_dan`/`han_ngoc`).
 *   - Verify enough `linhThach` cost.
 *   - Optionally verify protection charm qty if `useProtection=true`.
 *   - Roll deterministic RNG (`Math.random` default; test có thể inject).
 *   - Resolve `simulateRefineAttempt` từ catalog → `RefineAttemptResult`.
 *   - Apply outcome:
 *     - success → `refineLevel + 1`.
 *     - fail safe → no change.
 *     - fail risky → `refineLevel - 1` (or no change nếu protection consumed).
 *     - fail extreme + break → `refineLevel = 0` + delete equipment row
 *       (item phá hỏng — gone forever).
 *     - fail extreme + no-break → `refineLevel - 1` (or no change nếu protection consumed).
 *   - Always consume material qty (`linhThachCost` + `materialQty` qty)
 *     bất kể outcome.
 *   - Consume protection charm 1 qty CHỈ KHI `protectionConsumed=true`.
 *   - Ghi `ItemLedger` reason `REFINE_MATERIAL` (qtyDelta -materialQty).
 *   - Ghi `ItemLedger` reason `REFINE_PROTECTION` (qtyDelta -1) nếu protection consumed.
 *   - Ghi `CurrencyLedger` reason `REFINE` (qtyDelta -linhThachCost).
 *
 * Atomicity: tất cả qua `prisma.$transaction` — nếu RNG outcome đã quyết định
 * + có insufficient material thì throw early (chưa transaction).
 *
 * Idempotency: KHÔNG có natural idempotency key — caller phải debounce. Mỗi
 * attempt = 1 ledger entry mới.
 */
@Injectable()
export class RefineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
  ) {}

  /**
   * Thực hiện 1 refine attempt cho equipment (inventoryItem).
   *
   * @param characterId character thực hiện refine
   * @param equipmentInventoryItemId InventoryItem id (có thể equipped hoặc không)
   * @param useProtection nếu true, verify + có thể consume protection charm khi fail
   * @param rng deterministic RNG source (test inject `() => 0.0` để force success).
   *   Default = `Math.random` (production server-authoritative roll).
   */
  async refineEquipment(
    characterId: string,
    equipmentInventoryItemId: string,
    useProtection: boolean,
    rng: () => number = Math.random,
  ): Promise<RefineAttemptOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await tx.inventoryItem.findUnique({
        where: { id: equipmentInventoryItemId },
      });
      if (!equipment) throw new RefineError('EQUIPMENT_NOT_FOUND');
      if (equipment.characterId !== characterId) {
        throw new RefineError('EQUIPMENT_NOT_FOUND');
      }
      const equipmentDef = itemByKey(equipment.itemKey);
      if (!equipmentDef) throw new RefineError('EQUIPMENT_NOT_FOUND');
      if (!equipmentDef.slot) throw new RefineError('NOT_REFINABLE');

      const current = equipment.refineLevel;
      if (current >= REFINE_MAX_LEVEL) {
        throw new RefineError('MAX_LEVEL_REACHED');
      }

      const def = getRefineLevelDef(current + 1);

      // Verify protection availability if requested.
      if (useProtection) {
        const protectionRow = await tx.inventoryItem.findFirst({
          where: {
            characterId,
            itemKey: REFINE_PROTECTION_ITEM_KEY,
            equippedSlot: null,
          },
        });
        if (!protectionRow || protectionRow.qty < 1) {
          throw new RefineError('INSUFFICIENT_PROTECTION');
        }
      }

      // Verify material qty.
      const materialRow = await tx.inventoryItem.findFirst({
        where: {
          characterId,
          itemKey: def.materialKey,
          equippedSlot: null,
        },
      });
      if (!materialRow || materialRow.qty < def.materialQty) {
        throw new RefineError('INSUFFICIENT_MATERIAL');
      }

      // Verify currency (will be re-checked atomically in CurrencyService.applyTx).
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { linhThach: true },
      });
      if (!character) throw new RefineError('EQUIPMENT_NOT_FOUND');
      if (character.linhThach < BigInt(def.linhThachCost)) {
        throw new RefineError('INSUFFICIENT_FUNDS');
      }

      // Roll outcome.
      const result = simulateRefineAttempt(current, rng, {
        hasProtection: useProtection,
      });

      // Consume material always.
      if (materialRow.qty === def.materialQty) {
        await tx.inventoryItem.delete({ where: { id: materialRow.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: materialRow.id },
          data: { qty: materialRow.qty - def.materialQty },
        });
      }
      await tx.itemLedger.create({
        data: {
          characterId,
          itemKey: def.materialKey,
          qtyDelta: -def.materialQty,
          reason: 'REFINE_MATERIAL',
          refType: 'InventoryItem',
          refId: equipment.id,
        },
      });

      // Consume protection if triggered.
      if (result.protectionConsumed) {
        const protectionRow = await tx.inventoryItem.findFirst({
          where: {
            characterId,
            itemKey: REFINE_PROTECTION_ITEM_KEY,
            equippedSlot: null,
          },
        });
        if (!protectionRow || protectionRow.qty < 1) {
          // Race-condition guard (mặc dù đã verify ở trên).
          throw new RefineError('INSUFFICIENT_PROTECTION');
        }
        if (protectionRow.qty === 1) {
          await tx.inventoryItem.delete({ where: { id: protectionRow.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: protectionRow.id },
            data: { qty: protectionRow.qty - 1 },
          });
        }
        await tx.itemLedger.create({
          data: {
            characterId,
            itemKey: REFINE_PROTECTION_ITEM_KEY,
            qtyDelta: -1,
            reason: 'REFINE_PROTECTION',
            refType: 'InventoryItem',
            refId: equipment.id,
          },
        });
      }

      // Currency spend always.
      await this.currency.applyTx(tx, {
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: BigInt(-def.linhThachCost),
        reason: 'REFINE',
        refType: 'InventoryItem',
        refId: equipment.id,
      });

      // Apply outcome to equipment.
      let broken = false;
      if (result.broken) {
        // Item phá hỏng — delete row hoàn toàn.
        await tx.inventoryItem.delete({ where: { id: equipment.id } });
        broken = true;
      } else {
        await tx.inventoryItem.update({
          where: { id: equipment.id },
          data: { refineLevel: result.nextLevel },
        });
      }

      return {
        equipmentInventoryItemId: equipment.id,
        attemptLevel: current + 1,
        result,
        finalLevel: broken ? null : result.nextLevel,
        broken,
        linhThachCost: def.linhThachCost,
        materialKey: def.materialKey,
        materialQty: def.materialQty,
        protectionConsumed: result.protectionConsumed,
      };
    });
  }
}

export interface RefineAttemptOutcome {
  equipmentInventoryItemId: string;
  /** Level đang attempt (current + 1). */
  attemptLevel: number;
  /** Raw result từ `simulateRefineAttempt`. */
  result: RefineAttemptResult;
  /** Level cuối cùng sau attempt. `null` nếu equipment broken (extreme stage). */
  finalLevel: number | null;
  broken: boolean;
  linhThachCost: number;
  materialKey: string;
  materialQty: number;
  protectionConsumed: boolean;
}

export class RefineError extends Error {
  constructor(
    public code:
      | 'EQUIPMENT_NOT_FOUND'
      | 'NOT_REFINABLE'
      | 'MAX_LEVEL_REACHED'
      | 'INSUFFICIENT_MATERIAL'
      | 'INSUFFICIENT_PROTECTION'
      | 'INSUFFICIENT_FUNDS',
  ) {
    super(code);
  }
}
