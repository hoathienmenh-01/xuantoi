import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import {
  LOGIN_ATTEMPT_TTL_DAYS,
  OPS_QUEUE,
  REFRESH_TOKEN_STALE_TTL_DAYS,
} from './ops.queue';

/**
 * Prune job — chạy 24h/lần:
 *  1. Xoá `LoginAttempt` cũ > 90 ngày (audit brute-force không cần giữ lâu).
 *  2. Xoá `RefreshToken` đã hết hạn > 30 ngày HOẶC đã revoke > 30 ngày.
 *
 * Giữ lại (không prune):
 *  - CurrencyLedger (audit trail tiền — pháp lý, giữ mãi)
 *  - AdminAuditLog (audit admin action — giữ mãi)
 *  - ChatMessage (scope retention phase sau)
 */
@Processor(OPS_QUEUE)
export class OpsProcessor extends WorkerHost {
  private readonly logger = new Logger(OpsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'prune') return;

    const loginAttemptCutoff = new Date(
      Date.now() - LOGIN_ATTEMPT_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const refreshTokenCutoff = new Date(
      Date.now() - REFRESH_TOKEN_STALE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const deletedAttempts = await this.prisma.loginAttempt.deleteMany({
        where: { createdAt: { lt: loginAttemptCutoff } },
      });

      const deletedRefresh = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: refreshTokenCutoff } },
            { revokedAt: { lt: refreshTokenCutoff } },
          ],
        },
      });

      this.logger.log(
        `prune done — LoginAttempt: ${deletedAttempts.count}, RefreshToken: ${deletedRefresh.count}`,
      );
    } catch (e) {
      this.logger.error(`prune failed: ${(e as Error).message}`);
      throw e; // BullMQ sẽ log + requeue nếu retry policy cho phép.
    }
  }
}
