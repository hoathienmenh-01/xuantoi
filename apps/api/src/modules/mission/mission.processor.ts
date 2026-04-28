import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MissionService } from './mission.service';
import { MISSION_QUEUE } from './mission.queue';

/**
 * Reset mission job — chạy mỗi 10 phút, quét row có `windowEnd <= now` cho
 * cả DAILY lẫn WEEKLY. Mission ONCE không được reset.
 */
@Processor(MISSION_QUEUE)
export class MissionProcessor extends WorkerHost {
  private readonly logger = new Logger(MissionProcessor.name);

  constructor(private readonly missions: MissionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'reset') return;
    try {
      const daily = await this.missions.resetPeriod('DAILY');
      const weekly = await this.missions.resetPeriod('WEEKLY');
      if (daily + weekly > 0) {
        this.logger.log(
          `mission reset — daily=${daily} weekly=${weekly}`,
        );
      }
    } catch (e) {
      this.logger.error(`mission reset failed: ${(e as Error).message}`);
      throw e;
    }
  }
}
