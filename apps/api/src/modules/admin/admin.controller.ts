import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role, TopupStatus } from '@prisma/client';
import { z } from 'zod';
import { AdminGuard } from './admin.guard';
import { RequireAdmin } from './require-admin.decorator';
import { AdminError, AdminService } from './admin.service';
import { GiftCodeError, GiftCodeService } from '../giftcode/giftcode.service';
import { MailError, MailService } from '../mail/mail.service';

function fail(code: string, status = HttpStatus.BAD_REQUEST): never {
  throw new HttpException({ ok: false, error: { code, message: code } }, status);
}

const RoleZ = z.enum(['PLAYER', 'MOD', 'ADMIN']);

const BanInput = z.object({
  banned: z.boolean(),
});
const RoleInput = z.object({
  role: RoleZ,
});
const GrantInput = z.object({
  /** Có thể âm để trừ. */
  linhThach: z.string().regex(/^-?\d+$/).default('0'),
  tienNgoc: z.number().int().default(0),
  reason: z.string().max(200).default(''),
});
const TopupActionInput = z.object({
  note: z.string().max(200).default(''),
});

const GiftItemZ = z.object({
  itemKey: z.string().min(1).max(80),
  qty: z.number().int().positive().max(999),
});
const GiftCreateZ = z.object({
  code: z.string().min(4).max(32).regex(/^[A-Za-z0-9_-]+$/),
  rewardLinhThach: z.string().regex(/^\d+$/).default('0'),
  rewardTienNgoc: z.number().int().min(0).default(0),
  rewardExp: z.string().regex(/^\d+$/).default('0'),
  rewardItems: z.array(GiftItemZ).max(10).default([]),
  maxRedeems: z.number().int().positive().max(1_000_000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const MailItemZ = z.object({
  itemKey: z.string().min(1).max(80),
  qty: z.number().int().positive().max(999),
});
const MailBaseZ = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  senderName: z.string().min(1).max(80).optional(),
  rewardLinhThach: z.string().regex(/^\d+$/).default('0'),
  rewardTienNgoc: z.number().int().min(0).default(0),
  rewardExp: z.string().regex(/^\d+$/).default('0'),
  rewardItems: z.array(MailItemZ).max(10).default([]),
  expiresAt: z.string().datetime().optional(),
});
const MailSendZ = MailBaseZ.extend({
  recipientCharacterId: z.string().min(1).max(80),
});

type AdminReq = Request & { userId: string; role: Role };

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly giftCodes: GiftCodeService,
    private readonly mailService: MailService,
  ) {}

  @Get('users')
  async users(@Query('q') q: string | undefined, @Query('page') page: string | undefined) {
    const p = Math.max(0, Number.parseInt(page ?? '0', 10) || 0);
    const r = await this.admin.listUsers(q, p);
    return { ok: true, data: r };
  }

  @Post('users/:id/ban')
  @HttpCode(200)
  async ban(@Req() req: AdminReq, @Param('id') id: string, @Body() body: unknown) {
    const parsed = BanInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      await this.admin.setBanned(req.userId, req.role, id, parsed.data.banned);
      return { ok: true, data: { ok: true } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('users/:id/role')
  @HttpCode(200)
  @RequireAdmin()
  async role(@Req() req: AdminReq, @Param('id') id: string, @Body() body: unknown) {
    const parsed = RoleInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      await this.admin.setRole(req.userId, req.role, id, parsed.data.role);
      return { ok: true, data: { ok: true } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('users/:id/grant')
  @HttpCode(200)
  @RequireAdmin()
  async grant(@Req() req: AdminReq, @Param('id') id: string, @Body() body: unknown) {
    const parsed = GrantInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      await this.admin.grant(
        req.userId,
        req.role,
        id,
        BigInt(parsed.data.linhThach),
        parsed.data.tienNgoc,
        parsed.data.reason,
      );
      return { ok: true, data: { ok: true } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Get('topups')
  async topups(
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
  ) {
    const p = Math.max(0, Number.parseInt(page ?? '0', 10) || 0);
    const st: TopupStatus | null =
      status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? status : null;
    const r = await this.admin.listTopups(st, p);
    return { ok: true, data: r };
  }

  @Post('topups/:id/approve')
  @HttpCode(200)
  @RequireAdmin()
  async approveTopup(@Req() req: AdminReq, @Param('id') id: string, @Body() body: unknown) {
    const parsed = TopupActionInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      await this.admin.approveTopup(req.userId, id, parsed.data.note);
      return { ok: true, data: { ok: true } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('topups/:id/reject')
  @HttpCode(200)
  @RequireAdmin()
  async rejectTopup(@Req() req: AdminReq, @Param('id') id: string, @Body() body: unknown) {
    const parsed = TopupActionInput.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      await this.admin.rejectTopup(req.userId, id, parsed.data.note);
      return { ok: true, data: { ok: true } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Get('audit')
  async audit(@Query('page') page: string | undefined) {
    const p = Math.max(0, Number.parseInt(page ?? '0', 10) || 0);
    const r = await this.admin.listAudit(p);
    return { ok: true, data: r };
  }

  @Get('stats')
  async stats() {
    const r = await this.admin.stats();
    return { ok: true, data: r };
  }

  @Get('giftcodes')
  async giftList(@Query('limit') limit: string | undefined) {
    const l = Math.max(1, Math.min(500, Number.parseInt(limit ?? '100', 10) || 100));
    const r = await this.giftCodes.list(l);
    return { ok: true, data: { codes: r } };
  }

  @Post('giftcodes')
  @HttpCode(200)
  @RequireAdmin()
  async giftCreate(@Req() req: AdminReq, @Body() body: unknown) {
    const parsed = GiftCreateZ.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const code = await this.giftCodes.create({
        code: parsed.data.code,
        rewardLinhThach: BigInt(parsed.data.rewardLinhThach),
        rewardTienNgoc: parsed.data.rewardTienNgoc,
        rewardExp: BigInt(parsed.data.rewardExp),
        rewardItems: parsed.data.rewardItems,
        maxRedeems: parsed.data.maxRedeems ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdByAdminId: req.userId,
      });
      return { ok: true, data: { code } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('giftcodes/:code/revoke')
  @HttpCode(200)
  @RequireAdmin()
  async giftRevoke(@Param('code') code: string) {
    try {
      const r = await this.giftCodes.revoke(code);
      return { ok: true, data: { code: r } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('mail/send')
  @HttpCode(200)
  @RequireAdmin()
  async mailSend(@Req() req: AdminReq, @Body() body: unknown) {
    const parsed = MailSendZ.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const mail = await this.mailService.sendToCharacter({
        recipientCharacterId: parsed.data.recipientCharacterId,
        subject: parsed.data.subject,
        body: parsed.data.body,
        senderName: parsed.data.senderName,
        rewardLinhThach: BigInt(parsed.data.rewardLinhThach),
        rewardTienNgoc: parsed.data.rewardTienNgoc,
        rewardExp: BigInt(parsed.data.rewardExp),
        rewardItems: parsed.data.rewardItems,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
        createdByAdminId: req.userId,
      });
      return { ok: true, data: { mail } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  @Post('mail/broadcast')
  @HttpCode(200)
  @RequireAdmin()
  async mailBroadcast(@Req() req: AdminReq, @Body() body: unknown) {
    const parsed = MailBaseZ.safeParse(body);
    if (!parsed.success) fail('INVALID_INPUT');
    try {
      const count = await this.mailService.broadcast({
        subject: parsed.data.subject,
        body: parsed.data.body,
        senderName: parsed.data.senderName,
        rewardLinhThach: BigInt(parsed.data.rewardLinhThach),
        rewardTienNgoc: parsed.data.rewardTienNgoc,
        rewardExp: BigInt(parsed.data.rewardExp),
        rewardItems: parsed.data.rewardItems,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
        createdByAdminId: req.userId,
      });
      return { ok: true, data: { count } };
    } catch (e) {
      this.handleErr(e);
    }
  }

  private handleErr(e: unknown): never {
    if (e instanceof AdminError) {
      const status =
        e.code === 'NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : e.code === 'FORBIDDEN'
            ? HttpStatus.FORBIDDEN
            : e.code === 'ALREADY_PROCESSED'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;
      fail(e.code, status);
    }
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
    if (e instanceof MailError) {
      const status =
        e.code === 'RECIPIENT_NOT_FOUND' || e.code === 'MAIL_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : e.code === 'ALREADY_CLAIMED' || e.code === 'MAIL_EXPIRED' || e.code === 'NO_REWARD'
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_REQUEST;
      fail(e.code, status);
    }
    throw e;
  }
}
