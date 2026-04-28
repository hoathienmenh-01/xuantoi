import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { GiftCodeError, GiftCodeService } from './giftcode.service';

const ACCESS_COOKIE = 'xt_access';

const RedeemInput = z.object({ code: z.string().min(1).max(64) });

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('giftcodes')
export class GiftCodeController {
  constructor(
    private readonly gift: GiftCodeService,
    private readonly auth: AuthService,
  ) {}

  private async requireUserId(req: Request): Promise<string> {
    const id = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!id) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    return id;
  }

  @Post('redeem')
  @HttpCode(200)
  async redeem(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.requireUserId(req);
    const parsed = RedeemInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const result = await this.gift.redeem(userId, parsed.data.code);
      return { ok: true, data: { reward: result } };
    } catch (e) {
      if (e instanceof GiftCodeError) {
        const status =
          e.code === 'CODE_NOT_FOUND' || e.code === 'NO_CHARACTER'
            ? HttpStatus.NOT_FOUND
            : e.code === 'ALREADY_REDEEMED' ||
                e.code === 'CODE_EXPIRED' ||
                e.code === 'CODE_REVOKED' ||
                e.code === 'CODE_EXHAUSTED'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;
        fail(e.code, status);
      }
      throw e;
    }
  }
}
