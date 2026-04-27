import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CULTIVATION_TICK_MS } from '@xuantoi/shared';
import { CULTIVATION_QUEUE } from './cultivation.module';

@Injectable()
export class CultivationService {
  private readonly logger = new Logger(CultivationService.name);

  constructor(@InjectQueue(CULTIVATION_QUEUE) private readonly queue: Queue) {}

  async scheduleRecurring(): Promise<void> {
    // Hủy job lặp cũ rồi đăng ký mới — tick mỗi CULTIVATION_TICK_MS.
    const repeatable = await this.queue.getRepeatableJobs();
    for (const j of repeatable) {
      if (j.name === 'tick') await this.queue.removeRepeatableByKey(j.key);
    }
    await this.queue.add(
      'tick',
      {},
      {
        repeat: { every: CULTIVATION_TICK_MS },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    );
    this.logger.log(`Cultivation tick scheduled every ${CULTIVATION_TICK_MS}ms`);
  }
}
