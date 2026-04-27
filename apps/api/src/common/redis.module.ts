import { Global, Module } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

const redisFactory = {
  provide: REDIS_CONNECTION,
  useFactory: (): Redis => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    return new IORedis(url, { maxRetriesPerRequest: null });
  },
};

@Global()
@Module({
  providers: [redisFactory],
  exports: [redisFactory],
})
export class RedisModule {}

export type { Redis };
