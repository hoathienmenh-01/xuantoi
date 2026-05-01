import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CharacterService } from './character.service';
import { SpiritualRootService } from './spiritual-root.service';
import {
  CultivationMethodError,
  CultivationMethodService,
} from './cultivation-method.service';
import { AuthService } from '../auth/auth.service';
import {
  InMemorySlidingWindowRateLimiter,
  type RateLimiter,
} from '../../common/rate-limiter';

const ACCESS_COOKIE = 'xt_access';

/**
 * Anti-scrape rate limit cho `GET /character/profile/:id`.
 *
 * 120 request/IP/15 phút. Đủ lớn cho các flow bình thường (leaderboard 50
 * tên tập đoàn + chat tap-name + boss damage list) nhưng đủ chặt để chặn
 * enumerate cuid để tìm hết player. Cùng pattern với PR #60 (`POST /auth/register`).
 */
export const PROFILE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PROFILE_RATE_LIMIT_MAX = 120;
export const PROFILE_RATE_LIMITER = 'CHARACTER_PROFILE_RATE_LIMITER';

const OnboardInput = z.object({
  name: z
    .string()
    .min(3)
    .max(16)
    .regex(/^[A-Za-zÀ-ỹ0-9._]+$/),
  sectKey: z.enum(['thanh_van', 'huyen_thuy', 'tu_la']),
});

const CultivateInput = z.object({
  cultivating: z.boolean(),
});

const CultivationMethodEquipInput = z.object({
  methodKey: z.string().min(1).max(64),
});

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('character')
export class CharacterController {
  private readonly profileLimiter: RateLimiter;

  constructor(
    private readonly chars: CharacterService,
    private readonly auth: AuthService,
    @Optional() private readonly spiritualRoot?: SpiritualRootService,
    @Optional() private readonly cultivationMethod?: CultivationMethodService,
    @Optional() @Inject(PROFILE_RATE_LIMITER) profileLimiter?: RateLimiter,
  ) {
    this.profileLimiter =
      profileLimiter ??
      new InMemorySlidingWindowRateLimiter(
        PROFILE_RATE_LIMIT_WINDOW_MS,
        PROFILE_RATE_LIMIT_MAX,
      );
  }

  private async requireUserId(req: Request): Promise<string> {
    const id = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!id) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    return id;
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    const character = await this.chars.findByUser(userId);
    return { ok: true, data: { character } };
  }

  @Get('profile/:id')
  async profile(@Req() req: Request, @Param('id') id: string) {
    // Yêu cầu phải đăng nhập để xem profile (anti-scrape lớp 1).
    await this.requireUserId(req);
    // Per-IP rate limit (lớp 2): chặn enumerate cuid hàng loạt.
    const ip = req.ip ?? 'unknown';
    const limit = await this.profileLimiter.check(`ip:${ip}`);
    if (!limit.allowed) fail('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    const profile = await this.chars.findPublicProfile(id);
    if (!profile) fail('NOT_FOUND', HttpStatus.NOT_FOUND);
    return { ok: true, data: { profile } };
  }

  @Get('state')
  async state(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    return { ok: true, data: { character } };
  }

  @Post('onboard')
  @HttpCode(200)
  async onboard(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    const parsed = OnboardInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');

    try {
      const character = await this.chars.onboard(userId, parsed.data);
      return { ok: true, data: { character } };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'NAME_TAKEN') fail('NAME_TAKEN', HttpStatus.CONFLICT);
      if (code === 'ALREADY_ONBOARDED') fail('ALREADY_ONBOARDED', HttpStatus.CONFLICT);
      throw e;
    }
  }

  @Post('cultivate')
  @HttpCode(200)
  async cultivate(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    const parsed = CultivateInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const character = await this.chars.setCultivating(userId, parsed.data.cultivating);
      return { ok: true, data: { character } };
    } catch (e) {
      if ((e as { code?: string })?.code === 'NO_CHARACTER') {
        fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
      }
      throw e;
    }
  }

  @Post('breakthrough')
  @HttpCode(200)
  async breakthrough(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    try {
      const character = await this.chars.breakthrough(userId);
      return { ok: true, data: { character } };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'NO_CHARACTER') fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
      if (code === 'NOT_AT_PEAK') fail('NOT_AT_PEAK', HttpStatus.CONFLICT);
      throw e;
    }
  }

  /**
   * Phase 11.3.A — Đọc state Linh căn / Spiritual Root server-authoritative.
   * Nếu character pre-Phase 11.3 (legacy) thì lazy-roll lần đầu (idempotent).
   */
  @Get('spiritual-root')
  async spiritualRootState(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    if (!this.spiritualRoot) {
      fail('SPIRITUAL_ROOT_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    const state = await this.spiritualRoot.getState(character.id);
    return { ok: true, data: { spiritualRoot: state } };
  }

  /**
   * Phase 11.1.B — Đọc state công pháp (Cultivation Method) đã học + đang
   * equip. Auto-grant + auto-equip starter `khai_thien_quyet` cho legacy
   * character (idempotent qua `getState`).
   */
  @Get('cultivation-method')
  async cultivationMethodState(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    if (!this.cultivationMethod) {
      fail('CULTIVATION_METHOD_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    const state = await this.cultivationMethod.getState(character.id);
    return { ok: true, data: { cultivationMethod: state } };
  }

  /**
   * Phase 11.1.B — Equip công pháp đã học. Validate ownership + realm/sect/
   * forbiddenElement + đổi `Character.equippedCultivationMethodKey`.
   */
  @Post('cultivation-method/equip')
  @HttpCode(200)
  async cultivationMethodEquip(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.cultivationMethod) {
      fail('CULTIVATION_METHOD_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const parsed = CultivationMethodEquipInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');

    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);

    try {
      const state = await this.cultivationMethod.equip(
        character.id,
        parsed.data.methodKey,
      );
      return { ok: true, data: { cultivationMethod: state } };
    } catch (e) {
      if (e instanceof CultivationMethodError) {
        const httpStatus =
          e.code === 'METHOD_NOT_FOUND' || e.code === 'CHARACTER_NOT_FOUND'
            ? HttpStatus.NOT_FOUND
            : HttpStatus.CONFLICT;
        fail(e.code, httpStatus);
      }
      throw e;
    }
  }
}
