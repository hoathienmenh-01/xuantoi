import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { WsFrame } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
import { RealtimeService } from './realtime.service';

const ACCESS_COOKIE = 'xt_access';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      });
      client.data.userId = payload.sub;
      this.realtime.bind(this.server);
      this.realtime.attach(payload.sub, client.id);
      // Auto-join world room cho mọi socket; sect room nếu có sectId.
      void client.join('world');
      const char = await this.prisma.character.findUnique({
        where: { userId: payload.sub },
        select: { sectId: true },
      });
      if (char?.sectId) void client.join(`sect:${char.sectId}`);
      this.logger.log(`ws conn user=${payload.sub} sid=${client.id}`);
    } catch {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId) this.realtime.detach(userId, client.id);
  }

  @SubscribeMessage('ping')
  onPing(
    @MessageBody() _data: unknown,
    @ConnectedSocket() _client: Socket,
  ): WsFrame<Record<string, never>> {
    return { type: 'pong', payload: {}, ts: Date.now() };
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) return auth;
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookie(cookieHeader);
    return cookies[ACCESS_COOKIE] ?? null;
  }
}
