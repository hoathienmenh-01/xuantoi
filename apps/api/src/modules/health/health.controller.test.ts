import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import IORedis from 'ioredis';
import { HealthController } from './health.controller';
import { PrismaService } from '../../common/prisma.service';
import { TEST_DATABASE_URL } from '../../test-helpers';

let prisma: PrismaService;
let redis: InstanceType<typeof IORedis>;
let ctrl: HealthController;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  ctrl = new HealthController(prisma, redis);
});

afterAll(async () => {
  await prisma?.$disconnect();
  await redis?.quit();
});

describe('HealthController', () => {
  it('healthz trả ok + uptimeMs', () => {
    const r = ctrl.health();
    expect(r.ok).toBe(true);
    expect(typeof r.uptimeMs).toBe('number');
    expect(r.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('readyz check DB + Redis trả ok khi cả 2 reachable', async () => {
    let statusCode = 200;
    const res = {
      status(s: number) {
        statusCode = s;
        return res;
      },
    } as unknown as import('express').Response;
    const r = await ctrl.ready(res);
    expect(r.ok).toBe(true);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.ok).toBe(true);
    expect(statusCode).toBe(200);
  });

  it('version trả tên app + node version', () => {
    const v = ctrl.version();
    expect(v.name).toBe('@xuantoi/api');
    expect(v.node).toMatch(/^v\d+/);
    expect(typeof v.version).toBe('string');
  });
});
