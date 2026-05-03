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
import {
  CharacterSkillError,
  CharacterSkillService,
} from './character-skill.service';
import { GemError, GemService } from './gem.service';
import { RefineError, RefineService } from './refine.service';
import { TribulationError, TribulationService } from './tribulation.service';
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

const SkillKeyInput = z.object({
  skillKey: z.string().min(1).max(64),
});

const GemSocketInput = z.object({
  equipmentInventoryItemId: z.string().min(1).max(64),
  gemKey: z.string().min(1).max(64),
});

const GemUnsocketInput = z.object({
  equipmentInventoryItemId: z.string().min(1).max(64),
  slotIndex: z.number().int().min(0).max(3),
});

const GemCombineInput = z.object({
  srcGemKey: z.string().min(1).max(64),
});

const RefineEquipmentInput = z.object({
  equipmentInventoryItemId: z.string().min(1).max(64),
  useProtection: z.boolean().optional().default(false),
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
    @Optional() private readonly characterSkill?: CharacterSkillService,
    @Optional() private readonly gem?: GemService,
    @Optional() private readonly refine?: RefineService,
    @Optional() private readonly tribulation?: TribulationService,
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
      const code = (e as { code?: string })?.code;
      if (code === 'NO_CHARACTER') fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
      if (code === 'TAO_MA_ACTIVE') fail('TAO_MA_ACTIVE', HttpStatus.CONFLICT);
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
      if (code === 'TRIBULATION_REQUIRED')
        fail('TRIBULATION_REQUIRED', HttpStatus.CONFLICT);
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

  /**
   * Phase 11.2.B — Đọc state skill mastery (đã học + isEquipped + effective
   * atkScale/mpCost). Auto-grant `basic_attack` cho legacy character
   * (idempotent qua getState).
   */
  @Get('skill')
  async skillState(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    if (!this.characterSkill) {
      fail('CHARACTER_SKILL_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    const state = await this.characterSkill.getState(character.id);
    return { ok: true, data: { skill: state } };
  }

  /**
   * Phase 11.2.B — Equip skill đã học. Cap MAX_EQUIPPED_SKILLS = 4 (basic
   * attack ngoại lệ — luôn usable).
   */
  @Post('skill/equip')
  @HttpCode(200)
  async skillEquip(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.characterSkill) {
      fail('CHARACTER_SKILL_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const parsed = SkillKeyInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const state = await this.characterSkill.equip(
        character.id,
        parsed.data.skillKey,
      );
      return { ok: true, data: { skill: state } };
    } catch (e) {
      if (e instanceof CharacterSkillError) {
        fail(e.code, mapSkillErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.2.B — Unequip skill đã học.
   */
  @Post('skill/unequip')
  @HttpCode(200)
  async skillUnequip(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.characterSkill) {
      fail('CHARACTER_SKILL_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const parsed = SkillKeyInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const state = await this.characterSkill.unequip(
        character.id,
        parsed.data.skillKey,
      );
      return { ok: true, data: { skill: state } };
    } catch (e) {
      if (e instanceof CharacterSkillError) {
        fail(e.code, mapSkillErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.2.B — Upgrade mastery +1 level. Trừ LinhThach atomic. Throws
   * INSUFFICIENT_FUNDS, MASTERY_MAX, NOT_LEARNED.
   */
  @Post('skill/upgrade-mastery')
  @HttpCode(200)
  async skillUpgradeMastery(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.characterSkill) {
      fail('CHARACTER_SKILL_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    }
    const parsed = SkillKeyInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const result = await this.characterSkill.upgradeMastery(
        character.id,
        parsed.data.skillKey,
      );
      return { ok: true, data: { upgrade: result } };
    } catch (e) {
      if (e instanceof CharacterSkillError) {
        fail(e.code, mapSkillErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.4.B Gem MVP — khảm 1 gem vào equipment slot kế tiếp.
   * Server-authoritative: verify capacity (`socketCapacityForQuality`),
   * verify gem `compatibleSlots` ⊇ equipment slot, deduct 1 qty qua
   * `ItemLedger` reason `GEM_SOCKET`, append vào `sockets[]`.
   */
  @Post('gem/socket')
  @HttpCode(200)
  async gemSocket(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.gem) fail('GEM_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    const parsed = GemSocketInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const result = await this.gem.socketGem(
        character.id,
        parsed.data.equipmentInventoryItemId,
        parsed.data.gemKey,
      );
      return { ok: true, data: { socket: result } };
    } catch (e) {
      if (e instanceof GemError) {
        fail(e.code, mapGemErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.4.B Gem MVP — gỡ gem khỏi 1 slot. Gem qty về inventory unequipped row.
   */
  @Post('gem/unsocket')
  @HttpCode(200)
  async gemUnsocket(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.gem) fail('GEM_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    const parsed = GemUnsocketInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const result = await this.gem.unsocketGem(
        character.id,
        parsed.data.equipmentInventoryItemId,
        parsed.data.slotIndex,
      );
      return { ok: true, data: { unsocket: result } };
    } catch (e) {
      if (e instanceof GemError) {
        fail(e.code, mapGemErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.4.B Gem MVP — combine 3× gem cùng key thành 1× gem next-tier.
   * Deterministic: không RNG; THAN tier không combine được.
   */
  @Post('gem/combine')
  @HttpCode(200)
  async gemCombine(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.gem) fail('GEM_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    const parsed = GemCombineInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const result = await this.gem.combineGems(
        character.id,
        parsed.data.srcGemKey,
      );
      return { ok: true, data: { combine: result } };
    } catch (e) {
      if (e instanceof GemError) {
        fail(e.code, mapGemErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.5.B Refine MVP — luyện khí 1 attempt cho equipment.
   * Server-authoritative: verify cost (`linhThachCost` + `materialQty`),
   * roll deterministic RNG, apply outcome (success +1 / fail risky -1 / fail
   * extreme break = delete row), consume protection charm nếu trigger.
   * Tất cả qua `prisma.$transaction` + `ItemLedger`/`CurrencyLedger` audit.
   */
  @Post('refine')
  @HttpCode(200)
  async refineEquipment(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    if (!this.refine) fail('REFINE_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    const parsed = RefineEquipmentInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    const character = await this.chars.findByUser(userId);
    if (!character) fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
    try {
      const result = await this.refine.refineEquipment(
        character.id,
        parsed.data.equipmentInventoryItemId,
        parsed.data.useProtection,
      );
      return { ok: true, data: { refine: result } };
    } catch (e) {
      if (e instanceof RefineError) {
        fail(e.code, mapRefineErrorStatus(e.code));
      }
      throw e;
    }
  }

  /**
   * Phase 11.6.B Tribulation MVP — preview kiếp kế tiếp cho character.
   * Server trả về catalog def (`TribulationDef` reduced — đủ UI render
   * waves + reward). Trả null nếu không có kiếp.
   */
  @Get('tribulation/preview')
  async tribulationPreview(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    if (!this.tribulation) fail('TRIBULATION_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    const def = await this.tribulation.previewNext(userId);
    if (!def) return { ok: true, data: { tribulation: null } };
    return {
      ok: true,
      data: {
        tribulation: {
          key: def.key,
          name: def.name,
          description: def.description,
          fromRealmKey: def.fromRealmKey,
          toRealmKey: def.toRealmKey,
          severity: def.severity,
          type: def.type,
          waves: def.waves.map((w) => ({
            waveIndex: w.waveIndex,
            name: w.name,
            baseDamage: w.baseDamage,
            element: w.element,
            accuracyHint: w.accuracyHint,
          })),
          reward: {
            linhThach: def.reward.linhThach,
            expBonus: def.reward.expBonus.toString(),
            titleKey: def.reward.titleKey,
            uniqueDropChance: def.reward.uniqueDropChance,
            uniqueDropItemKey: def.reward.uniqueDropItemKey,
          },
          failurePenalty: def.failurePenalty,
        },
      },
    };
  }

  /**
   * Phase 11.6.B Tribulation MVP — attempt kiếp.
   * Server-authoritative deterministic simulation; ghi `TribulationAttempt`
   * + apply reward/penalty atomic; gate breakthrough qua `success=true` row.
   */
  @Post('tribulation/attempt')
  @HttpCode(200)
  async tribulationAttempt(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    if (!this.tribulation) fail('TRIBULATION_UNAVAILABLE', HttpStatus.NOT_IMPLEMENTED);
    try {
      const outcome = await this.tribulation.attemptTribulation(userId);
      return { ok: true, data: { outcome } };
    } catch (e) {
      if (e instanceof TribulationError) {
        fail(e.code, mapTribulationErrorStatus(e.code));
      }
      throw e;
    }
  }
}

/** Map GemError code → HTTP status. */
function mapGemErrorStatus(code: GemError['code']): HttpStatus {
  switch (code) {
    case 'GEM_NOT_FOUND':
    case 'EQUIPMENT_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'NOT_EQUIPPABLE':
    case 'GEM_INCOMPATIBLE_SLOT':
    case 'NO_SOCKET_CAPACITY':
    case 'SOCKETS_FULL':
    case 'NO_NEXT_TIER':
      return HttpStatus.CONFLICT;
    case 'INSUFFICIENT_QTY':
      return HttpStatus.CONFLICT;
    case 'INVALID_SLOT_INDEX':
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

/** Map TribulationError code → HTTP status. */
function mapTribulationErrorStatus(code: TribulationError['code']): HttpStatus {
  switch (code) {
    case 'NO_CHARACTER':
      return HttpStatus.NOT_FOUND;
    case 'NOT_AT_PEAK':
    case 'NO_TRIBULATION':
    case 'ALREADY_CLEARED':
    case 'IN_COOLDOWN':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

/** Map RefineError code → HTTP status. */
function mapRefineErrorStatus(code: RefineError['code']): HttpStatus {
  switch (code) {
    case 'EQUIPMENT_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'NOT_REFINABLE':
    case 'MAX_LEVEL_REACHED':
    case 'INSUFFICIENT_MATERIAL':
    case 'INSUFFICIENT_PROTECTION':
    case 'INSUFFICIENT_FUNDS':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

/** Map CharacterSkillError code → HTTP status. */
function mapSkillErrorStatus(code: CharacterSkillError['code']): HttpStatus {
  switch (code) {
    case 'SKILL_NOT_FOUND':
    case 'CHARACTER_NOT_FOUND':
    case 'REALM_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'NOT_LEARNED':
    case 'METHOD_NOT_LEARNED':
    case 'TOO_MANY_EQUIPPED':
    case 'MASTERY_MAX':
    case 'REALM_TOO_LOW':
    case 'WRONG_SECT':
      return HttpStatus.CONFLICT;
    case 'INSUFFICIENT_FUNDS':
      return HttpStatus.PAYMENT_REQUIRED;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}
