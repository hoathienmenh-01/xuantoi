import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  CULTIVATION_TICK_BASE_EXP,
  STAMINA_REGEN_PER_TICK,
  cultivationRateForRealm,
  expCostForStage,
  type CultivateTickPayload,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CULTIVATION_QUEUE } from './cultivation.queue';

@Processor(CULTIVATION_QUEUE)
export class CultivationProcessor extends WorkerHost {
  private readonly logger = new Logger(CultivationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
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
        const gain = BigInt(realmRate + Math.floor(c.spirit / 4));
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
