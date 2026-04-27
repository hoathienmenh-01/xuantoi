import { Injectable } from '@nestjs/common';
import { ChatChannel } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

class ChatError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'NO_SECT'
      | 'EMPTY_TEXT'
      | 'TEXT_TOO_LONG'
      | 'RATE_LIMITED',
  ) {
    super(code);
  }
}

export interface ChatMessageView {
  id: string;
  channel: ChatChannel;
  scopeKey: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

const MAX_HISTORY = 100;
const MAX_TEXT_LEN = 200;
const RATE_LIMIT_MS = 1500;
const HISTORY_RETENTION = 500;

@Injectable()
export class ChatService {
  /// In-memory rate limiter: senderId -> last sent ts.
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async historyWorld(): Promise<ChatMessageView[]> {
    return this.fetchHistory(ChatChannel.WORLD, 'world');
  }

  /**
   * Trả lịch sử SECT chat — chỉ cho user thuộc đúng sect đó. Không nhận
   * scopeKey từ client để tránh user A đọc lén chat sect B.
   */
  async historySect(userId: string): Promise<ChatMessageView[]> {
    const char = await this.prisma.character.findUnique({
      where: { userId },
      select: { sectId: true },
    });
    if (!char) throw new ChatError('NO_CHARACTER');
    if (!char.sectId) throw new ChatError('NO_SECT');
    return this.fetchHistory(ChatChannel.SECT, char.sectId);
  }

  private async fetchHistory(
    channel: ChatChannel,
    scopeKey: string,
  ): Promise<ChatMessageView[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { channel, scopeKey },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY,
    });
    return rows
      .reverse()
      .map((r) => ({
        id: r.id,
        channel: r.channel,
        scopeKey: r.scopeKey,
        senderId: r.senderId,
        senderName: r.senderName,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
      }));
  }

  async sendWorld(userId: string, text: string): Promise<ChatMessageView> {
    return this.send(userId, ChatChannel.WORLD, 'world', text);
  }

  async sendSect(userId: string, text: string): Promise<ChatMessageView> {
    const char = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, name: true, sectId: true },
    });
    if (!char) throw new ChatError('NO_CHARACTER');
    if (!char.sectId) throw new ChatError('NO_SECT');
    return this.send(userId, ChatChannel.SECT, char.sectId, text);
  }

  private async send(
    userId: string,
    channel: ChatChannel,
    scopeKey: string,
    rawText: string,
  ): Promise<ChatMessageView> {
    const text = rawText.trim();
    if (!text) throw new ChatError('EMPTY_TEXT');
    if (text.length > MAX_TEXT_LEN) throw new ChatError('TEXT_TOO_LONG');

    const char = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, name: true },
    });
    if (!char) throw new ChatError('NO_CHARACTER');

    const now = Date.now();
    const last = this.lastSent.get(char.id) ?? 0;
    if (now - last < RATE_LIMIT_MS) throw new ChatError('RATE_LIMITED');
    this.lastSent.set(char.id, now);

    const row = await this.prisma.chatMessage.create({
      data: {
        channel,
        scopeKey,
        senderId: char.id,
        senderName: char.name,
        text,
      },
    });

    // Cắt lịch sử để DB không phình.
    await this.pruneHistory(channel, scopeKey);

    const view: ChatMessageView = {
      id: row.id,
      channel: row.channel,
      scopeKey: row.scopeKey,
      senderId: row.senderId,
      senderName: row.senderName,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    };

    if (channel === ChatChannel.WORLD) {
      this.realtime.broadcast('chat:msg', view);
    } else {
      this.realtime.emitToRoom(`sect:${scopeKey}`, 'chat:msg', view);
    }
    return view;
  }

  private async pruneHistory(channel: ChatChannel, scopeKey: string): Promise<void> {
    const total = await this.prisma.chatMessage.count({
      where: { channel, scopeKey },
    });
    if (total <= HISTORY_RETENTION) return;
    const oldest = await this.prisma.chatMessage.findMany({
      where: { channel, scopeKey },
      orderBy: { createdAt: 'asc' },
      take: total - HISTORY_RETENTION,
      select: { id: true },
    });
    if (oldest.length === 0) return;
    await this.prisma.chatMessage.deleteMany({
      where: { id: { in: oldest.map((o) => o.id) } },
    });
  }
}

export { ChatError };
