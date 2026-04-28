import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import IORedis, { Redis } from 'ioredis';
import {
  InMemorySlidingWindowRateLimiter,
  RedisSlidingWindowRateLimiter,
} from './rate-limiter';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('InMemorySlidingWindowRateLimiter', () => {
  it('cho phép đủ max hit, từ chối hit thứ (max+1)', async () => {
    const rl = new InMemorySlidingWindowRateLimiter(1000, 3);
    const a1 = await rl.check('k');
    await rl.check('k');
    const a3 = await rl.check('k');
    const a4 = await rl.check('k');
    expect(a1.allowed).toBe(true);
    expect(a3.allowed).toBe(true);
    expect(a3.count).toBe(3);
    expect(a4.allowed).toBe(false);
    expect(a4.count).toBe(4);
  });

  it('window trượt: sau khi timeout hit cũ được dọn', async () => {
    const rl = new InMemorySlidingWindowRateLimiter(30, 2);
    await rl.check('k');
    await rl.check('k');
    expect((await rl.check('k')).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    const after = await rl.check('k');
    expect(after.allowed).toBe(true);
    expect(after.count).toBe(1);
  });

  it('key khác nhau đếm riêng', async () => {
    const rl = new InMemorySlidingWindowRateLimiter(1000, 1);
    expect((await rl.check('a')).allowed).toBe(true);
    expect((await rl.check('a')).allowed).toBe(false);
    expect((await rl.check('b')).allowed).toBe(true);
  });
});

describe('RedisSlidingWindowRateLimiter (real Redis)', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('cho phép đủ max hit, từ chối hit thứ (max+1) qua Redis', async () => {
    const rl = new RedisSlidingWindowRateLimiter(redis, 1000, 3, 'rl:test');
    expect((await rl.check('k')).allowed).toBe(true);
    expect((await rl.check('k')).allowed).toBe(true);
    const a3 = await rl.check('k');
    expect(a3.allowed).toBe(true);
    expect(a3.count).toBe(3);
    const a4 = await rl.check('k');
    expect(a4.allowed).toBe(false);
    expect(a4.count).toBe(4);
  });

  it('window trượt qua Redis: hit cũ bị ZREMRANGEBYSCORE dọn', async () => {
    const rl = new RedisSlidingWindowRateLimiter(redis, 40, 2, 'rl:test');
    await rl.check('k');
    await rl.check('k');
    expect((await rl.check('k')).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    const after = await rl.check('k');
    expect(after.allowed).toBe(true);
    expect(after.count).toBe(1);
  });

  it('set expire để key không tồn tại mãi (pexpire)', async () => {
    const rl = new RedisSlidingWindowRateLimiter(redis, 80, 5, 'rl:test');
    await rl.check('k');
    const ttl = await redis.pttl('rl:test:k');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(80 + 1000);
  });

  it('prefix cách ly giữa các limiter', async () => {
    const rlA = new RedisSlidingWindowRateLimiter(redis, 1000, 1, 'rl:a');
    const rlB = new RedisSlidingWindowRateLimiter(redis, 1000, 1, 'rl:b');
    expect((await rlA.check('same')).allowed).toBe(true);
    expect((await rlA.check('same')).allowed).toBe(false);
    // rlB có prefix khác nên key độc lập.
    expect((await rlB.check('same')).allowed).toBe(true);
  });
});
