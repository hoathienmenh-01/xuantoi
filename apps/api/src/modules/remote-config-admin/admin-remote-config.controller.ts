/**
 * Phase 45.0 — Admin endpoints cho Remote Config.
 *
 * Endpoints (`@RequireAdmin` — MOD bị reject `ADMIN_ONLY` 403):
 *   - `GET    /admin/remote-config`                    — list.
 *   - `PATCH  /admin/remote-config/:key`               — update value + reason.
 *   - `POST   /admin/remote-config/refresh-defaults`   — lazy seed.
 *   - `POST   /admin/remote-config/clear-cache`        — flush cache.
 *
 * Audit: ghi `AdminAuditLog` action `ADMIN_REMOTE_CONFIG_UPDATE` /
 * `ADMIN_REMOTE_CONFIG_REFRESH_DEFAULTS` / `ADMIN_REMOTE_CONFIG_CLEAR_CACHE`.
 *
 * Body PATCH bắt buộc `reason` ≥ 3 ký tự (anti-typo audit log) — tương
 * tự pattern reward grant Phase 16.x.
 */
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  REMOTE_CONFIG_KEYS,
  getRemoteConfigDef,
  isRemoteConfigKey,
  type RemoteConfigAdminView,
  type RemoteConfigHistoryEntry,
  type RemoteConfigKey,
  type RemoteConfigValueType,
} from '@xuantoi/shared';
import { AdminGuard } from '../admin/admin.guard';
import { RateLimitPolicy } from '../security/rate-limit-policy.decorator';
import { RequireAdmin } from '../admin/require-admin.decorator';
import { PrismaService } from '../../common/prisma.service';
import {
  RemoteConfigInvalidKeyError,
  RemoteConfigService,
  RemoteConfigValidationError,
} from '../remote-config/remote-config.service';

interface AdminReq extends Request {
  userId: string;
  role: 'ADMIN' | 'MOD' | 'PLAYER';
}

function fail(
  code: string,
  status = HttpStatus.BAD_REQUEST,
  meta?: Record<string, unknown>,
): never {
  throw new HttpException(
    { ok: false, error: { code, message: code, ...(meta ?? {}) } },
    status,
  );
}

const PatchBodyZ = z
  .object({
    /** Raw JSON value — service validate type/cap qua shared validator. */
    value: z.unknown(),
    /**
     * Audit reason — bắt buộc, ≥ 3 ký tự, ≤ 500. Lưu vào `AdminAuditLog.meta`.
     * Phase 45.0 yêu cầu reason cho mọi mutation flag/config "quan trọng".
     */
    reason: z.string().min(3).max(500),
  })
  .strict();

