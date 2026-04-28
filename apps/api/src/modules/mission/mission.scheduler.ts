import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MISSION_QUEUE, MISSION_RESET_INTERVAL_MS } from './mission.queue';

@Injectable()
export class MissionScheduler implements OnModuleInit {
  private readonly logger = new Logger(MissionScheduler.name);

  constructor(@InjectQueue(MISSION_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Dọn sạch job lặp cũ (tránh ghost khi thay đổi interval).
    const repeatable = await this.queue.getRepeatableJobs();
    for (const j of repeatable) {
      if (j.name === 'reset') await this.queue.removeRepeatableByKey(j.key);
    }
    await this.queue.add(
      'reset',
      {},
      {
        repeat: { every: MISSION_RESET_INTERVAL_MS },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    );
    this.logger.log(
      `Mission reset scheduled every ${MISSION_RESET_INTERVAL_MS}ms`,
    );
  }
}
