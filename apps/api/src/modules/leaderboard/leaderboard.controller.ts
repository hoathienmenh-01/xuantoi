import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { LeaderboardService } from './leaderboard.service';

const ACCESS_COOKIE = 'xt_access';

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: LeaderboardService,
  ) {}

  @Get('power')
  async topByPower(@Req() req: Request, @Query('limit') limit?: string) {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    const n = limit ? Number(limit) : undefined;
    const rows = await this.svc.topByPower(n);
    return { ok: true, data: { rows } };
  }

  @Get('topup')
  async topByTopup(@Req() req: Request, @Query('limit') limit?: string) {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    const n = limit ? Number(limit) : undefined;
    const rows = await this.svc.topByTopup(n);
    return { ok: true, data: { rows } };
  }

  @Get('sect')
  async topBySect(@Req() req: Request, @Query('limit') limit?: string) {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    const n = limit ? Number(limit) : undefined;
    const rows = await this.svc.topBySect(n);
    return { ok: true, data: { rows } };
  }
}
