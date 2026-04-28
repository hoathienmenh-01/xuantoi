import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { OPS_PRUNE_INTERVAL_MS, OPS_QUEUE } from './ops.queue';

@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);

  constructor(@InjectQueue(OPS_QUEUE) private readonly queue: Queue) {}

  async scheduleRecurring(): Promise<void> {
    // Dọn sạch job lặp cũ (tránh ghost khi thay đổi interval).
    const repeatable = await this.queue.getRepeatableJobs();
    for (const j of repeatable) {
      if (j.name === 'prune') await this.queue.removeRepeatableByKey(j.key);
    }
    await this.queue.add(
      'prune',
      {},
      {
        repeat: { every: OPS_PRUNE_INTERVAL_MS },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    );
    this.logger.log(`Ops prune scheduled every ${OPS_PRUNE_INTERVAL_MS}ms`);
  }
}
