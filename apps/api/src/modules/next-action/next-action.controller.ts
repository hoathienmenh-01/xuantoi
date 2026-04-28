import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NextActionService } from './next-action.service';

const ACCESS_COOKIE = 'xt_access';

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('me')
export class NextActionController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: NextActionService,
  ) {}

  @Get('next-actions')
  async list(@Req() req: Request) {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    const actions = await this.svc.forUser(userId);
    return { ok: true, data: { actions } };
  }
}
