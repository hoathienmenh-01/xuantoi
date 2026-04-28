import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  CharacterController,
  PROFILE_RATE_LIMITER,
  PROFILE_RATE_LIMIT_MAX,
  PROFILE_RATE_LIMIT_WINDOW_MS,
} from './character.controller';
import { CharacterService } from './character.service';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  InMemorySlidingWindowRateLimiter,
  RedisSlidingWindowRateLimiter,
  type RateLimiter,
} from '../../common/rate-limiter';
import { REDIS_CONNECTION } from '../../common/redis.module';

const profileLimiterProvider = {
  provide: PROFILE_RATE_LIMITER,
  inject: [{ token: REDIS_CONNECTION, optional: true }],
  useFactory: (redis?: Redis): RateLimiter => {
    if (redis) {
      return new RedisSlidingWindowRateLimiter(
        redis,
        PROFILE_RATE_LIMIT_WINDOW_MS,
        PROFILE_RATE_LIMIT_MAX,
        'rl:profile',
      );
    }
    return new InMemorySlidingWindowRateLimiter(
      PROFILE_RATE_LIMIT_WINDOW_MS,
      PROFILE_RATE_LIMIT_MAX,
    );
  },
};

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [CharacterController],
  providers: [CharacterService, CurrencyService, PrismaService, profileLimiterProvider],
  exports: [CharacterService, CurrencyService],
})
export class CharacterModule {}
