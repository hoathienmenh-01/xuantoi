/**
 * Pure-unit failure-path tests cho `HealthController.readyz`.
 *
 * Lý do: `health.controller.test.ts` cũ chỉ cover happy path (DB+Redis live)
 * — yêu cầu real Postgres/Redis. Production readiness cần lock-in luôn 503
 * envelope khi dependency down (DB fail / Redis fail / Redis non-PONG /
 * cả hai fail) để khỏi sai khi rotate connection / restart cluster /
 * blue-green cutover.
 *
 * Pure-unit = mock Prisma `$queryRaw` + Redis `ping` → có thể chạy không
 * cần infra:up (CI service không cần khởi động chỉ để smoke-test failure
 * branch).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { HealthController } from './health.controller';
import { PrismaService } from '../../common/prisma.service';

interface FakeRes {
  status: (s: number) => FakeRes;
  _statusCode: number;
}

function makeFakeRes(): FakeRes {
  const res: FakeRes = {
    _statusCode: 200,
    status(s: number) {
      this._statusCode = s;
      return this;
    },
  };
  return res;
}

function makeCtrl(opts: {
  dbOk: boolean | Error;
  redisOk: boolean | 'NOT_PONG' | Error;
}): HealthController {
  const prisma = {
    $queryRaw: vi.fn(async () => {
      if (opts.dbOk instanceof Error) throw opts.dbOk;
      if (opts.dbOk === false) throw new Error('connect ECONNREFUSED');
      return [{ '?column?': 1 }];
    }),
  } as unknown as PrismaService;

  const redis = {
    ping: vi.fn(async () => {
      if (opts.redisOk instanceof Error) throw opts.redisOk;
      if (opts.redisOk === 'NOT_PONG') return 'WRONG';
      if (opts.redisOk === false) throw new Error('redis offline');
      return 'PONG';
    }),
  } as unknown as Redis;

  return new HealthController(prisma, redis);
}

describe('HealthController.readyz failure paths (pure unit)', () => {
  it('cả DB + Redis ok → out.ok=true, không gọi res.status()', async () => {
    const ctrl = makeCtrl({ dbOk: true, redisOk: true });
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.ok).toBe(true);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.ok).toBe(true);
    expect(typeof r.checks.db.latencyMs).toBe('number');
    expect(typeof r.checks.redis.latencyMs).toBe('number');
    expect(r.checks.db.error).toBeUndefined();
    expect(r.checks.redis.error).toBeUndefined();
    expect(res._statusCode).toBe(200);
  });

  it('DB throw → out.ok=false, db.ok=false, db.error set, status 503', async () => {
    const ctrl = makeCtrl({ dbOk: new Error('db down: ECONNREFUSED'), redisOk: true });
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.ok).toBe(false);
    expect(r.checks.db.ok).toBe(false);
    expect(r.checks.db.error).toContain('db down');
    expect(typeof r.checks.db.latencyMs).toBe('number');
    expect(r.checks.redis.ok).toBe(true);
    expect(res._statusCode).toBe(503);
  });

  it('Redis throw → out.ok=false, redis.ok=false, redis.error set, status 503', async () => {
    const ctrl = makeCtrl({ dbOk: true, redisOk: new Error('redis offline') });
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.ok).toBe(false);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.ok).toBe(false);
    expect(r.checks.redis.error).toContain('redis offline');
    expect(typeof r.checks.redis.latencyMs).toBe('number');
    expect(res._statusCode).toBe(503);
  });

  it('Redis ping trả non-PONG → out.ok=false, redis.ok=false, KHÔNG có error field, status 503', async () => {
    // Edge case: Redis trả response lạ (vd cluster failover sai key, proxy
    // intercept). ping() resolve nhưng != "PONG" → readiness fail nhưng
    // không phải exception → error field undefined.
    const ctrl = makeCtrl({ dbOk: true, redisOk: 'NOT_PONG' });
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.ok).toBe(false);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.ok).toBe(false);
    expect(r.checks.redis.error).toBeUndefined();
    expect(typeof r.checks.redis.latencyMs).toBe('number');
    expect(res._statusCode).toBe(503);
  });

  it('cả DB + Redis fail → cả 2 ok=false + error set + status 503 (idempotent)', async () => {
    const ctrl = makeCtrl({
      dbOk: new Error('db boom'),
      redisOk: new Error('redis boom'),
    });
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.ok).toBe(false);
    expect(r.checks.db.ok).toBe(false);
    expect(r.checks.db.error).toBe('db boom');
    expect(r.checks.redis.ok).toBe(false);
    expect(r.checks.redis.error).toBe('redis boom');
    expect(res._statusCode).toBe(503);
  });

  it('DB throw non-Error (string) → error field stringify, không crash', async () => {
    // Branch coverage cho ternary `e instanceof Error ? e.message : String(e)`.
    const prisma = {
      $queryRaw: vi.fn(async () => {
        throw 'plain string err';
      }),
    } as unknown as PrismaService;
    const redis = {
      ping: vi.fn(async () => 'PONG'),
    } as unknown as Redis;
    const ctrl = new HealthController(prisma, redis);
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.checks.db.ok).toBe(false);
    expect(r.checks.db.error).toBe('plain string err');
    expect(res._statusCode).toBe(503);
  });

  it('Redis throw non-Error (object) → error field stringify, không crash', async () => {
    const prisma = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const redis = {
      ping: vi.fn(async () => {
        throw { code: 'ETIMEDOUT' };
      }),
    } as unknown as Redis;
    const ctrl = new HealthController(prisma, redis);
    const res = makeFakeRes();
    const r = await ctrl.ready(res as unknown as Response);
    expect(r.checks.redis.ok).toBe(false);
    expect(r.checks.redis.error).toBe('[object Object]');
    expect(res._statusCode).toBe(503);
  });

  it('healthz trả ok + uptimeMs >= 0 + ts ISO (pure unit)', () => {
    const ctrl = makeCtrl({ dbOk: true, redisOk: true });
    const r = ctrl.health();
    expect(r.ok).toBe(true);
    expect(typeof r.uptimeMs).toBe('number');
    expect(r.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof r.ts).toBe('string');
    expect(() => new Date(r.ts)).not.toThrow();
    expect(new Date(r.ts).toISOString()).toBe(r.ts);
  });

  it('version env override → APP_VERSION + GIT_SHA reflected', () => {
    const original = { v: process.env.APP_VERSION, sha: process.env.GIT_SHA };
    process.env.APP_VERSION = '1.2.3-test';
    process.env.GIT_SHA = 'deadbeef';
    try {
      const ctrl = makeCtrl({ dbOk: true, redisOk: true });
      const v = ctrl.version();
      expect(v.version).toBe('1.2.3-test');
      expect(v.commit).toBe('deadbeef');
      expect(v.name).toBe('@xuantoi/api');
      expect(v.node).toMatch(/^v\d+/);
      expect(() => new Date(v.ts)).not.toThrow();
    } finally {
      if (original.v === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = original.v;
      if (original.sha === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = original.sha;
    }
  });

  it('version default fallback khi env chưa set', () => {
    const original = { v: process.env.APP_VERSION, sha: process.env.GIT_SHA };
    delete process.env.APP_VERSION;
    delete process.env.GIT_SHA;
    try {
      const ctrl = makeCtrl({ dbOk: true, redisOk: true });
      const v = ctrl.version();
      expect(v.version).toBe('0.0.1');
      expect(v.commit).toBe('unknown');
    } finally {
      if (original.v !== undefined) process.env.APP_VERSION = original.v;
      if (original.sha !== undefined) process.env.GIT_SHA = original.sha;
    }
  });
});
