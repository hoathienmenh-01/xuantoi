import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../common/prisma.service';

const ACCESS_COOKIE = 'xt_access';

/**
 * Guard yêu cầu user đã đăng nhập và có role ADMIN/MOD.
 * Gắn `userId` + `role` vào `req` cho controller dùng.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      Request & { userId?: string; role?: 'ADMIN' | 'MOD' | 'PLAYER' }
    >();
    const userId = await this.auth.userIdFromAccess(req.cookies?.[ACCESS_COOKIE]);
    if (!userId) {
      throw new HttpException(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'UNAUTHENTICATED' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    // Đọc role tươi từ DB — không tin token (token có thể stale sau khi
    // admin demote mà chưa hết hạn 15p).
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, banned: true },
    });
    if (!u || u.banned) {
      throw new HttpException(
        { ok: false, error: { code: 'FORBIDDEN', message: 'FORBIDDEN' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (u.role !== 'ADMIN' && u.role !== 'MOD') {
      throw new HttpException(
        { ok: false, error: { code: 'FORBIDDEN', message: 'FORBIDDEN' } },
        HttpStatus.FORBIDDEN,
      );
    }
    req.userId = u.id;
    req.role = u.role;
    return true;
  }
}
