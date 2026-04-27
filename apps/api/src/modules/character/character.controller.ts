import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateCharacterInput } from '@xuantoi/shared';
import { ApiException } from '../../common/api-exception';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../common/jwt-auth.guard';
import { ZodBody } from '../../common/zod.pipe';
import { CharacterService } from './character.service';
import { toPublicCharacter } from './character.types';

@UseGuards(JwtAuthGuard)
@Controller('character')
export class CharacterController {
  constructor(private readonly characters: CharacterService) {}

  @Post('create')
  @HttpCode(200)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodBody(CreateCharacterInput, 'BAD_INPUT')) input: CreateCharacterInput,
  ) {
    const char = await this.characters.create(req.userId, input.name);
    return { ok: true, data: { character: toPublicCharacter(char) } };
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const char = await this.characters.findByUserId(req.userId);
    if (!char) throw new ApiException('CHAR_NOT_FOUND', HttpStatus.NOT_FOUND);
    return { ok: true, data: { character: toPublicCharacter(char) } };
  }
}
