import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { z } from 'zod';
import { BossError, BossService } from './boss.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../common/prisma.service';
import { AdminGuard } from '../admin/admin.guard';
import { RequireAdmin } from '../admin/require-admin.decorator';

const ACCESS_COOKIE = 'xt_access';

const AttackInput = z.object({
  skillKey: z.string().max(64).optional(),
});

const AdminSpawnInput = z.object({
  bossKey: z.string().min(1).max(64).optional(),
  level: z.number().int().min(1).max(10).optional(),
  force: z.boolean().optional(),
});

type AdminReq = Request & { userId: string; role: Role };

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('boss')
export class BossController {
  constructor(
    private readonly boss: BossService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async getViewer(req: Request): Promise<{
    userId: string | null;
    characterId: string | null;
  }> {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) return { userId: null, characterId: null };
    const c = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    return { userId, characterId: c?.id ?? null };
  }

  @Get('current')
  async current(@Req() req: Request) {
    const { characterId } = await this.getViewer(req);
    const boss = await this.boss.getCurrent(characterId);
    return { ok: true, data: { boss } };
  }

  @Post('attack')
  @HttpCode(200)
  async attack(@Req() req: Request, @Body() body: unknown) {
    const { userId } = await this.getViewer(req);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    const parsed = AttackInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const r = await this.boss.attack(userId, parsed.data.skillKey);
      return { ok: true, data: r };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('admin/spawn')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async adminSpawn(@Req() req: AdminReq, @Body() body: unknown) {
    const parsed = AdminSpawnInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const r = await this.boss.adminSpawn(req.userId, parsed.data);
      return { ok: true, data: r };
    } catch (e) {
      this.handleErr(e);
    }
  }

  private handleErr(e: unknown): never {
    if (e instanceof BossError) {
      switch (e.code) {
        case 'NO_CHARACTER':
        case 'NO_ACTIVE_BOSS':
          fail(e.code, HttpStatus.NOT_FOUND);
        // eslint-disable-next-line no-fallthrough
        case 'COOLDOWN':
          fail(e.code, HttpStatus.TOO_MANY_REQUESTS);
        // eslint-disable-next-line no-fallthrough
        case 'SKILL_NOT_USABLE':
        case 'INVALID_BOSS_KEY':
        case 'INVALID_LEVEL':
          fail(e.code, HttpStatus.BAD_REQUEST);
        // eslint-disable-next-line no-fallthrough
        case 'BOSS_DEFEATED':
        case 'STAMINA_LOW':
        case 'MP_LOW':
        case 'HP_LOW':
        case 'BOSS_ALREADY_ACTIVE':
          fail(e.code, HttpStatus.CONFLICT);
      }
    }
    throw e;
  }
}
