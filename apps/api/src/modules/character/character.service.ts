import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

interface OnboardInput {
  name: string;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la';
}

const SECT_NAMES: Record<OnboardInput['sectKey'], string> = {
  thanh_van: 'Thanh Vân Môn',
  huyen_thuy: 'Huyền Thuỷ Cung',
  tu_la: 'Tu La Tông',
};

const SECT_STARTING_STATS: Record<
  OnboardInput['sectKey'],
  { power: number; spirit: number; speed: number; luck: number; hpMax: number; mpMax: number }
> = {
  thanh_van: { power: 14, spirit: 8, speed: 12, luck: 5, hpMax: 100, mpMax: 50 },
  huyen_thuy: { power: 8, spirit: 14, speed: 8, luck: 6, hpMax: 130, mpMax: 70 },
  tu_la: { power: 16, spirit: 6, speed: 10, luck: 4, hpMax: 90, mpMax: 40 },
};

class DomainError extends Error {
  constructor(public code: 'NAME_TAKEN' | 'ALREADY_ONBOARDED') {
    super(code);
  }
}

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    const c = await this.prisma.character.findUnique({ where: { userId } });
    if (!c) return null;
    return this.toPublic(c);
  }

  async onboard(userId: string, input: OnboardInput) {
    const existing = await this.prisma.character.findUnique({ where: { userId } });
    if (existing) throw new DomainError('ALREADY_ONBOARDED');

    const stats = SECT_STARTING_STATS[input.sectKey];
    try {
      const sect = await this.prisma.sect.upsert({
        where: { name: SECT_NAMES[input.sectKey] },
        update: {},
        create: { name: SECT_NAMES[input.sectKey] },
      });

      const c = await this.prisma.character.create({
        data: {
          userId,
          name: input.name,
          realmKey: 'luyenkhi',
          realmStage: 1,
          level: 1,
          ...stats,
          hp: stats.hpMax,
          mp: stats.mpMax,
          sectId: sect.id,
        },
      });
      return this.toPublic(c);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new DomainError('NAME_TAKEN');
      }
      throw e;
    }
  }

  private toPublic(c: {
    id: string;
    name: string;
    realmKey: string;
    realmStage: number;
    level: number;
    exp: bigint;
    hp: number;
    hpMax: number;
    mp: number;
    mpMax: number;
    power: number;
    spirit: number;
    speed: number;
    luck: number;
    sectId: string | null;
  }) {
    return {
      id: c.id,
      name: c.name,
      realmKey: c.realmKey,
      realmStage: c.realmStage,
      level: c.level,
      exp: c.exp.toString(),
      hp: c.hp,
      hpMax: c.hpMax,
      mp: c.mp,
      mpMax: c.mpMax,
      power: c.power,
      spirit: c.spirit,
      speed: c.speed,
      luck: c.luck,
      sectId: c.sectId,
    };
  }
}
