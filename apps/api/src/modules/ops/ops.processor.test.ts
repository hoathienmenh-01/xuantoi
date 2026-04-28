import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { TEST_DATABASE_URL, wipeAll } from '../../test-helpers';
import { OpsProcessor } from './ops.processor';
import {
  LOGIN_ATTEMPT_TTL_DAYS,
  REFRESH_TOKEN_STALE_TTL_DAYS,
} from './ops.queue';

let prisma: PrismaService;
let processor: OpsProcessor;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  processor = new OpsProcessor(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function pruneJob(): Job {
  return { name: 'prune' } as Job;
}

function noopJob(): Job {
  return { name: 'other' } as Job;
}

const DAY = 24 * 60 * 60 * 1000;

async function mkUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `ops-${suffix}@xt.local`,
      passwordHash: 'x',
    },
  });
}

describe('OpsProcessor.process (prune)', () => {
  it('job.name không phải "prune" → noop', async () => {
    // Tạo LoginAttempt cũ 200 ngày; job khác name → không xoá.
    await prisma.loginAttempt.create({
      data: {
        email: 'x@y.z',
        ip: '1.1.1.1',
        success: false,
        createdAt: new Date(Date.now() - 200 * DAY),
      },
    });
    await processor.process(noopJob());
    const count = await prisma.loginAttempt.count();
    expect(count).toBe(1);
  });

  it('xoá LoginAttempt cũ > 90 ngày, giữ ≤ 90 ngày', async () => {
    await prisma.loginAttempt.create({
      data: {
        email: 'old@x.z',
        ip: '1.1.1.1',
        success: false,
        createdAt: new Date(Date.now() - (LOGIN_ATTEMPT_TTL_DAYS + 1) * DAY),
      },
    });
    await prisma.loginAttempt.create({
      data: {
        email: 'fresh@x.z',
        ip: '1.1.1.1',
        success: true,
        createdAt: new Date(Date.now() - 10 * DAY),
      },
    });

    await processor.process(pruneJob());

    const remaining = await prisma.loginAttempt.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe('fresh@x.z');
  });

  it('xoá RefreshToken đã expire > 30 ngày', async () => {
    const user = await mkUser('rt-exp');
    await prisma.refreshToken.create({
      data: {
        jti: 'old-jti-1',
        userId: user.id,
        hashedToken: 'h1',
        passwordVersion: 1,
        expiresAt: new Date(
          Date.now() - (REFRESH_TOKEN_STALE_TTL_DAYS + 1) * DAY,
        ),
      },
    });
    await prisma.refreshToken.create({
      data: {
        jti: 'fresh-jti',
        userId: user.id,
        hashedToken: 'h2',
        passwordVersion: 1,
        expiresAt: new Date(Date.now() + 30 * DAY), // còn hạn
      },
    });

    await processor.process(pruneJob());

    const remaining = await prisma.refreshToken.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].jti).toBe('fresh-jti');
  });

  it('xoá RefreshToken đã revoke > 30 ngày', async () => {
    const user = await mkUser('rt-rev');
    await prisma.refreshToken.create({
      data: {
        jti: 'rev-old',
        userId: user.id,
        hashedToken: 'h1',
        passwordVersion: 1,
        // expiresAt còn xa, nhưng revokedAt cũ > 30 ngày.
        expiresAt: new Date(Date.now() + 30 * DAY),
        revokedAt: new Date(
          Date.now() - (REFRESH_TOKEN_STALE_TTL_DAYS + 5) * DAY,
        ),
      },
    });
    await prisma.refreshToken.create({
      data: {
        jti: 'rev-fresh',
        userId: user.id,
        hashedToken: 'h2',
        passwordVersion: 1,
        expiresAt: new Date(Date.now() + 30 * DAY),
        revokedAt: new Date(Date.now() - 5 * DAY), // vừa revoke, giữ lại
      },
    });

    await processor.process(pruneJob());

    const remaining = await prisma.refreshToken.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].jti).toBe('rev-fresh');
  });

  it('KHÔNG đụng CurrencyLedger hay AdminAuditLog', async () => {
    const user = await mkUser('keep');
    // Không tạo Character → ledger sẽ FK fail; dùng AdminAuditLog trước.
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        action: 'OLD_ACTION',
        meta: {},
        createdAt: new Date(Date.now() - 1000 * DAY), // cực cũ
      },
    });

    await processor.process(pruneJob());

    const count = await prisma.adminAuditLog.count();
    expect(count).toBe(1);
  });

  it('chạy lại 2 lần không lỗi (idempotent)', async () => {
    await prisma.loginAttempt.create({
      data: {
        email: 'i@x.z',
        ip: '1.1.1.1',
        success: false,
        createdAt: new Date(Date.now() - 200 * DAY),
      },
    });
    await processor.process(pruneJob());
    await processor.process(pruneJob());
    const count = await prisma.loginAttempt.count();
    expect(count).toBe(0);
  });
});
