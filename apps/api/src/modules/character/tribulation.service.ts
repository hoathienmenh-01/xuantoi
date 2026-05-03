import { Injectable } from '@nestjs/common';
import { CurrencyKind } from '@prisma/client';
import {
  computeTribulationFailurePenalty,
  expCostForStage,
  getTribulationDef,
  getTribulationForBreakthrough,
  itemByKey,
  nextRealm,
  simulateTribulation,
  type TribulationDef,
  type TribulationSimulationResult,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';

/**
 * Outcome 1 attempt — server-authoritative.
 *
 * - `success=true`: simulate hết wave + finalHp > 0. Reward grant atomic.
 * - `success=false`: simulate fail trước khi xong. Penalty apply atomic.
 */
export interface TribulationOutcome {
  tribulationKey: string;
  fromRealmKey: string;
  toRealmKey: string;
  severity: string;
  type: string;
  success: boolean;
  wavesCompleted: number;
  totalDamage: number;
  finalHp: number;
  attemptCount: number;
  reward: {
    linhThach: number;
    expBonus: string;
    titleKey: string | null;
    uniqueDropItemKey: string | null;
    uniqueDropChance: number;
  } | null;
  failurePenalty: {
    expLossRatio: number;
    cooldownAt: string;
    taoMaActive: boolean;
    taoMaExpiresAt: string | null;
  } | null;
}

export class TribulationError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'NOT_AT_PEAK'
      | 'NO_TRIBULATION'
      | 'ALREADY_CLEARED'
      | 'IN_COOLDOWN',
  ) {
    super(code);
  }
}