@UseGuards(AdminGuard)
@Controller()
@RateLimitPolicy('ADMIN_MUTATION')
export class AdminRemoteConfigController {
  constructor(
    private readonly service: RemoteConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('admin/remote-config')
  @RequireAdmin()
  async list(): Promise<{
    ok: true;
    data: { configs: RemoteConfigAdminView[] };
  }> {
    const configs = await this.service.listConfigs();
    return { ok: true, data: { configs } };
  }

  @Patch('admin/remote-config/:key')
  @RequireAdmin()
  async update(
    @Req() req: AdminReq,
    @Param('key') key: string,
    @Body() rawBody: unknown,
  ): Promise<{ ok: true; data: RemoteConfigAdminView }> {
    if (!isRemoteConfigKey(key)) {
      fail('REMOTE_CONFIG_KEY_INVALID', HttpStatus.NOT_FOUND);
    }
    const parsed = PatchBodyZ.safeParse(rawBody);
    if (!parsed.success) {
      fail('INVALID_INPUT', HttpStatus.BAD_REQUEST, {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
        })),
      });
    }
    const { value, reason } = parsed.data;

    // Phase 45.0 — snapshot trước value cho audit history. Service ghi
    // sau khi snapshot xong; rows tạo mới = `oldValue` null + dùng catalog
    // default ở UI để diff.
    let priorValue: unknown = null;
    try {
      const priorList = await this.service.listConfigs();
      priorValue = priorList.find((c) => c.key === key)?.value ?? null;
    } catch {
      priorValue = null;
    }

    let view: RemoteConfigAdminView;
    try {
      view = await this.service.setConfig(req.userId, key, value);
    } catch (e) {
      if (e instanceof RemoteConfigInvalidKeyError) {
        fail('REMOTE_CONFIG_KEY_INVALID', HttpStatus.NOT_FOUND);
      }
      if (e instanceof RemoteConfigValidationError) {
        fail('REMOTE_CONFIG_VALIDATION_FAILED', HttpStatus.UNPROCESSABLE_ENTITY, {
          violations: e.violations.map((v) => ({
            code: v.code,
            message: v.message,
          })),
        });
      }
      throw e;
    }

    await this.audit(req.userId, 'ADMIN_REMOTE_CONFIG_UPDATE', {
      key: view.key,
      valueType: view.valueType,
      oldValue: priorValue,
      newValue: view.value,
      // Backwards-compat field for older audit log readers expecting `value`.
      value: view.value,
      reason,
    });
    return { ok: true, data: view };
  }

  @Post('admin/remote-config/refresh-defaults')
  @RequireAdmin()
  async refreshDefaults(
    @Req() req: AdminReq,
  ): Promise<{ ok: true; data: { created: number; existing: number } }> {
    const result = await this.service.ensureDefaultConfigs();
    await this.audit(req.userId, 'ADMIN_REMOTE_CONFIG_REFRESH_DEFAULTS', {
      created: result.created,
      existing: result.existing,
      catalogSize: REMOTE_CONFIG_KEYS.length,
    });
    return { ok: true, data: result };
  }

  @Post('admin/remote-config/clear-cache')
  @RequireAdmin()
  async clearCache(
    @Req() req: AdminReq,
  ): Promise<{ ok: true; data: { cleared: true } }> {
    await this.service.clearCache();
    await this.audit(req.userId, 'ADMIN_REMOTE_CONFIG_CLEAR_CACHE', {
      catalogSize: REMOTE_CONFIG_KEYS.length,
    });
    return { ok: true, data: { cleared: true } };
  }

  /**
   * Phase 45.0 — list audit history cho remote-config (chỉ admin).
   *
   * Read-only — query `AdminAuditLog` rows với `action` thuộc tập
   * `ADMIN_REMOTE_CONFIG_*` (UPDATE / REFRESH_DEFAULTS / CLEAR_CACHE).
   * Cho phép filter `?key=` để zoom vào 1 config (UPDATE), `?limit=`
   * cap [1, 100] (default 50, server-enforce).
   *
   * KHÔNG expose `actor.email` — chỉ `actorUserId` + tên (User.username
   * nếu có) để tránh leak PII admin. UI render placeholder cho null.
   */
  @Get('admin/remote-config/history')
  @RequireAdmin()
  async listHistory(
    @Query('key') rawKey?: string,
    @Query('limit') rawLimitStr?: string,
  ): Promise<{ ok: true; data: { entries: RemoteConfigHistoryEntry[] } }> {
    const filterKey: RemoteConfigKey | null =
      rawKey && isRemoteConfigKey(rawKey) ? rawKey : null;
    const rawLimit = rawLimitStr ? Number(rawLimitStr) : undefined;
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(100, Math.trunc(rawLimit as number)))
      : 50;

    // Khi filter theo `key`, oversample 5x rồi filter ở app layer — vì
    // meta JSON không có dedicated index nên không thể server-filter nhanh.
    // Cap oversample 500 row tránh full-table scan trên audit log lớn.
    const takeRaw = filterKey ? Math.min(500, limit * 5) : limit;
    // Join `character.name` qua actor (admin có character; nếu không có
    // fallback empty). Không expose email — PII protection theo Phase 27.6.
    const rows = await this.prisma.adminAuditLog.findMany({
      where: {
        action: {
          in: [
            'ADMIN_REMOTE_CONFIG_UPDATE',
            'ADMIN_REMOTE_CONFIG_REFRESH_DEFAULTS',
            'ADMIN_REMOTE_CONFIG_CLEAR_CACHE',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: takeRaw,
      include: {
        actor: {
          select: {
            id: true,
            character: { select: { name: true } },
          },
        },
      },
    });

    const entries: RemoteConfigHistoryEntry[] = [];
    for (const row of rows) {
      if (entries.length >= limit) break;
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const metaKey =
        typeof meta.key === 'string' && isRemoteConfigKey(meta.key)
          ? (meta.key as RemoteConfigKey)
          : null;
      if (filterKey && metaKey !== filterKey) continue;

      let valueType: RemoteConfigValueType | null = null;
      if (
        typeof meta.valueType === 'string' &&
        (meta.valueType === 'string' ||
          meta.valueType === 'number' ||
          meta.valueType === 'boolean' ||
          meta.valueType === 'json')
      ) {
        valueType = meta.valueType;
      } else if (metaKey) {
        try {
          valueType = getRemoteConfigDef(metaKey).valueType;
        } catch {
          valueType = null;
        }
      }

      const newValue =
        'newValue' in meta ? meta.newValue : 'value' in meta ? meta.value : null;
      const oldValue = 'oldValue' in meta ? meta.oldValue : null;
      const reason = typeof meta.reason === 'string' ? meta.reason : null;

      entries.push({
        id: row.id,
        action: row.action,
        actorUserId: row.actorUserId,
        actorName: row.actor?.character?.name ?? null,
        key: metaKey,
        valueType,
        oldValue,
        newValue,
        reason,
        changedAt: row.createdAt.toISOString(),
      });
    }

    return { ok: true, data: { entries } };
  }

  private async audit(
    actorUserId: string,
    action: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { actorUserId, action, meta: meta as Prisma.InputJsonValue },
    });
  }
}

export type { RemoteConfigKey };
