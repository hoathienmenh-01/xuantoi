import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type {
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'OLD_PASSWORD_WRONG'
  | 'RATE_LIMITED'
  | 'UNAUTHENTICATED';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
  }
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface AuthOutput extends IssuedTokens {
  user: PublicUser;
}

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
};

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_LIMIT = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  /** Đăng ký user. */
  async register(input: RegisterInput, ctx: { ip: string; userAgent?: string }): Promise<AuthOutput> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AuthError('EMAIL_TAKEN');

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  }

  /** Đăng nhập + ghi LoginAttempt + check rate limit. */
  async login(input: LoginInput, ctx: { ip: string; userAgent?: string }): Promise<AuthOutput> {
    await this.assertNotRateLimited(input.email, ctx.ip);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user ? await argon2.verify(user.passwordHash, input.password) : false;

    if (!user || !ok || user.banned) {
      await this.prisma.loginAttempt.create({
        data: { email: input.email, ip: ctx.ip, success: false },
      });
      throw new AuthError('INVALID_CREDENTIALS');
    }

    await this.prisma.loginAttempt.create({
      data: { email: input.email, ip: ctx.ip, success: true },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  }

  /** Đổi mật khẩu — revoke toàn bộ refresh-token & tăng passwordVersion. */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('OLD_PASSWORD_WRONG');
    const ok = await argon2.verify(user.passwordHash, input.oldPassword);
    if (!ok) throw new AuthError('OLD_PASSWORD_WRONG');

    const newHash = await argon2.hash(input.newPassword, ARGON2_OPTS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, passwordVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** Đọc userId từ access token (cookie). */
  async userIdFromAccess(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    const secret = this.cfg.get<string>('JWT_ACCESS_SECRET');
    if (!secret) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { secret });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  /** Trả về PublicUser nếu access token còn valid + user còn tồn tại. */
  async getSession(accessToken: string | undefined): Promise<PublicUser | null> {
    const userId = await this.userIdFromAccess(accessToken);
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.banned) return null;
    return toPublicUser(user);
  }

  /**
   * Xoay refresh-token: verify chữ ký + tra DB (chưa revoked, chưa hết hạn),
   * thu hồi token cũ, cấp cặp token mới.
   */
  async refresh(refreshToken: string | undefined, ctx: { ip: string; userAgent?: string }): Promise<AuthOutput> {
    if (!refreshToken) throw new AuthError('UNAUTHENTICATED');

    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) throw new AuthError('UNAUTHENTICATED');

    let payload: { sub: string; v: number; jti?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new AuthError('UNAUTHENTICATED');
    }

    const tokenHash = sha256(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AuthError('UNAUTHENTICATED');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.banned) throw new AuthError('UNAUTHENTICATED');
    if (user.passwordVersion !== payload.v) {
      // mật khẩu đã đổi → token cũ vô hiệu.
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      throw new AuthError('UNAUTHENTICATED');
    }

    // Rotate: revoke cũ, cấp mới.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  }

  /** Logout: thu hồi refresh-token cụ thể (nếu có). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = sha256(refreshToken);
    try {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`logout: cannot revoke token: ${(err as Error).message}`);
    }
  }

  /* ---------------- internals ---------------- */

  private async assertNotRateLimited(email: string, ip: string): Promise<void> {
    const since = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
    const failedSameKey = await this.prisma.loginAttempt.count({
      where: { email, ip, success: false, createdAt: { gte: since } },
    });
    if (failedSameKey >= FAILED_LOGIN_LIMIT) {
      throw new AuthError('RATE_LIMITED');
    }
  }

  private async issueTokens(
    user: {
      id: string;
      email: string;
      role: 'PLAYER' | 'MOD' | 'ADMIN';
      passwordVersion: number;
    },
    ctx: { ip: string; userAgent?: string },
  ): Promise<IssuedTokens> {
    const accessSecret = this.cfg.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';
    const accessTtl = Number(this.cfg.get<string>('JWT_ACCESS_TTL') ?? '900');
    const refreshTtl = Number(this.cfg.get<string>('JWT_REFRESH_TTL') ?? '2592000');

    const jti = randomBytes(16).toString('hex');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: accessSecret, expiresIn: `${accessTtl}s` },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, v: user.passwordVersion, jti },
      { secret: refreshSecret, expiresIn: `${refreshTtl}s` },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip: ctx.ip,
        userAgent: ctx.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken, accessTtlSeconds: accessTtl, refreshTtlSeconds: refreshTtl };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function toPublicUser(user: {
  id: string;
  email: string;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