@Injectable()
export class TribulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
  ) {}

  /**
   * Attempt Thiên Kiếp cho character ở peak realm hiện tại.
   *
   * Server-authoritative + idempotent (cleared row block re-attempt).
   *
   * @param userId user owning character.
   * @param taoMaRng deterministic RNG cho Tâm Ma debuff roll (test-only inject).
   *   Default Math.random — production use real entropy.
   * @returns TribulationOutcome
   *
   * Flow:
   *  1. Verify character exists + at peak (`realmStage=9` + `exp >= cost(9)`).
   *  2. Verify next realm exists + has tribulation catalog entry.
   *  3. Verify chưa cleared (`success=true` row) — nếu cleared throw ALREADY_CLEARED.
   *  4. Verify chưa trong cooldown (`tribulationCooldownAt > now`) — nếu còn throw IN_COOLDOWN.
   *  5. Simulate `simulateTribulation(def, hpMax, () => 1.0)` deterministic
   *     (Phase 11.6.B MVP — element resist multiplier=1.0 cho mọi wave; Phase
   *     11.6.C sẽ wire actual `computeStats` + element resist).
   *  6. Atomic transaction: insert TribulationAttempt + apply reward (success)
   *     hoặc penalty (failure).
   *  7. Reward branches: CurrencyLedger TRIBULATION_REWARD `linhThach` +
   *     Character.exp += `expBonus` + grant unique drop nếu `taoMaRng()` < `uniqueDropChance`
   *     qua ItemLedger TRIBULATION_DROP. Title field cập nhật `Character.title`.
   *  8. Failure branch: `computeTribulationFailurePenalty` → update
   *     `Character.exp = expAfter`, `tribulationCooldownAt`, `taoMaActive`,
   *     `taoMaExpiresAt`.
   */
  async attemptTribulation(
    userId: string,
    taoMaRng: () => number = Math.random,
  ): Promise<TribulationOutcome> {
    const c = await this.prisma.character.findUnique({ where: { userId } });
    if (!c) throw new TribulationError('NO_CHARACTER');

    if (c.realmStage < 9) throw new TribulationError('NOT_AT_PEAK');

    const next = nextRealm(c.realmKey);
    if (!next) throw new TribulationError('NO_TRIBULATION');
    const def = getTribulationForBreakthrough(c.realmKey, next.key);
    if (!def) throw new TribulationError('NO_TRIBULATION');

    const cleared = await this.prisma.tribulationAttempt.findFirst({
      where: { characterId: c.id, tribulationKey: def.key, success: true },
    });
    if (cleared) throw new TribulationError('ALREADY_CLEARED');

    const now = new Date();
    if (c.tribulationCooldownAt && c.tribulationCooldownAt > now) {
      throw new TribulationError('IN_COOLDOWN');
    }

    // EXP check sau cooldown — UX: nếu vừa fail, server muốn user thấy
    // IN_COOLDOWN trước, rồi mới NOT_AT_PEAK khi grind lại exp.
    const cost = expCostForStage(c.realmKey, 9);
    if (cost === null || c.exp < cost) throw new TribulationError('NOT_AT_PEAK');

    // Phase 11.6.B MVP: element resist = 1.0 (no element calc); 11.6.C sẽ wire
    // actual computeStats(charId).elementResistMap[wave.element].
    const sim = simulateTribulation(def, c.hpMax, () => 1.0);

    const attemptCount =
      (await this.prisma.tribulationAttempt.count({
        where: { characterId: c.id, tribulationKey: def.key },
      })) + 1;

    if (sim.success) {
      return await this.applySuccessTx(c.id, def, sim, attemptCount, taoMaRng);
    }
    return await this.applyFailureTx(
      c.id,
      def,
      sim,
      attemptCount,
      now,
      taoMaRng,
      c.exp,
    );
  }

  /**
   * Trả TribulationDef cho realm transition kế tiếp của character (preview UI).
   * Trả null nếu không có kiếp.
   */
  async previewNext(userId: string): Promise<TribulationDef | null> {
    const c = await this.prisma.character.findUnique({ where: { userId } });
    if (!c) return null;
    const next = nextRealm(c.realmKey);
    if (!next) return null;
    return getTribulationForBreakthrough(c.realmKey, next.key) ?? null;
  }

  private async applySuccessTx(
    characterId: string,
    def: TribulationDef,
    sim: TribulationSimulationResult,
    attemptCount: number,
    taoMaRng: () => number,
  ): Promise<TribulationOutcome> {
    // Roll unique drop separately (Math.random source — Phase 11.6.B accept
    // injected RNG cho cả tao_ma và drop). Nếu drop key catalog miss thì skip.
    const dropRoll = taoMaRng();
    const grantDrop =
      def.reward.uniqueDropItemKey !== null &&
      dropRoll < def.reward.uniqueDropChance &&
      itemByKey(def.reward.uniqueDropItemKey) !== undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.tribulationAttempt.create({
        data: {
          characterId,
          tribulationKey: def.key,
          fromRealmKey: def.fromRealmKey,
          toRealmKey: def.toRealmKey,
          severity: def.severity,
          type: def.type,
          success: true,
          wavesCompleted: sim.wavesCompleted,
          totalDamage: sim.totalDamage,
          finalHp: sim.finalHp,
          taoMaTriggered: false,
          attemptCount,
        },
      });

      // Reward currency.
      if (def.reward.linhThach > 0) {
        await this.currency.applyTx(tx, {
          characterId,
          currency: CurrencyKind.LINH_THACH,
          delta: BigInt(def.reward.linhThach),
          reason: 'TRIBULATION_REWARD',
          refType: 'tribulation',
          refId: def.key,
        });
      }

      // Reward EXP bonus + clear cooldown/Tâm Ma + set title.
      await tx.character.update({
        where: { id: characterId },
        data: {
          exp: { increment: def.reward.expBonus },
          tribulationCooldownAt: null,
          taoMaActive: false,
          taoMaExpiresAt: null,
          ...(def.reward.titleKey ? { title: def.reward.titleKey } : {}),
        },
      });

      // Unique drop (if rolled).
      if (grantDrop && def.reward.uniqueDropItemKey) {
        const drop = await tx.inventoryItem.findFirst({
          where: {
            characterId,
            itemKey: def.reward.uniqueDropItemKey,
            equippedSlot: null,
          },
        });
        if (drop) {
          await tx.inventoryItem.update({
            where: { id: drop.id },
            data: { qty: { increment: 1 } },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              characterId,
              itemKey: def.reward.uniqueDropItemKey,
              qty: 1,
            },
          });
        }
        await tx.itemLedger.create({
          data: {
            characterId,
            itemKey: def.reward.uniqueDropItemKey,
            qtyDelta: 1,
            reason: 'TRIBULATION_DROP',
            refType: 'tribulation',
            refId: def.key,
          },
        });
      }
    });

    return {
      tribulationKey: def.key,
      fromRealmKey: def.fromRealmKey,
      toRealmKey: def.toRealmKey,
      severity: def.severity,
      type: def.type,
      success: true,
      wavesCompleted: sim.wavesCompleted,
      totalDamage: sim.totalDamage,
      finalHp: sim.finalHp,
      attemptCount,
      reward: {
        linhThach: def.reward.linhThach,
        expBonus: def.reward.expBonus.toString(),
        titleKey: def.reward.titleKey,
        uniqueDropItemKey: grantDrop ? def.reward.uniqueDropItemKey : null,
        uniqueDropChance: def.reward.uniqueDropChance,
      },
      failurePenalty: null,
    };
  }

  private async applyFailureTx(
    characterId: string,
    def: TribulationDef,
    sim: TribulationSimulationResult,
    attemptCount: number,
    now: Date,
    taoMaRng: () => number,
    currentExp: bigint,
  ): Promise<TribulationOutcome> {
    const taoMaRoll = taoMaRng();
    const penalty = computeTribulationFailurePenalty(currentExp, def, now, taoMaRoll);

    await this.prisma.$transaction(async (tx) => {
      await tx.tribulationAttempt.create({
        data: {
          characterId,
          tribulationKey: def.key,
          fromRealmKey: def.fromRealmKey,
          toRealmKey: def.toRealmKey,
          severity: def.severity,
          type: def.type,
          success: false,
          wavesCompleted: sim.wavesCompleted,
          totalDamage: sim.totalDamage,
          finalHp: sim.finalHp,
          taoMaTriggered: penalty.taoMaActive,
          attemptCount,
        },
      });

      await tx.character.update({
        where: { id: characterId },
        data: {
          exp: penalty.expAfter,
          tribulationCooldownAt: penalty.cooldownAt,
          taoMaActive: penalty.taoMaActive,
          taoMaExpiresAt: penalty.taoMaExpiresAt,
        },
      });
    });

    return {
      tribulationKey: def.key,
      fromRealmKey: def.fromRealmKey,
      toRealmKey: def.toRealmKey,
      severity: def.severity,
      type: def.type,
      success: false,
      wavesCompleted: sim.wavesCompleted,
      totalDamage: sim.totalDamage,
      finalHp: sim.finalHp,
      attemptCount,
      reward: null,
      failurePenalty: {
        expLossRatio: def.failurePenalty.expLossRatio,
        cooldownAt: penalty.cooldownAt.toISOString(),
        taoMaActive: penalty.taoMaActive,
        taoMaExpiresAt: penalty.taoMaExpiresAt
          ? penalty.taoMaExpiresAt.toISOString()
          : null,
      },
    };
  }
}

/** Lookup helper — exported cho controller preview. */
export function tribulationDefByKey(key: string): TribulationDef | undefined {
  return getTribulationDef(key);
}
