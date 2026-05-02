import { Injectable, Logger } from '@nestjs/common';
import { CurrencyKind } from '@prisma/client';
import {
  computeTribulationFailurePenalty,
  computeTribulationReward,
  expCostForStage,
  getTribulationForBreakthrough,
  nextRealm,
  simulateTribulation,
  titleForRealmMilestone,
  type ElementKey,
  type TribulationDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { BuffService } from './buff.service';
import { CurrencyService } from './currency.service';
import { TitleService } from './title.service';

/**
 * Phase 11.6.B Tribulation/Tâm Ma MVP runtime — server-authoritative deterministic kiếp.
 *
 * Manual breakthrough flow cho realm threshold cao (theo `TRIBULATIONS` catalog
 * trong `packages/shared/src/tribulation.ts`). Khác với
 * {@link CharacterService.breakthrough} (low-tier, không kiếp), service này:
 *   - Verify cùng realm gate (`realmStage===9` + `exp>=cost(9)`).
 *   - Verify catalog có `TribulationDef` cho transition `c.realmKey → next`.
 *   - Verify cooldown chưa active (`Character.tribulationCooldownAt`).
 *   - Roll deterministic simulation qua `simulateTribulation(def, hp, resistFn)`.
 *   - Roll RNG `[0,1]` cho `taoMaDebuffChance` (test inject `() => 0.0` lock-in
 *     debuff trigger; `() => 0.99` block).
 *   - Apply outcome (atomic trong `prisma.$transaction`):
 *     - Success → realm advance giống {@link CharacterService.breakthrough}
 *       (`realmKey=next`, `realmStage=1`, `exp -= cost9 + bonus`,
 *       `hpMax/mpMax × 1.2`, `hp/mp = max`), grant linhThach reward qua
 *       `CurrencyLedger.TRIBULATION_REWARD`, clear `tribulationCooldownAt` +
 *       `taoMaUntil`, write `TribulationAttemptLog{success:true}`.
 *     - Fail → apply penalty từ `computeTribulationFailurePenalty(...)`
 *       (EXP loss, cooldown, optional Tâm Ma debuff), set `hp=1` (knock down,
 *       không death), write `TribulationAttemptLog{success:false}`.
 *
 * Element resist (Phase 11.6.C tương lai) sẽ wire từ Spiritual Root primary
 * element + equipment resist multiplier. MVP dùng `() => 1.0` cố định
 * (không resist) để giữ scope nhỏ + deterministic test.
 *
 * Idempotency: KHÔNG có natural key — caller phải debounce. Mỗi attempt = 1
 * row `TribulationAttemptLog` mới + 1 row `CurrencyLedger` (chỉ khi success).
 */
@Injectable()
export class TribulationService {
  private readonly logger = new Logger(TribulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly titles?: TitleService,
    private readonly buffs?: BuffService,
  ) {}

  /**
   * Thực hiện 1 tribulation attempt cho character.
   *
   * @param characterId character id (server-trusted, đã resolve từ userId).
   * @param rng deterministic RNG source cho `taoMaDebuffChance` roll.
   *   Default = `Math.random` (production server-authoritative roll).
   * @param now timestamp gốc cho cooldown + taoMaExpiresAt computation.
   *   Default = `new Date()`. Inject từ test để control timeline.
   */
  async attemptTribulation(
    characterId: string,
    rng: () => number = Math.random,
    now: Date = new Date(),
  ): Promise<TribulationAttemptOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });
      if (!character) throw new TribulationError('CHARACTER_NOT_FOUND');

      // Realm gate: peak (stage 9) + đủ EXP cost — giống `breakthrough()`.
      if (character.realmStage < 9) throw new TribulationError('NOT_AT_PEAK');
      const cost = expCostForStage(character.realmKey, 9);
      if (cost === null || character.exp < cost) {
        throw new TribulationError('NOT_AT_PEAK');
      }

      // Catalog gate: phải có TribulationDef cho transition này. Nếu không
      // (low-tier transition: phamnhan→luyenkhi v.v.), caller phải dùng
      // `CharacterService.breakthrough()` low-risk thay vì service này.
      const next = nextRealm(character.realmKey);
      if (!next) throw new TribulationError('NO_NEXT_REALM');
      const def = getTribulationForBreakthrough(character.realmKey, next.key);
      if (!def) throw new TribulationError('NO_TRIBULATION_FOR_TRANSITION');

      // Cooldown gate (set từ FAIL trước đó).
      if (
        character.tribulationCooldownAt &&
        character.tribulationCooldownAt > now
      ) {
        throw new TribulationError('COOLDOWN_ACTIVE');
      }

      // Đếm attempt index cho transition (audit + tests).
      const priorAttempts = await tx.tribulationAttemptLog.count({
        where: { characterId, tribulationKey: def.key },
      });
      const attemptIndex = priorAttempts + 1;

      // Element resist: MVP fixed 1.0 (no resist). Phase 11.6.C wire spiritual
      // root primary element + equipment.
      const elementResistFn = (_element: ElementKey | null) => 1.0;

      const sim = simulateTribulation(def, character.hpMax, elementResistFn);

      const taoMaRoll = rng();
      if (!Number.isFinite(taoMaRoll) || taoMaRoll < 0 || taoMaRoll > 1) {
        throw new TribulationError('INVALID_RNG');
      }

      if (sim.success) {
        // === SUCCESS PATH === realm advance + reward grant + clear debuffs.
        const reward = computeTribulationReward(def);
        const newHpMax = Math.round(character.hpMax * 1.2);
        const newMpMax = Math.round(character.mpMax * 1.2);
        const newExp = character.exp - cost + reward.expBonus;

        await tx.character.update({
          where: { id: characterId },
          data: {
            realmKey: next.key,
            realmStage: 1,
            exp: newExp,
            hpMax: newHpMax,
            mpMax: newMpMax,
            hp: newHpMax,
            mp: newMpMax,
            tribulationCooldownAt: null,
            taoMaUntil: null,
          },
        });

        const log = await tx.tribulationAttemptLog.create({
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
            hpInitial: character.hpMax,
            expBefore: character.exp,
            expAfter: newExp,
            expLoss: 0n,
            taoMaActive: false,
            taoMaExpiresAt: null,
            cooldownAt: null,
            linhThachReward: reward.linhThach,
            expBonusReward: reward.expBonus,
            titleKeyReward: reward.titleKey,
            attemptIndex,
            taoMaRoll,
          },
        });

        // Currency reward via ledger (atomic trong cùng tx).
        if (reward.linhThach > 0) {
          await this.currency.applyTx(tx, {
            characterId,
            currency: CurrencyKind.LINH_THACH,
            delta: BigInt(reward.linhThach),
            reason: 'TRIBULATION_REWARD',
            refType: 'TribulationAttemptLog',
            refId: log.id,
          });
        }

        // Phase 11.9.C-2 — auto-unlock realm milestone title (atomic trong
        // cùng tx). Idempotent qua `CharacterTitleUnlock` composite UNIQUE.
        // Skip nếu (a) `titles` chưa inject (test/legacy), (b) realm mới
        // không có milestone title trong catalog (vd hoa_than → luyen_hu).
        // KHÔNG fail-soft như `CharacterService.breakthrough()` low-tier:
        // nếu unlock fail trong tx này, rollback toàn bộ (currency + log +
        // realm advance) — atomic guarantee. Ngoại lệ: `TITLE_NOT_FOUND`
        // (catalog drift) chỉ log warn, không rollback (tribulation success
        // KHÔNG nên fail vì cosmetic title catalog drift).
        if (this.titles) {
          const titleDef = titleForRealmMilestone(next.key);
          if (titleDef) {
            try {
              await this.titles.unlockTitleTx(
                tx,
                characterId,
                titleDef.key,
                'realm_milestone',
              );
            } catch (err) {
              const msg = (err as Error).message;
              if (msg === 'TITLE_NOT_FOUND') {
                this.logger.warn(
                  `tribulation: title catalog drift for ${titleDef.key}: ${msg}`,
                );
              } else {
                throw err;
              }
            }
          }
        }

        return {
          success: true,
          tribulationKey: def.key,
          fromRealmKey: def.fromRealmKey,
          toRealmKey: def.toRealmKey,
          severity: def.severity,
          type: def.type,
          wavesCompleted: sim.wavesCompleted,
          totalDamage: sim.totalDamage,
          finalHp: sim.finalHp,
          attemptIndex,
          reward: {
            linhThach: reward.linhThach,
            expBonus: reward.expBonus,
            titleKey: reward.titleKey,
          },
          penalty: null,
          logId: log.id,
        };
      }

      // === FAIL PATH === penalty + cooldown + optional Tâm Ma debuff.
      const penalty = computeTribulationFailurePenalty(
        character.exp,
        def,
        now,
        taoMaRoll,
      );
      const expLoss = character.exp - penalty.expAfter;

      await tx.character.update({
        where: { id: characterId },
        data: {
          exp: penalty.expAfter,
          tribulationCooldownAt: penalty.cooldownAt,
          taoMaUntil: penalty.taoMaActive ? penalty.taoMaExpiresAt : null,
          // Knock down (không death — design choice MVP: không xoá nhân vật).
          hp: 1,
        },
      });

      // Phase 11.8.D-2 — atomic apply `debuff_taoma` qua BuffService cùng tx.
      // Per-tier duration từ tribulation catalog (`taoMaDebuffDurationMinutes`)
      // override default buff catalog `durationSec` để tier scaling chính xác
      // (15/30/60/120 phút). Legacy `Character.taoMaUntil` field vẫn được set
      // ở update phía trên cho backward-compat — future migration sẽ migrate
      // tất cả readers sang BuffService rồi gỡ field legacy.
      // Nếu BuffService không inject (constructor 3-arg backward-compat), skip
      // — legacy field vẫn cover.
      if (penalty.taoMaActive && penalty.taoMaExpiresAt && this.buffs) {
        await this.buffs.applyBuffTx(
          tx,
          characterId,
          'debuff_taoma',
          'tribulation',
          now,
          penalty.taoMaExpiresAt,
        );
      }

      const log = await tx.tribulationAttemptLog.create({
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
          hpInitial: character.hpMax,
          expBefore: character.exp,
          expAfter: penalty.expAfter,
          expLoss,
          taoMaActive: penalty.taoMaActive,
          taoMaExpiresAt: penalty.taoMaActive ? penalty.taoMaExpiresAt : null,
          cooldownAt: penalty.cooldownAt,
          linhThachReward: 0,
          expBonusReward: 0n,
          titleKeyReward: null,
          attemptIndex,
          taoMaRoll,
        },
      });

      return {
        success: false,
        tribulationKey: def.key,
        fromRealmKey: def.fromRealmKey,
        toRealmKey: def.toRealmKey,
        severity: def.severity,
        type: def.type,
        wavesCompleted: sim.wavesCompleted,
        totalDamage: sim.totalDamage,
        finalHp: sim.finalHp,
        attemptIndex,
        reward: null,
        penalty: {
          expBefore: character.exp,
          expAfter: penalty.expAfter,
          expLoss,
          cooldownAt: penalty.cooldownAt,
          taoMaActive: penalty.taoMaActive,
          taoMaExpiresAt: penalty.taoMaExpiresAt,
        },
        logId: log.id,
      };
    });
  }
}

export interface TribulationAttemptOutcome {
  success: boolean;
  tribulationKey: string;
  fromRealmKey: string;
  toRealmKey: string;
  severity: TribulationDef['severity'];
  type: TribulationDef['type'];
  wavesCompleted: number;
  totalDamage: number;
  finalHp: number;
  attemptIndex: number;
  reward: {
    linhThach: number;
    expBonus: bigint;
    titleKey: string | null;
  } | null;
  penalty: {
    expBefore: bigint;
    expAfter: bigint;
    expLoss: bigint;
    cooldownAt: Date;
    taoMaActive: boolean;
    taoMaExpiresAt: Date | null;
  } | null;
  logId: string;
}

export class TribulationError extends Error {
  constructor(
    public code:
      | 'CHARACTER_NOT_FOUND'
      | 'NOT_AT_PEAK'
      | 'NO_NEXT_REALM'
      | 'NO_TRIBULATION_FOR_TRANSITION'
      | 'COOLDOWN_ACTIVE'
      | 'INVALID_RNG',
  ) {
    super(code);
  }
}
