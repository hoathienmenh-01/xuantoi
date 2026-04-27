import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiException } from './api-exception';
import { ACCESS_COOKIE } from './auth-cookies';

export interface AuthenticatedRequest extends Request {
  userId: string;
  userRole: 'PLAYER' | 'MOD' | 'ADMIN';
}

interface AccessJwtPayload {
  sub: string;
  email: string;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = readAccessToken(req);
    if (!token) {
      throw new ApiException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    }
    const secret = this.cfg.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new ApiException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessJwtPayload>(token, { secret });
      (req as AuthenticatedRequest).userId = payload.sub;
      (req as AuthenticatedRequest).userRole = payload.role;
      return true;
    } catch {
      throw new ApiException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    }
  }
}

function readAccessToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length);
  }
  return undefined;
}
