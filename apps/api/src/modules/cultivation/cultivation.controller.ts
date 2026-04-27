import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../common/jwt-auth.guard';
import { toPublicCharacter } from '../character/character.types';
import { CultivationService } from './cultivation.service';

@UseGuards(JwtAuthGuard)
@Controller('cultivation')
export class CultivationController {
  constructor(private readonly cultivation: CultivationService) {}

  @Post('start')
  @HttpCode(200)
  async start(@Req() req: AuthenticatedRequest) {
    const char = await this.cultivation.start(req.userId);
    return { ok: true, data: { character: toPublicCharacter(char) } };
  }

  @Post('stop')
  @HttpCode(200)
  async stop(@Req() req: AuthenticatedRequest) {
    const out = await this.cultivation.stop(req.userId);
    return {
      ok: true,
      data: {
        character: toPublicCharacter(out.character),
        flushedExp: out.flushedExp.toString(),
      },
    };
  }

  @Post('tick')
  @HttpCode(200)
  async tick(@Req() req: AuthenticatedRequest) {
    const out = await this.cultivation.tick(req.userId);
    return {
      ok: true,
      data: {
        character: toPublicCharacter(out.character),
        flushedExp: out.flushedExp.toString(),
      },
    };
  }

  @Post('breakthrough')
  @HttpCode(200)
  async breakthrough(@Req() req: AuthenticatedRequest) {
    const out = await this.cultivation.breakthrough(req.userId);
    return {
      ok: true,
      data: {
        character: toPublicCharacter(out.character),
        flushedExp: out.flushedExp.toString(),
      },
    };
  }
}
