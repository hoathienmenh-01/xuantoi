import { HttpStatus, Injectable } from '@nestjs/common';
import type { Character, Prisma } from '@prisma/client';
import {
  getBreakthroughCost,
  getCultivationExpPerSec,
  getNextRealmStage,
  getRealmStageName,
} from '@xuantoi/shared';
import { ApiException } from '../../common/api-exception';
import { PrismaService } from '../../common/prisma.service';
import { GameLogService } from '../character/game-log.service';

interface CultivationResult {
  character: Character;
  /** EXP vừa được flush vào DB ở thao tác này (chưa kể tu vi cũ). */
  flushedExp: bigint;
}

@Injectable()
export class CultivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: GameLogService,
  ) {}

  /** Bắt đầu tu luyện. Idempotent-ish: đang tu luyện → throw ALREADY_CULTIVATING. */
  async start(userId: string): Promise<Character> {
    const char = await this.requireChar(userId);
    if (char.cultivating) {
      throw new ApiException('ALREADY_CULTIVATING', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const out = await tx.character.update({
        where: { id: char.id },
        data: {
          cultivating: true,
          cultivationStartedAt: now,
          lastCultivationAt: now,
        },
      });
      await this.logs.write(
        {
          charId: char.id,
          type: 'info',
          text: `Bắt đầu nhập định tu luyện tại ${getRealmStageName(out.realmKey, out.realmStage)}.`,
        },
        tx,
      );
      return out;
    });
    return updated;
  }

  /** Dừng tu luyện: flush EXP đến giây hiện tại + cultivating=false. */
  async stop(userId: string): Promise<CultivationResult> {
    const char = await this.requireChar(userId);
    if (!char.cultivating) {
      throw new ApiException('NOT_CULTIVATING', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const flushed = computeElapsedExp(char, now);
    const updated = await this.prisma.$transaction(async (tx) => {
      const out = await tx.character.update({
        where: { id: char.id },
        data: {
          exp: { increment: flushed },
          cultivating: false,
          cultivationStartedAt: null,
          lastCultivationAt: null,
        },
      });
      if (flushed > 0n) {
        await this.logs.write(
          {
            charId: char.id,
            type: 'success',
            text: `Xuất quan, nhập tâm. Tu vi tăng ${flushed.toString()} điểm.`,
          },
          tx,
        );
      } else {
        await this.logs.write(
          { charId: char.id, type: 'info', text: 'Xuất quan.' },
          tx,
        );
      }
      return out;
    });
    return { character: updated, flushedExp: flushed };
  }

  /** Tick: flush EXP nhưng vẫn cultivating=true. Dùng khi đột phá hoặc khi FE muốn snapshot. */
  async tick(userId: string): Promise<CultivationResult> {
    const char = await this.requireChar(userId);
    if (!char.cultivating) {
      throw new ApiException('NOT_CULTIVATING', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const flushed = computeElapsedExp(char, now);
    const updated = await this.prisma.$transaction(async (tx) => {
      const out = await tx.character.update({
        where: { id: char.id },
        data: {
          exp: { increment: flushed },
          lastCultivationAt: now,
        },
      });
      return out;
    });
    return { character: updated, flushedExp: flushed };
  }

  /**
   * Đột phá: flush EXP trước, kiểm tra >= cost, trừ cost, +stage / sang đại cảnh kế.
   * Ghi log thành công/thất bại.
   */
  async breakthrough(userId: string): Promise<{ character: Character; success: boolean; flushedExp: bigint }> {
    const char = await this.requireChar(userId);

    // 1) Nếu đang cultivating → flush trước (không cần stop).
    let flushed = 0n;
    let working = char;
    if (working.cultivating) {
      const tick = await this.tick(userId);
      working = tick.character;
      flushed = tick.flushedExp;
    }

    const cost = getBreakthroughCost(working.realmKey, working.realmStage);
    if (cost === 0n) {
      throw new ApiException('ALREADY_AT_PEAK', HttpStatus.BAD_REQUEST);
    }

    if (working.exp < cost) {
      // ghi log thất bại trước khi throw
      await this.logs.write({
        charId: working.id,
        type: 'warning',
        text: `Đột phá thất bại: tu vi không đủ (${working.exp.toString()}/${cost.toString()}).`,
      });
      throw new ApiException('NOT_ENOUGH_EXP', HttpStatus.BAD_REQUEST);
    }

    const next = getNextRealmStage(working.realmKey, working.realmStage);
    if (!next) {
      throw new ApiException('ALREADY_AT_PEAK', HttpStatus.BAD_REQUEST);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const out = await tx.character.update({
        where: { id: working.id },
        data: {
          exp: { decrement: cost },
          realmKey: next.realmKey,
          realmStage: next.stage,
        },
      });
      await this.logs.write(
        {
          charId: working.id,
          type: 'success',
          text: `Đột phá thành công! Đăng lên ${getRealmStageName(out.realmKey, out.realmStage)}.`,
        },
        tx,
      );
      return out;
    });

    return { character: updated, success: true, flushedExp: flushed };
  }

  private async requireChar(userId: string): Promise<Character> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new ApiException('CHAR_NOT_FOUND', HttpStatus.NOT_FOUND);
    return char;
  }
}

function computeElapsedExp(char: Character, now: Date): bigint {
  const anchor = char.lastCultivationAt ?? char.cultivationStartedAt;
  if (!anchor) return 0n;
  const elapsedMs = now.getTime() - anchor.getTime();
  if (elapsedMs <= 0) return 0n;
  const seconds = elapsedMs / 1000;
  const expPerSec = getCultivationExpPerSec(char.realmKey);
  return BigInt(Math.max(Math.floor(seconds * expPerSec), 0));
}

// Re-export to make Prisma.TransactionClient available where imported (tree-shake-friendly).
export type { Prisma };
