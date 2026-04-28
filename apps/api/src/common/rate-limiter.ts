import type { Redis } from 'ioredis';

/**
 * Sliding-window rate limiter. Cùng interface cho 2 backend:
 *  - Redis (dùng cho production, phân tán giữa các api instance).
 *  - In-memory (dùng cho test & fallback khi Redis không khả dụng).
 *
 * Mỗi `check(key)` ghi nhận 1 lần hit ở thời điểm hiện tại, dọn các hit
 * cũ hơn `windowMs`, rồi so sánh tổng số hit còn lại với `max`.
 *
 * `allowed = count <= max` — hit hiện tại đã được tính vào `count`, nên
 * hit thứ (max+1) sẽ bị từ chối.
 */
export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

export class RedisSlidingWindowRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly windowMs: number,
    private readonly max: number,
    private readonly prefix: string,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const winStart = now - this.windowMs;
    const k = `${this.prefix}:${key}`;
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(k, 0, winStart);
    pipeline.zadd(k, now, member);
    pipeline.zcard(k);
    pipeline.pexpire(k, this.windowMs + 1000);
    const res = await pipeline.exec();
    // exec() trả Array<[err, result]>; lấy phần `zcard` (chỉ số 2).
    const rawCount = res?.[2]?.[1];
    const count =
      typeof rawCount === 'number'
        ? rawCount
        : typeof rawCount === 'string'
          ? Number(rawCount)
          : 0;
    return { allowed: count <= this.max, count };
  }
}

export class InMemorySlidingWindowRateLimiter implements RateLimiter {
  private readonly store = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const winStart = now - this.windowMs;
    const arr = (this.store.get(key) ?? []).filter((t) => t > winStart);
    arr.push(now);
    this.store.set(key, arr);
    // Cắt ngắn list nếu quá dài để tránh phình (phòng spam).
    if (arr.length > this.max * 4) {
      arr.splice(0, arr.length - this.max * 2);
    }
    return { allowed: arr.length <= this.max, count: arr.length };
  }

  /** Chỉ dùng trong test — reset toàn bộ state. */
  clear(): void {
    this.store.clear();
  }
}
