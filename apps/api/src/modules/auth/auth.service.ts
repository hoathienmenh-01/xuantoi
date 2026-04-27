import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
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
  | 'RATE_LIMITED';

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

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthOutput> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AuthError('EMAIL_TAKEN');

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthOutput> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new AuthError('INVALID_CREDENTIALS');
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new AuthError('INVALID_CREDENTIALS');
    if (user.banned) throw new AuthError('INVALID_CREDENTIALS');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('OLD_PASSWORD_WRONG');
    const ok = await argon2.verify(user.passwordHash, input.oldPassword);
    if (!ok) throw new AuthError('OLD_PASSWORD_WRONG');

    const newHash = await argon2.hash(input.newPassword, ARGON2_OPTS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordVersion: { increment: 1 } },
    });
  }

  async userIdFromAccess(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.cfg.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    role: 'PLAYER' | 'MOD' | 'ADMIN';
    passwordVersion: number;
    createdAt: Date;
  }): Promise<AuthOutput> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.cfg.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, v: user.passwordVersion },
      {
        secret: this.cfg.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
        expiresIn: `${this.cfg.get<string>('JWT_REFRESH_TTL') ?? '2592000'}s`,
      },
    );
    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
    return { user: publicUser, accessToken, refreshToken };
  }
}
