import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CharacterService } from './character.service';
import { AuthService } from '../auth/auth.service';

const ACCESS_COOKIE = 'xt_access';

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

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('character')
export class CharacterController {
  constructor(
    private readonly chars: CharacterService,
    private readonly auth: AuthService,
  ) {}

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
    // Yêu cầu phải đăng nhập để xem profile (anti-scrape).
    await this.requireUserId(req);
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
}
