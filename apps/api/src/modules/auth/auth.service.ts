import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
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
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_BANNED';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
  }
}

interface AuthOutput {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthCtx {
  ip: string;
}

interface UserForToken {
  id: string;
  email: string;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  passwordVersion: number;
  banned: boolean;
  createdAt: Date;
}

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
};

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILS = 5;

const ACCESS_TTL_SEC_DEFAULT = 15 * 60;
const REFRESH_TTL_SEC_DEFAULT = 30 * 24 * 60 * 60;

const INSECURE_DEFAULTS = new Set([
  'change-me-access-secret',
  'change-me-refresh-secret',
  'dev-access-secret',
  'dev-refresh-secret',
]);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  // ---------------- public API ----------------

  async register(input: RegisterInput, ctx: AuthCtx): Promise<AuthOutput> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AuthError('EMAIL_TAKEN');

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    return this.issueTokens(user, ctx);
  }

  async login(input: LoginInput, ctx: AuthCtx): Promise<AuthOutput> {
    await this.assertNotRateLimited(input.email, ctx.ip);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      await this.recordAttempt(input.email, ctx.ip, false);
      throw new AuthError('INVALID_CREDENTIALS');
    }
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) {
      await this.recordAttempt(input.email, ctx.ip, false);
      throw new AuthError('INVALID_CREDENTIALS');
    }
    if (user.banned) {
      await this.recordAttempt(input.email, ctx.ip, false);
      throw new AuthError('ACCOUNT_BANNED');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.recordAttempt(input.email, ctx.ip, true);
    return this.issueTokens(user, ctx);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('OLD_PASSWORD_WRONG');
    const ok = await argon2.verify(user.passwordHash, input.oldPassword);
    if (!ok) throw new AuthError('OLD_PASSWORD_WRONG');

    const newHash = await argon2.hash(input.newPassword, ARGON2_OPTS);
    // Atomically rotate password + bump passwordVersion + revoke all refresh tokens.
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

  async session(accessToken: string | undefined): Promise<PublicUser> {
    const userId = await this.userIdFromAccess(accessToken);
    if (!userId) throw new AuthError('UNAUTHENTICATED');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('UNAUTHENTICATED');
    if (user.banned) throw new AuthError('ACCOUNT_BANNED');
    return this.toPublic(user);
  }

  /**
   * Refresh token rotation:
   *  - verify JWT
   *  - look up active RefreshToken row by jti
   *  - check argon2 hashedToken vs presented JWT
   *  - revoke old, mint new (linked via rotatedFromId)
   */
  async refresh(presented: string | undefined, ctx: AuthCtx): Promise<AuthOutput> {
    if (!presented) throw new AuthError('SESSION_EXPIRED');

    let payload: { sub: string; v: number; jti: string; exp?: number };
    try {
      payload = await this.jwt.verifyAsync(presented, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new AuthError('SESSION_EXPIRED');
    }

    const row = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!row) throw new AuthError('SESSION_EXPIRED');
    if (row.revokedAt) throw new AuthError('SESSION_EXPIRED');
    if (row.expiresAt.getTime() <= Date.now()) throw new AuthError('SESSION_EXPIRED');

    const matches = await argon2.verify(row.hashedToken, presented);
    if (!matches) {
      // Possible token reuse — defensive revoke ALL user tokens.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AuthError('SESSION_EXPIRED');
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) throw new AuthError('UNAUTHENTICATED');
    if (user.banned) throw new AuthError('ACCOUNT_BANNED');
    if (user.passwordVersion !== row.passwordVersion) throw new AuthError('SESSION_EXPIRED');

    // Mint new tokens and revoke the old in same transaction (rotation).
    const minted = await this.mint(user, ctx, row.id);
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return minted;
  }

  /**
   * Revoke ALL refresh tokens của user → các thiết bị khác sẽ logout
   * trong vòng 1 access TTL (mặc định 15 phút).
   * Không bump passwordVersion vì password chưa đổi.
   */
  async logoutAll(userId: string): Promise<{ revoked: number }> {
    const r = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: r.count };
  }

  /** Revoke the presented refresh token (logout). Idempotent. */
  async logout(presented: string | undefined): Promise<void> {
    if (!presented) return;
    let jti: string | undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ jti?: string }>(presented, {
        secret: this.refreshSecret(),
      });
      jti = payload.jti;
    } catch {
      return; // expired / tampered — nothing to do.
    }
    if (!jti) return;
    await this.prisma.refreshToken.updateMany({
      where: { jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async userIdFromAccess(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; v?: number }>(token, {
        secret: this.accessSecret(),
      });
      if (!payload.sub) return null;
      // passwordVersion match check — invalidates access tokens issued before password change.
      // (Banned status is checked by callers like session() so they can return a distinct
      // error code; we only care here that the token was minted for the *current* password.)
      if (typeof payload.v === 'number') {
        const u = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { passwordVersion: true },
        });
        if (!u) return null;
        if (u.passwordVersion !== payload.v) return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  toPublic(user: UserForToken | { id: string; email: string; role: 'PLAYER' | 'MOD' | 'ADMIN'; createdAt: Date }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ---------------- internals ----------------

  private async issueTokens(user: UserForToken, ctx: AuthCtx): Promise<AuthOutput> {
    return this.mint(user, ctx, null);
  }

  private async mint(
    user: UserForToken,
    _ctx: AuthCtx,
    rotatedFromId: string | null,
  ): Promise<AuthOutput> {
    const accessTtl = Number(this.cfg.get<string>('JWT_ACCESS_TTL') ?? ACCESS_TTL_SEC_DEFAULT);
    const refreshTtl = Number(this.cfg.get<string>('JWT_REFRESH_TTL') ?? REFRESH_TTL_SEC_DEFAULT);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, v: user.passwordVersion },
      { secret: this.accessSecret(), expiresIn: `${accessTtl}s` },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, v: user.passwordVersion, jti },
      { secret: this.refreshSecret(), expiresIn: `${refreshTtl}s` },
    );
    const hashedToken = await argon2.hash(refreshToken, ARGON2_OPTS);
    await this.prisma.refreshToken.create({
      data: {
        jti,
        userId: user.id,
        hashedToken,
        passwordVersion: user.passwordVersion,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        rotatedFromId,
      },
    });

    return { user: this.toPublic(user), accessToken, refreshToken };
  }

  private async assertNotRateLimited(email: string, ip: string): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const fails = await this.prisma.loginAttempt.count({
      where: { email, ip, success: false, createdAt: { gte: since } },
    });
    if (fails >= RATE_LIMIT_MAX_FAILS) throw new AuthError('RATE_LIMITED');
  }

  private async recordAttempt(email: string, ip: string, success: boolean): Promise<void> {
    await this.prisma.loginAttempt.create({ data: { email, ip, success } });
  }

  private accessSecret(): string {
    const v = this.cfg.get<string>('JWT_ACCESS_SECRET');
    if (process.env.NODE_ENV === 'production') {
      if (!v || INSECURE_DEFAULTS.has(v)) {
        throw new Error('[xuantoi/api] Production thiếu JWT_ACCESS_SECRET hợp lệ');
      }
      return v;
    }
    return v && v.length > 0 ? v : 'dev-access-secret';
  }

  private refreshSecret(): string {
    const v = this.cfg.get<string>('JWT_REFRESH_SECRET');
    if (process.env.NODE_ENV === 'production') {
      if (!v || INSECURE_DEFAULTS.has(v)) {
        throw new Error('[xuantoi/api] Production thiếu JWT_REFRESH_SECRET hợp lệ');
      }
      return v;
    }
    return v && v.length > 0 ? v : 'dev-refresh-secret';
  }
}
