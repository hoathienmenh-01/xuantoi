import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';

class SectError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'SECT_NOT_FOUND'
      | 'NOT_IN_SECT'
      | 'ALREADY_IN_SECT'
      | 'INVALID_AMOUNT'
      | 'INSUFFICIENT_LINH_THACH'
      | 'NAME_TAKEN'
      | 'INVALID_NAME',
  ) {
    super(code);
  }
}

export interface SectListView {
  id: string;
  name: string;
  description: string;
  level: number;
  treasuryLinhThach: string;
  memberCount: number;
  leaderName: string | null;
  createdAt: string;
}

export interface SectMemberView {
  id: string;
  name: string;
  realmKey: string;
  realmStage: number;
  congHien: number;
  isLeader: boolean;
  isMe: boolean;
}

export interface SectDetailView extends SectListView {
  members: SectMemberView[];
  isMyMember: boolean;
  isMyLeader: boolean;
}

const SECT_NAME_RE = /^[\p{L}\p{N} _-]{2,16}$/u;

@Injectable()
export class SectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly chars: CharacterService,
  ) {}

  async list(): Promise<SectListView[]> {
    const sects = await this.prisma.sect.findMany({
      orderBy: [{ level: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { characters: true } } },
    });
    if (sects.length === 0) return [];
    const leaderIds = sects.map((s) => s.leaderId).filter((x): x is string => !!x);
    const leaders = leaderIds.length
      ? await this.prisma.character.findMany({
          where: { id: { in: leaderIds } },
          select: { id: true, name: true },
        })
      : [];
    const leaderMap = new Map(leaders.map((l) => [l.id, l.name]));
    return sects.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      level: s.level,
      treasuryLinhThach: s.treasuryLinhThach.toString(),
      memberCount: s._count.characters,
      leaderName: s.leaderId ? (leaderMap.get(s.leaderId) ?? null) : null,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async detail(sectId: string, viewerCharId: string | null): Promise<SectDetailView> {
    const s = await this.prisma.sect.findUnique({
      where: { id: sectId },
      include: { _count: { select: { characters: true } } },
    });
    if (!s) throw new SectError('SECT_NOT_FOUND');
    const members = await this.prisma.character.findMany({
      where: { sectId: s.id },
      select: { id: true, name: true, realmKey: true, realmStage: true, congHien: true },
      orderBy: [{ congHien: 'desc' }, { name: 'asc' }],
      take: 100,
    });
    // Leader có thể không nằm trong top 100 theo congHien; query riêng nếu thiếu.
    let leaderName: string | null = null;
    if (s.leaderId) {
      const inList = members.find((m) => m.id === s.leaderId);
      if (inList) {
        leaderName = inList.name;
      } else {
        const leader = await this.prisma.character.findUnique({
          where: { id: s.leaderId },
          select: { name: true },
        });
        leaderName = leader?.name ?? null;
      }
    }
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      level: s.level,
      treasuryLinhThach: s.treasuryLinhThach.toString(),
      memberCount: s._count.characters,
      leaderName,
      createdAt: s.createdAt.toISOString(),
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        realmKey: m.realmKey,
        realmStage: m.realmStage,
        congHien: m.congHien,
        isLeader: m.id === s.leaderId,
        isMe: m.id === viewerCharId,
      })),
      isMyMember: viewerCharId
        ? members.some((m) => m.id === viewerCharId)
        : false,
      isMyLeader: viewerCharId ? viewerCharId === s.leaderId : false,
    };
  }

  async create(userId: string, name: string, description: string): Promise<SectDetailView> {
    if (!SECT_NAME_RE.test(name)) throw new SectError('INVALID_NAME');
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new SectError('NO_CHARACTER');
    if (char.sectId) throw new SectError('ALREADY_IN_SECT');

    let createdId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const sect = await tx.sect.create({
          data: { name, description: description.slice(0, 200), leaderId: char.id },
        });
        const upd = await tx.character.updateMany({
          where: { id: char.id, sectId: null },
          data: { sectId: sect.id },
        });
        if (upd.count === 0) throw new SectError('ALREADY_IN_SECT');
        return sect;
      });
      createdId = created.id;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // P2002 có thể fire trên `name` (trùng tên) HOẶC `leaderId` (cùng
        // user lập 2 sect đồng thời). Tách 2 case bằng meta.target.
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes('leaderId')) throw new SectError('ALREADY_IN_SECT');
        throw new SectError('NAME_TAKEN');
      }
      throw e;
    }
    this.realtime.joinUserToRoom(userId, `sect:${createdId}`);
    await this.refreshState(userId);
    return this.detail(createdId, char.id);
  }

  async join(userId: string, sectId: string): Promise<SectDetailView> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new SectError('NO_CHARACTER');
    if (char.sectId) throw new SectError('ALREADY_IN_SECT');

    const sect = await this.prisma.sect.findUnique({ where: { id: sectId } });
    if (!sect) throw new SectError('SECT_NOT_FOUND');

    const upd = await this.prisma.character.updateMany({
      where: { id: char.id, sectId: null },
      data: { sectId: sect.id },
    });
    if (upd.count === 0) throw new SectError('ALREADY_IN_SECT');

    this.realtime.joinUserToRoom(userId, `sect:${sect.id}`);
    await this.refreshState(userId);
    return this.detail(sect.id, char.id);
  }

  async leave(userId: string): Promise<{ ok: true }> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new SectError('NO_CHARACTER');
    if (!char.sectId) throw new SectError('NOT_IN_SECT');
    const oldSectId = char.sectId;

    await this.prisma.$transaction(async (tx) => {
      // Leader rời tông → bỏ leader, sect tồn tại đến khi admin xử lý.
      const sect = await tx.sect.findUnique({ where: { id: oldSectId } });
      if (sect?.leaderId === char.id) {
        await tx.sect.update({
          where: { id: oldSectId },
          data: { leaderId: null },
        });
      }
      await tx.character.update({
        where: { id: char.id },
        data: { sectId: null },
      });
    });

    this.realtime.leaveUserFromRoom(userId, `sect:${oldSectId}`);
    await this.refreshState(userId);
    return { ok: true };
  }

  async contribute(userId: string, amount: bigint): Promise<SectDetailView> {
    if (amount <= 0n) throw new SectError('INVALID_AMOUNT');
    // Cap 1M/lượt để tránh overflow Int của congHien — reject thẳng để
    // không trừ linh thạch quá tay mà chỉ cộng cống hiến cap.
    if (amount > 1_000_000n) throw new SectError('INVALID_AMOUNT');
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new SectError('NO_CHARACTER');
    if (!char.sectId) throw new SectError('NOT_IN_SECT');
    const sectId = char.sectId;

    // 1 linhThach → 1 điểm cống hiến.
    const congHienGain = Number(amount);

    await this.prisma.$transaction(async (tx) => {
      // Optimistic lock: chỉ trừ linh thạch nếu user vẫn còn thuộc sectId
      // ban đầu (chống race với leave()).
      const pay = await tx.character.updateMany({
        where: { id: char.id, sectId, linhThach: { gte: amount } },
        data: {
          linhThach: { decrement: amount },
          congHien: { increment: congHienGain },
        },
      });
      if (pay.count === 0) {
        // Phân biệt 2 lý do: nếu vẫn còn trong sect nhưng không đủ linh
        // thạch → INSUFFICIENT_LINH_THACH; ngược lại → NOT_IN_SECT.
        const cur = await tx.character.findUnique({
          where: { id: char.id },
          select: { sectId: true },
        });
        if (cur?.sectId !== sectId) throw new SectError('NOT_IN_SECT');
        throw new SectError('INSUFFICIENT_LINH_THACH');
      }
      await tx.sect.update({
        where: { id: sectId },
        data: { treasuryLinhThach: { increment: amount } },
      });
    });

    await this.refreshState(userId);
    return this.detail(sectId, char.id);
  }

  private async refreshState(userId: string): Promise<void> {
    const state = await this.chars.findByUser(userId);
    if (state) this.realtime.emitToUser(userId, 'state:update', state);
  }
}

export { SectError };
