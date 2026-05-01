import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  CULTIVATION_TICK_BASE_EXP,
  CULTIVATION_TICK_MS,
  SPIRITUAL_ROOT_GRADES,
  STAMINA_REGEN_PER_TICK,
  cultivationRateForRealm,
  expCostForStage,
  getSpiritualRootGradeDef,
  type CultivateTickPayload,
  type SpiritualRootGrade,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MissionService } from '../mission/mission.service';
import { methodExpMultiplierFor } from '../character/cultivation-method.service';
import { CULTIVATION_QUEUE } from './cultivation.queue';

/**
 * Phase 11.3.C narrowing helper — kiểm tra Prisma trả về `string | null` có
 * khớp catalog `SPIRITUAL_ROOT_GRADES` không. Legacy character pre-Phase
 * 11.3 sẽ có `spiritualRootGrade=null` → return false → multiplier 1.0.
 */
function isValidSpiritualRootGrade(
  grade: string | null,
): grade is SpiritualRootGrade {
  return grade !== null && (SPIRITUAL_ROOT_GRADES as readonly string[]).includes(grade);
}

@Processor(CULTIVATION_QUEUE)
export class CultivationProcessor extends WorkerHost {
  private readonly logger = new Logger(CultivationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly missions: MissionService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'tick') return;

    // Hồi stamina cho TẤT CẢ character (kể cả không tu luyện): +N mỗi tick, cap = staminaMax.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Character" SET stamina = LEAST("staminaMax", stamina + $1) WHERE stamina < "staminaMax"`,
      STAMINA_REGEN_PER_TICK,
    );

    const cultivating = await this.prisma.character.findMany({
      where: { cultivating: true },
      select: {
        id: true,
        userId: true,
        realmKey: true,
        realmStage: true,
        exp: true,
        spirit: true,
        spiritualRootGrade: true,
        equippedCultivationMethodKey: true,
      },
    });
    if (cultivating.length === 0) return;

    for (const c of cultivating) {
      try {
        // EXP gain = rateForRealm(realm) + floor(spirit/4).
        // rateForRealm scale 1.45^order → tu luyện ở cảnh giới cao có base rate
        // cao hơn, bù lại expCostForStage cũng cao hơn.
        const realmRate = cultivationRateForRealm(
          c.realmKey,
          CULTIVATION_TICK_BASE_EXP,
        );
        const baseGain = realmRate + Math.floor(c.spirit / 4);
        // Phase 11.3.C — Linh căn cultivationMultiplier wire.
        // Legacy character (spiritualRootGrade=null) → multiplier=1.0 → backward-compat.
        const cultivationMul = isValidSpiritualRootGrade(c.spiritualRootGrade)
          ? getSpiritualRootGradeDef(c.spiritualRootGrade).cultivationMultiplier
          : 1.0;
        // Phase 11.1.B — Công pháp (CultivationMethod) `expMultiplier` wire.
        // Compose với linh căn cultivationMul. Legacy character (no method
        // equipped) → methodMul=1.0 → backward-compat.
        const methodMul = methodExpMultiplierFor(c.equippedCultivationMethodKey);
        const gain = BigInt(
          Math.max(1, Math.round(baseGain * cultivationMul * methodMul)),
        );
        let exp = c.exp + gain;
        let realmKey = c.realmKey;
        let realmStage = c.realmStage;
        let brokeThrough = false;

        // Auto break-through trong cùng cảnh giới (stage < 9). Stage 9 cần thủ công.
        let cap = expCostForStage(realmKey, realmStage);
        while (cap !== null && exp >= cap && realmStage < 9) {
          exp -= cap;
          realmStage += 1;
          brokeThrough = true;
          cap = expCostForStage(realmKey, realmStage);
        }

        await this.prisma.character.update({
          where: { id: c.id },
          data: { exp, realmStage },
        });

        // Mission tracking — mỗi tick cộng seconds và exp gained. Không throw
        // nếu MissionService lỗi — tu luyện là core loop, không để mission
        // chặn EXP gain.
        try {
          await this.missions.track(
            c.id,
            'CULTIVATE_SECONDS',
            Math.round(CULTIVATION_TICK_MS / 1000),
          );
          await this.missions.track(c.id, 'GAIN_EXP', Number(gain));
          if (brokeThrough) {
            await this.missions.track(c.id, 'BREAKTHROUGH', 1);
          }
        } catch (e) {
          this.logger.warn(
            `mission track failed for char=${c.id}: ${(e as Error).message}`,
          );
        }

        const expNext = expCostForStage(realmKey, realmStage);
        const payload: CultivateTickPayload = {
          characterId: c.id,
          expGained: gain.toString(),
          exp: exp.toString(),
          expNext: (expNext ?? 0n).toString(),
          realmKey,
          realmStage,
          brokeThrough,
        };
        this.realtime.emitToUser(c.userId, 'cultivate:tick', payload);
      } catch (e) {
        this.logger.error(`tick failed for char=${c.id}: ${(e as Error).message}`);
      }
    }
  }
}
