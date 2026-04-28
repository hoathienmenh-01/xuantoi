import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  expCostForStage,
  nextRealm,
  type CharacterStatePayload,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

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
  constructor(public code: 'NAME_TAKEN' | 'ALREADY_ONBOARDED' | 'NO_CHARACTER' | 'NOT_AT_PEAK') {
    super(code);
  }
}

type CharRow = Prisma.CharacterGetPayload<{ include: { sect: true; user: true } }>;

const SECT_NAME_TO_KEY: Record<string, OnboardInput['sectKey']> = {
  'Thanh Vân Môn': 'thanh_van',
  'Huyền Thuỷ Cung': 'huyen_thuy',
  'Tu La Tông': 'tu_la',
};

export interface PublicProfileView {
  id: string;
  name: string;
  realmKey: string;
  realmStage: number;
  level: number;
  power: number;
  spirit: number;
  speed: number;
  luck: number;
  sectId: string | null;
  sectKey: string | null;
  sectName: string | null;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  createdAt: string;
}

@Injectable()
export class CharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findByUser(userId: string) {
    const c = await this.prisma.character.findUnique({
      where: { userId },
      include: { sect: true, user: true },
    });
    if (!c) return null;
    return this.toState(c);
  }

  /**
   * Public-safe profile view — không lộ exp, hp/mp/stamina, currency, cultivating.
   * Trả null nếu không tìm thấy hoặc owner đang banned.
   */
  async findPublicProfile(characterId: string): Promise<PublicProfileView | null> {
    const c = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { sect: true, user: true },
    });
    if (!c) return null;
    if (c.user.banned) return null;
    return {
      id: c.id,
      name: c.name,
      realmKey: c.realmKey,
      realmStage: c.realmStage,
      level: c.level,
      power: c.power,
      spirit: c.spirit,
      speed: c.speed,
      luck: c.luck,
      sectId: c.sectId,
      sectKey: c.sect ? SECT_NAME_TO_KEY[c.sect.name] ?? null : null,
      sectName: c.sect?.name ?? null,
      role: c.user.role,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async getStateOrThrow(userId: string): Promise<CharacterStatePayload> {
    const c = await this.prisma.character.findUnique({
      where: { userId },
      include: { sect: true, user: true },
    });
    if (!c) throw new DomainError('NO_CHARACTER');
    return this.toState(c);
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
        include: { sect: true, user: true },
      });
      const state = this.toState(c);
      this.realtime.emitToUser(userId, 'state:update', state);
      return state;
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

  async setCultivating(userId: string, on: boolean): Promise<CharacterStatePayload> {
    const c = await this.prisma.character.findUnique({ where: { userId } });
    if (!c) throw new DomainError('NO_CHARACTER');
    const updated = await this.prisma.character.update({
      where: { userId },
      data: { cultivating: on },
      include: { sect: true, user: true },
    });
    const state = this.toState(updated);
    this.realtime.emitToUser(userId, 'state:update', state);
    return state;
  }

  /**
   * Đột phá khi đạt đỉnh (trọng 9). Yêu cầu exp >= cost(stage=9).
   */
  async breakthrough(userId: string): Promise<CharacterStatePayload> {
    const c = await this.prisma.character.findUnique({ where: { userId } });
    if (!c) throw new DomainError('NO_CHARACTER');

    if (c.realmStage < 9) throw new DomainError('NOT_AT_PEAK');
    const cost = expCostForStage(c.realmKey, 9);
    if (cost === null || c.exp < cost) throw new DomainError('NOT_AT_PEAK');

    const next = nextRealm(c.realmKey);
    const newRealm = next ? next.key : c.realmKey;
    const newStage = next ? 1 : 9;

    const updated = await this.prisma.character.update({
      where: { userId },
      data: {
        realmKey: newRealm,
        realmStage: newStage,
        exp: c.exp - cost,
        // mở rộng dung lượng HP/MP khi vượt cảnh — tăng 20%.
        hpMax: Math.round(c.hpMax * 1.2),
        mpMax: Math.round(c.mpMax * 1.2),
        hp: Math.round(c.hpMax * 1.2),
        mp: Math.round(c.mpMax * 1.2),
      },
      include: { sect: true, user: true },
    });
    const state = this.toState(updated);
    this.realtime.emitToUser(userId, 'state:update', state);
    return state;
  }

  private toState(c: CharRow): CharacterStatePayload {
    const expNext = expCostForStage(c.realmKey, c.realmStage);
    return {
      id: c.id,
      name: c.name,
      realmKey: c.realmKey,
      realmStage: c.realmStage,
      level: c.level,
      exp: c.exp.toString(),
      expNext: (expNext ?? 0n).toString(),
      hp: c.hp,
      hpMax: c.hpMax,
      mp: c.mp,
      mpMax: c.mpMax,
      stamina: c.stamina,
      staminaMax: c.staminaMax,
      power: c.power,
      spirit: c.spirit,
      speed: c.speed,
      luck: c.luck,
      linhThach: c.linhThach.toString(),
      tienNgoc: c.tienNgoc,
      cultivating: c.cultivating,
      sectId: c.sectId,
      sectKey: c.sect ? SECT_NAME_TO_KEY[c.sect.name] ?? null : null,
      role: c.user.role,
      banned: c.user.banned,
    };
  }
}

export { DomainError };
