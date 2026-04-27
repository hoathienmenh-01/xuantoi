import { HttpStatus, Injectable } from '@nestjs/common';
import type { Character } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { FIRST_REALM_KEY } from '@xuantoi/shared';
import { ApiException } from '../../common/api-exception';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';
import { GameLogService } from './game-log.service';

const CREATE_REWARD_LINH_THACH = 100n;

@Injectable()
export class CharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly logs: GameLogService,
  ) {}

  async findByUserId(userId: string): Promise<Character | null> {
    return this.prisma.character.findUnique({ where: { userId } });
  }

  /**
   * Tạo nhân vật cho user. 1-1 enforce.
   * Trao thưởng khai mở (linhThach) qua CurrencyService + ghi RewardClaimLog idempotent.
   */
  async create(userId: string, name: string): Promise<Character> {
    const trimmed = name.trim();
    const existing = await this.prisma.character.findUnique({ where: { userId } });
    if (existing) throw new ApiException('CHAR_ALREADY_EXISTS', HttpStatus.CONFLICT);

    let created: Character;
    try {
      created = await this.prisma.character.create({
        data: {
          userId,
          name: trimmed,
          realmKey: FIRST_REALM_KEY,
          realmStage: 1,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ApiException('CHAR_NAME_TAKEN', HttpStatus.CONFLICT);
      }
      throw err;
    }

    // Reward khai mở — idempotent qua RewardClaimLog (charId, type, key, refId).
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.rewardClaimLog.upsert({
        where: {
          charId_rewardType_rewardKey_refId: {
            charId: created.id,
            rewardType: 'CHAR_CREATE',
            rewardKey: 'linhThach',
            refId: created.id,
          },
        },
        create: {
          charId: created.id,
          rewardType: 'CHAR_CREATE',
          rewardKey: 'linhThach',
          refId: created.id,
        },
        update: {},
      });
      // chỉ cộng nếu vừa được tạo (createdAt rất gần now)
      const isFresh = Date.now() - claim.createdAt.getTime() < 1000;
      if (isFresh) {
        await this.currency.add(
          created.id,
          'linhThach',
          CREATE_REWARD_LINH_THACH,
          'CHAR_CREATE',
          { refType: 'CHAR_CREATE', refId: created.id },
          tx,
        );
      }
      await this.logs.write(
        {
          charId: created.id,
          type: 'system',
          text: `Khai mở đạo đồ "${trimmed}". Khởi đầu tại ${realmGreeting()}.`,
        },
        tx,
      );
    });

    return this.prisma.character.findUniqueOrThrow({ where: { id: created.id } });
  }
}

function realmGreeting(): string {
  return 'Luyện Khí Nhất Trọng';
}
