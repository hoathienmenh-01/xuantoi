import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import type { PublicGameLog } from '@xuantoi/shared';
import { ApiException } from '../../common/api-exception';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../common/jwt-auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { GameLogService } from '../character/game-log.service';

const MAX_LOGS = 50;

@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: GameLogService,
  ) {}

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const char = await this.prisma.character.findUnique({ where: { userId: req.userId } });
    if (!char) throw new ApiException('CHAR_NOT_FOUND', HttpStatus.NOT_FOUND);
    const rows = await this.logs.listLatest(char.id, MAX_LOGS);
    const logs: PublicGameLog[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    }));
    return { ok: true, data: { logs } };
  }
}
