import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import {
  LOGS_LIMIT_DEFAULT,
  LOGS_LIMIT_MAX,
  LOGS_LIMIT_MIN,
  LogsError,
  LogsListResult,
  LogsService,
} from './logs.service';

const ACCESS_COOKIE = 'xt_access';

const ListQuery = z.object({
  type: z.enum(['currency', 'item']).default('currency'),
  limit: z.coerce
    .number()
    .int()
    .min(LOGS_LIMIT_MIN)
    .max(LOGS_LIMIT_MAX)
    .default(LOGS_LIMIT_DEFAULT),
  cursor: z.string().min(1).optional(),
});

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

@Controller('logs')
export class LogsController {
  constructor(
    private readonly logs: LogsService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  async me(
    @Req() req: Request,
    @Query() query: unknown,
  ): Promise<{ ok: true; data: LogsListResult }> {
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) fail('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);

    const parsed = ListQuery.safeParse(query);
    if (!parsed.success) fail('INVALID_INPUT');

    try {
      const data = await this.logs.listForUser(userId, parsed.data);
      return { ok: true, data };
    } catch (e) {
      if (e instanceof LogsError) {
        if (e.code === 'NO_CHARACTER') fail('NO_CHARACTER', HttpStatus.NOT_FOUND);
        if (e.code === 'INVALID_CURSOR') fail('INVALID_CURSOR', HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }
}
