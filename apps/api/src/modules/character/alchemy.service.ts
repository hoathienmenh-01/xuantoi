import { Injectable, Optional } from '@nestjs/common';
import { CurrencyKind } from '@prisma/client';
import {
  getAlchemyRecipeDef,
  alchemyRecipesAvailableAtFurnace,
  simulateAlchemyAttempt,
  itemByKey,
  realmByKey,
  ALCHEMY_RECIPES,
  type AlchemyRecipeDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';
import { AchievementService } from './achievement.service';

/**
 * Phase 11.11.B Alchemy (Luyện Đan) MVP runtime.
 *
 * Server-authoritative:
 *   - Verify recipe exists via catalog `getAlchemyRecipeDef`.
 *   - Verify character exists + furnaceLevel >= recipe.furnaceLevel.
 *   - Verify realm requirement if recipe.realmRequirement != null.
 *   - Verify all input ingredients qty available (unequipped stacks).
 *   - Verify linhThach >= recipe.linhThachCost.
 *   - Atomic $transaction:
 *     1. Consume each input ingredient (inventoryItem update/delete + ItemLedger 'ALCHEMY_INPUT').
 *     2. Deduct linhThach via CurrencyService.applyTx (reason 'ALCHEMY_COST').
 *     3. Roll deterministic via `simulateAlchemyAttempt(recipe, rng)`.
 *     4. If success: grant output pill (inventoryItem upsert + ItemLedger 'ALCHEMY_OUTPUT').
 *   - Input + linhThach ALWAYS consumed (even on fail — balance intent).
 *
 * Idempotency: KHÔNG có natural idempotency key — caller phải debounce. Mỗi
 * attempt = 1 set of ledger entries mới.
 *
 * Phase 11.11.C sẽ thêm: upgradeFurnace (cost linhThach + material),
 * mastery bonus vào successRate, attempt log analytics.
 *
 * Phase 11.11.E: post-success fail-soft `AchievementService.trackEvent` cho
 * goalKind `ALCHEMY_CRAFT` (apprentice 10 / master 100). KHÔNG track khi
 * outcome.success === false. KHÔNG throw nếu achievement service lỗi.
 */
@Injectable()
export class AlchemyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    @Optional() private readonly achievements?: AchievementService,
  ) {}

  /**
   * Attempt 1 lần luyện đan.
   *
   * @param characterId character thực hiện
   * @param recipeKey recipe từ catalog
   * @param rng deterministic RNG [0,1) — default Math.random()
   */
  async attemptCraft(
    characterId: string,
    recipeKey: string,
    rng: () => number = Math.random,
  ): Promise<AlchemyCraftOutcome> {
    const recipe = getAlchemyRecipeDef(recipeKey);
    if (!recipe) throw new AlchemyError('RECIPE_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: {
          id: true,
          realmKey: true,
          linhThach: true,
          alchemyFurnaceLevel: true,
        },
      });
      if (!character) throw new AlchemyError('CHARACTER_NOT_FOUND');

      if (character.alchemyFurnaceLevel < recipe.furnaceLevel) {
        throw new AlchemyError('FURNACE_LEVEL_TOO_LOW');
      }

      if (recipe.realmRequirement) {
        const charRealm = realmByKey(character.realmKey);
        const reqRealm = realmByKey(recipe.realmRequirement);
        if (!charRealm || !reqRealm || charRealm.order < reqRealm.order) {
          throw new AlchemyError('REALM_REQUIREMENT_NOT_MET');
        }
      }

      if (character.linhThach < BigInt(recipe.linhThachCost)) {
        throw new AlchemyError('INSUFFICIENT_FUNDS');
      }

      // Verify + consume each input ingredient.
      for (const ing of recipe.inputs) {
        const row = await tx.inventoryItem.findFirst({
          where: { characterId, itemKey: ing.itemKey, equippedSlot: null },
        });
        if (!row || row.qty < ing.qty) {
          throw new AlchemyError('INSUFFICIENT_INGREDIENTS');
        }
        if (row.qty === ing.qty) {
          await tx.inventoryItem.delete({ where: { id: row.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: row.id },
            data: { qty: row.qty - ing.qty },
          });
        }
        await tx.itemLedger.create({
          data: {
            characterId,
            itemKey: ing.itemKey,
            qtyDelta: -ing.qty,
            reason: 'ALCHEMY_INPUT',
            refType: 'AlchemyRecipe',
            refId: recipeKey,
          },
        });
      }

      // Deduct linhThach.
      await this.currency.applyTx(tx, {
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: BigInt(-recipe.linhThachCost),
        reason: 'ALCHEMY_COST',
        refType: 'AlchemyRecipe',
        refId: recipeKey,
      });

      // Roll outcome.
      const roll = rng();
      const result = simulateAlchemyAttempt(recipe, roll);

      // Grant output if success.
      if (result.success) {
        const outputDef = itemByKey(recipe.outputItem);
        const stackable = outputDef?.stackable ?? true;

        if (stackable) {
          const existing = await tx.inventoryItem.findFirst({
            where: { characterId, itemKey: recipe.outputItem, equippedSlot: null },
          });
          if (existing) {
            await tx.inventoryItem.update({
              where: { id: existing.id },
              data: { qty: { increment: result.outputQty } },
            });
          } else {
            await tx.inventoryItem.create({
              data: { characterId, itemKey: recipe.outputItem, qty: result.outputQty },
            });
          }
        } else {
          for (let i = 0; i < result.outputQty; i++) {
            await tx.inventoryItem.create({
              data: { characterId, itemKey: recipe.outputItem, qty: 1 },
            });
          }
        }

        await tx.itemLedger.create({
          data: {
            characterId,
            itemKey: recipe.outputItem,
            qtyDelta: result.outputQty,
            reason: 'ALCHEMY_OUTPUT',
            refType: 'AlchemyRecipe',
            refId: recipeKey,
          },
        });
      }

      return {
        recipeKey,
        success: result.success,
        rollValue: result.rollValue,
        outputItem: result.outputItem,
        outputQty: result.outputQty,
        linhThachConsumed: recipe.linhThachCost,
        inputsConsumed: recipe.inputs.map((i) => ({ itemKey: i.itemKey, qty: i.qty })),
      };
    }).then(async (outcome) => {
      // Phase 11.11.E: track ALCHEMY_CRAFT achievement progress khi success.
      // Wrap try/catch — fail-soft, không lan ra outcome.
      if (outcome.success && this.achievements) {
        try {
          await this.achievements.trackEvent(characterId, 'ALCHEMY_CRAFT', 1);
        } catch {
          // bỏ qua
        }
      }
      return outcome;
    });
  }

  /** Read furnace level for character. */
  async getFurnaceLevel(characterId: string): Promise<number> {
    const char = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { alchemyFurnaceLevel: true },
    });
    if (!char) throw new AlchemyError('CHARACTER_NOT_FOUND');
    return char.alchemyFurnaceLevel;
  }

  /** List recipes available at character's current furnace level. */
  async listAvailableRecipes(
    characterId: string,
  ): Promise<readonly AlchemyRecipeDef[]> {
    const level = await this.getFurnaceLevel(characterId);
    return alchemyRecipesAvailableAtFurnace(level);
  }
}

// ---------- Return type ----------

export interface AlchemyCraftOutcome {
  recipeKey: string;
  success: boolean;
  rollValue: number;
  outputItem: string | null;
  outputQty: number;
  linhThachConsumed: number;
  inputsConsumed: Array<{ itemKey: string; qty: number }>;
}

// ---------- Error ----------

export type AlchemyErrorCode =
  | 'RECIPE_NOT_FOUND'
  | 'CHARACTER_NOT_FOUND'
  | 'FURNACE_LEVEL_TOO_LOW'
  | 'REALM_REQUIREMENT_NOT_MET'
  | 'INSUFFICIENT_INGREDIENTS'
  | 'INSUFFICIENT_FUNDS';

export class AlchemyError extends Error {
  constructor(public readonly code: AlchemyErrorCode) {
    super(code);
  }
}

export const ALCHEMY_RECIPE_COUNT = ALCHEMY_RECIPES.length;
