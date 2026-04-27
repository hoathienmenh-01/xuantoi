import { Injectable } from '@nestjs/common';
import type { GameLogType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

export interface GameLogInput {
  charId: string;
  type: GameLogType;
  text: string;
}

@Injectable()
export class GameLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: GameLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.gameLog.create({ data: input });
  }

  async listLatest(charId: string, limit = 50) {
    return this.prisma.gameLog.findMany({
      where: { charId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
