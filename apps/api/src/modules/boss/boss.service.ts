import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, BossStatus, CurrencyKind } from '@prisma/client';
import {
  BOSSES,
  BOSS_ATTACK_COOLDOWN_MS,
  BOSS_LIFETIME_MS,
  BOSS_RESPAWN_DELAY_MS,
  BOSS_STAMINA_PER_HIT,
  SKILL_BASIC_ATTACK,
  bossByKey,
  rollDamage,
  skillByKey,
  type BossDef,
  type SectKey,
  type SkillDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';

export class BossError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'NO_ACTIVE_BOSS'
      | 'BOSS_DEFEATED'
      | 'COOLDOWN'
      | 'STAMINA_LOW'
      | 'MP_LOW'
      | 'HP_LOW'
      | 'SKILL_NOT_USABLE',
  ) {
    super(code);
  }
}

export interface BossLeaderboardRow {
  rank: number;
  characterId: string;
  characterName: string;
  damage: string;
  hits: number;
}

export interface BossView {
  id: string;
  bossKey: string;
  name: string;
  description: string;
  level: number;
  maxHp: string;
  currentHp: string;
  status: BossStatus;
  spawnedAt: string;
  expiresAt: string;
  leaderboard: BossLeaderboardRow[];
  myDamage: string | null;
  myRank: number | null;
  participants: number;
  /** Cố định: thời điểm có thể đánh lần kế tiếp (per char). Null nếu không log-in. */
  cooldownUntil: string | null;
  /** UI gợi ý — boss-specific drop pool. */
  topDropPool: readonly string[];
  midDropPool: readonly string[];
}

export interface AttackResult {
  damageDealt: string;
  bossHp: string;
  bossMaxHp: string;
  defeated: boolean;
  myDamageTotal: string;
  myRank: number;
  charHp: number;
  charMp: number;
  charStamina: number;
}

export interface DefeatedRewardSlice {
  rank: number;
  characterId: string;
  characterName: string;
  damage: string;
  linhThach: string;
  items: { itemKey: string; qty: number }[];
}

const LEADERBOARD_SIZE = 20;

@Injectable()
export class BossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BossService.name);
  /** characterId → last attack ms (rate-limit). */
  private readonly cooldowns = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly chars: CharacterService,
    private readonly inventory: InventoryService,
    private readonly currency: CurrencyService,
  ) {}

  onModuleInit(): void {
    // Heartbeat 30s: spawn boss mới, expire boss quá hạn.
    this.timer = setInterval(() => {
      this.heartbeat().catch((e) => this.logger.error('boss heartbeat', e as Error));
    }, 30_000);
    // Tick lần đầu sau 2s để khởi động sau migrate.
    setTimeout(() => {
      this.heartbeat().catch(() => undefined);
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- public API ----------

  async getCurrent(viewerCharId: string | null): Promise<BossView | null> {
    const boss = await this.prisma.worldBoss.findFirst({
      where: { status: BossStatus.ACTIVE },
      orderBy: { spawnedAt: 'desc' },
    });
    if (!boss) return null;
    return this.toView(boss, viewerCharId);
  }

  async attack(
    userId: string,
    skillKey: string | undefined,
  ): Promise<{ result: AttackResult; defeated: DefeatedRewardSlice[] | null }> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new BossError('NO_CHARACTER');

    const now = Date.now();
    const last = this.cooldowns.get(char.id) ?? 0;
    if (now - last < BOSS_ATTACK_COOLDOWN_MS) {
      throw new BossError('COOLDOWN');
    }

    const boss = await this.prisma.worldBoss.findFirst({
      where: { status: BossStatus.ACTIVE },
      orderBy: { spawnedAt: 'desc' },
    });
    if (!boss) throw new BossError('NO_ACTIVE_BOSS');
    const def = bossByKey(boss.bossKey);
    if (!def) throw new BossError('NO_ACTIVE_BOSS');

    const sectKey = await this.resolveSectKey(char.sectId);
    const skill: SkillDef = skillKey
      ? (skillByKey(skillKey) ?? SKILL_BASIC_ATTACK)
      : SKILL_BASIC_ATTACK;
    if (skill.sect !== null && skill.sect !== sectKey) {
      throw new BossError('SKILL_NOT_USABLE');
    }
    if (char.mp < skill.mpCost) throw new BossError('MP_LOW');
    if (char.stamina < BOSS_STAMINA_PER_HIT) throw new BossError('STAMINA_LOW');

    // Huyết tế: trừ % HP — không cho dùng nếu < ngưỡng.
    const bloodCost = Math.floor(char.hpMax * skill.selfBloodCost);
    if (bloodCost > 0 && char.hp <= bloodCost) throw new BossError('HP_LOW');

    // Sát thương: atk gốc + bonus power, scale theo skill, def boss.
    const charAtk = char.power + (skill.atkScale > 1 ? char.spirit : 0);
    const raw = rollDamage(charAtk, def.def, skill.atkScale);
    // Boost theo level boss (giảm sát thương phần nào).
    const damage = Math.max(1, raw);

    // Trừ resource trước (cooldown set ngay để chống burst).
    this.cooldowns.set(char.id, now);

    const healRatio = skill.selfHealRatio;

    let defeated = false;
    let bossHpAfter = boss.currentHp;
    let myDamageTotal = 0n;
    let myRank = 0;
    let rewardSlices: DefeatedRewardSlice[] | null = null;
    let postHp = char.hp;
    let postMp = char.mp;
    let postStamina = char.stamina;

    await this.prisma.$transaction(async (tx) => {
      // Trừ resource character bằng atomic decrement — guard để không
      // overwrite cập nhật concurrent (potion / cron / dungeon).
      // bloodCost = 0 cho skill không phải huyết tế.
      const upd = await tx.character.updateMany({
        where: {
          id: char.id,
          mp: { gte: skill.mpCost },
          stamina: { gte: BOSS_STAMINA_PER_HIT },
          hp: { gt: bloodCost },
        },
        data: {
          mp: { decrement: skill.mpCost },
          stamina: { decrement: BOSS_STAMINA_PER_HIT },
          hp: { decrement: bloodCost },
        },
      });
      if (upd.count === 0) {
        // Lý do nào? Đọc lại để phân biệt.
        const cur = await tx.character.findUnique({
          where: { id: char.id },
          select: { mp: true, stamina: true, hp: true },
        });
        if (!cur) throw new BossError('NO_CHARACTER');
        if (cur.mp < skill.mpCost) throw new BossError('MP_LOW');
        if (cur.stamina < BOSS_STAMINA_PER_HIT) throw new BossError('STAMINA_LOW');
        throw new BossError('HP_LOW');
      }

      // Apply heal (huyền thuỷ): re-read fresh để clamp đúng tại hpMax.
      if (healRatio > 0) {
        const cur = await tx.character.findUnique({
          where: { id: char.id },
          select: { hp: true, hpMax: true },
        });
        if (cur) {
          const healAmt = Math.floor(cur.hpMax * healRatio);
          const target = Math.min(cur.hpMax, cur.hp + healAmt);
          await tx.character.update({
            where: { id: char.id },
            data: { hp: target },
          });
        }
      }

      // Đọc lại stat sau atomic update để trả response chính xác.
      const post = await tx.character.findUnique({
        where: { id: char.id },
        select: { hp: true, mp: true, stamina: true },
      });
      if (post) {
        postHp = post.hp;
        postMp = post.mp;
        postStamina = post.stamina;
      }

      // Trừ HP boss — cap tại 0, atomic.
      const dmg = BigInt(damage);
      const bossUpd = await tx.worldBoss.updateMany({
        where: { id: boss.id, status: BossStatus.ACTIVE, currentHp: { gt: 0n } },
        data: { currentHp: { decrement: dmg } },
      });
      if (bossUpd.count === 0) throw new BossError('BOSS_DEFEATED');

      // Re-fetch để lấy currentHp sau decrement.
      const bossNow = await tx.worldBoss.findUnique({ where: { id: boss.id } });
      if (!bossNow) throw new BossError('NO_ACTIVE_BOSS');
      bossHpAfter = bossNow.currentHp;

      // Cộng dồn damage character (idempotent).
      const dmgRow = await tx.bossDamage.upsert({
        where: { bossId_characterId: { bossId: boss.id, characterId: char.id } },
        create: {
          bossId: boss.id,
          characterId: char.id,
          characterName: char.name,
          totalDamage: dmg,
          hits: 1,
          lastHitAt: new Date(),
        },
        update: {
          totalDamage: { increment: dmg },
          hits: { increment: 1 },
          lastHitAt: new Date(),
        },
      });
      myDamageTotal = dmgRow.totalDamage;

      // Nếu bossHp <= 0 → mark DEFEATED, distribute rewards trong tx,
      // và cập nhật bossHpAfter về 0 để response/broadcast nhất quán.
      if (bossHpAfter <= 0n) {
        const flip = await tx.worldBoss.updateMany({
          where: { id: boss.id, status: BossStatus.ACTIVE },
          data: {
            status: BossStatus.DEFEATED,
            defeatedAt: new Date(),
            currentHp: 0n,
          },
        });
        if (flip.count > 0) {
          defeated = true;
          bossHpAfter = 0n;
          rewardSlices = await this.distributeRewards(tx, boss.id, def);
        }
      }
    });

    // Đảm bảo response không bao giờ trả HP âm ngay cả khi tx flip
    // không xảy ra (tránh hiển thị `-95 / 120000` ở client).
    if (bossHpAfter < 0n) bossHpAfter = 0n;

    // Tính rank ngoài tx (read-only, không cần lock).
    const rankRow = await this.prisma.bossDamage.count({
      where: { bossId: boss.id, totalDamage: { gt: myDamageTotal } },
    });
    myRank = rankRow + 1;

    // Re-emit state user + boss room.
    await this.refreshState(userId);
    void this.broadcastBossUpdate(boss.id, viewerOnlyHp(bossHpAfter));

    if (defeated) {
      void this.broadcastBossDefeated(boss.id, rewardSlices ?? []);
    }

    return {
      result: {
        damageDealt: damage.toString(),
        bossHp: bossHpAfter.toString(),
        bossMaxHp: boss.maxHp.toString(),
        defeated,
        myDamageTotal: myDamageTotal.toString(),
        myRank,
        charHp: postHp,
        charMp: postMp,
        charStamina: postStamina,
      },
      defeated: rewardSlices,
    };
  }

  // ---------- private helpers ----------

  private async heartbeat(): Promise<void> {
    // 1) Expire boss quá hạn.
    const active = await this.prisma.worldBoss.findFirst({
      where: { status: BossStatus.ACTIVE },
      orderBy: { spawnedAt: 'desc' },
    });
    if (active && active.expiresAt.getTime() <= Date.now()) {
      const def = bossByKey(active.bossKey);
      const flip = await this.prisma.worldBoss.updateMany({
        where: { id: active.id, status: BossStatus.ACTIVE },
        data: { status: BossStatus.EXPIRED, defeatedAt: new Date() },
      });
      if (flip.count > 0 && def) {
        // Cũng phân thưởng giảm cho người tham gia (60% pool).
        const slices = await this.distributeRewardsExpired(active.id, def);
        this.realtime.broadcast('boss:end', {
          id: active.id,
          status: 'EXPIRED',
          rewards: slices,
        });
      }
    }

    // 2) Spawn boss mới nếu không có ACTIVE và đã đủ delay.
    const stillActive = await this.prisma.worldBoss.findFirst({
      where: { status: BossStatus.ACTIVE },
    });
    if (stillActive) return;

    const last = await this.prisma.worldBoss.findFirst({
      where: { status: { in: [BossStatus.DEFEATED, BossStatus.EXPIRED] } },
      orderBy: { spawnedAt: 'desc' },
    });
    if (last) {
      const since = Date.now() - (last.defeatedAt ?? last.spawnedAt).getTime();
      if (since < BOSS_RESPAWN_DELAY_MS) return;
    }
    await this.spawnNew();
  }

  private async spawnNew(): Promise<void> {
    // Đếm tổng số boss đã spawn để rotate.
    const totalSpawned = await this.prisma.worldBoss.count();
    const def = BOSSES[totalSpawned % BOSSES.length];
    const level = Math.min(10, 1 + Math.floor(totalSpawned / BOSSES.length));
    const maxHp = BigInt(def.baseMaxHp) * BigInt(level);

    const created = await this.prisma.worldBoss.create({
      data: {
        bossKey: def.key,
        name: def.name,
        level,
        maxHp,
        currentHp: maxHp,
        status: BossStatus.ACTIVE,
        spawnedAt: new Date(),
        expiresAt: new Date(Date.now() + BOSS_LIFETIME_MS),
        rewardTotal: BigInt(def.baseRewardLinhThach) * BigInt(level),
      },
    });

    this.realtime.broadcast('boss:spawn', {
      id: created.id,
      bossKey: created.bossKey,
      name: created.name,
      level: created.level,
      maxHp: created.maxHp.toString(),
      currentHp: created.currentHp.toString(),
      spawnedAt: created.spawnedAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    });
    this.logger.log(`Boss spawn: ${created.name} Lv.${created.level} maxHp=${maxHp}`);
  }

  private async broadcastBossUpdate(bossId: string, _hp: bigint): Promise<void> {
    const boss = await this.prisma.worldBoss.findUnique({ where: { id: bossId } });
    if (!boss) return;
    const top = await this.prisma.bossDamage.findMany({
      where: { bossId },
      orderBy: [{ totalDamage: 'desc' }, { lastHitAt: 'asc' }],
      take: 5,
    });
    this.realtime.broadcast('boss:update', {
      id: boss.id,
      currentHp: boss.currentHp.toString(),
      maxHp: boss.maxHp.toString(),
      status: boss.status,
      leaderboardTop5: top.map((r, i) => ({
        rank: i + 1,
        characterId: r.characterId,
        characterName: r.characterName,
        damage: r.totalDamage.toString(),
        hits: r.hits,
      })),
    });
  }

  private async broadcastBossDefeated(
    bossId: string,
    rewards: DefeatedRewardSlice[],
  ): Promise<void> {
    const boss = await this.prisma.worldBoss.findUnique({ where: { id: bossId } });
    if (!boss) return;
    this.realtime.broadcast('boss:defeated', {
      id: boss.id,
      bossKey: boss.bossKey,
      name: boss.name,
      level: boss.level,
      defeatedAt: boss.defeatedAt?.toISOString() ?? new Date().toISOString(),
      rewards,
    });
  }

  /**
   * Phân thưởng khi boss chết (full pool).
   * - Top 1: 50% linh thạch + 1 item từ topDropPool
   * - Top 2-3: 15% mỗi + 1 item từ midDropPool
   * - Top 4-10: chia đều 18%
   * - Top 11+: chia đều 2%
   * - Cộng cho mọi người EXP nhỏ + thông báo.
   */
  private async distributeRewards(
    tx: Prisma.TransactionClient,
    bossId: string,
    def: BossDef,
  ): Promise<DefeatedRewardSlice[]> {
    const boss = await tx.worldBoss.findUnique({ where: { id: bossId } });
    if (!boss) return [];
    const all = await tx.bossDamage.findMany({
      where: { bossId },
      orderBy: [{ totalDamage: 'desc' }, { lastHitAt: 'asc' }],
    });
    if (all.length === 0) return [];

    const total = boss.rewardTotal;
    const top1 = (total * 50n) / 100n;
    const top23Each = (total * 15n) / 100n;
    const top410Pool = (total * 18n) / 100n;
    const restPool = (total * 2n) / 100n;

    const rest = all.length > 10 ? all.length - 10 : 0;
    const top410n = Math.min(7, Math.max(0, all.length - 3));
    const top410Each = top410n > 0 ? top410Pool / BigInt(top410n) : 0n;
    const restEach = rest > 0 ? restPool / BigInt(rest) : 0n;

    const slices: DefeatedRewardSlice[] = [];
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      const rank = i + 1;
      let linhThach = 0n;
      const items: { itemKey: string; qty: number }[] = [];
      if (rank === 1) {
        linhThach = top1;
        const drop = pickRandom(def.topDropPool);
        if (drop) items.push({ itemKey: drop, qty: 1 });
      } else if (rank === 2 || rank === 3) {
        linhThach = top23Each;
        const drop = pickRandom(def.midDropPool);
        if (drop) items.push({ itemKey: drop, qty: 1 });
      } else if (rank <= 10) {
        linhThach = top410Each;
      } else {
        linhThach = restEach;
      }
      // Trao thưởng character (atomic + ghi ledger).
      if (linhThach > 0n) {
        await this.currency.applyTx(tx, {
          characterId: row.characterId,
          currency: CurrencyKind.LINH_THACH,
          delta: linhThach,
          reason: 'BOSS_REWARD',
          refType: 'WorldBoss',
          refId: bossId,
          meta: {
            rank,
            damage: row.totalDamage.toString(),
            bossKey: def.key,
          },
        });
      }
      if (items.length > 0) {
        await this.inventory.grantTx(tx, row.characterId, items);
      }
      slices.push({
        rank,
        characterId: row.characterId,
        characterName: row.characterName,
        damage: row.totalDamage.toString(),
        linhThach: linhThach.toString(),
        items,
      });
    }
    return slices;
  }

  /** Phân thưởng giảm khi boss EXPIRED — dùng 60% reward pool. */
  private async distributeRewardsExpired(
    bossId: string,
    def: BossDef,
  ): Promise<DefeatedRewardSlice[]> {
    return this.prisma.$transaction(async (tx) => {
      const boss = await tx.worldBoss.findUnique({ where: { id: bossId } });
      if (!boss) return [];
      // Giảm reward pool còn 60% và thực hiện cùng logic.
      // Hack đơn giản: tạm sửa rewardTotal trong tx.
      const reduced = (boss.rewardTotal * 60n) / 100n;
      await tx.worldBoss.update({
        where: { id: bossId },
        data: { rewardTotal: reduced },
      });
      const slices = await this.distributeRewards(tx, bossId, def);
      // Khôi phục để audit (không cần thiết nhưng giữ cho rõ).
      await tx.worldBoss.update({
        where: { id: bossId },
        data: { rewardTotal: boss.rewardTotal },
      });
      return slices;
    });
  }

  private async toView(
    boss: { id: string; bossKey: string; name: string; level: number; maxHp: bigint;
      currentHp: bigint; status: BossStatus; spawnedAt: Date; expiresAt: Date },
    viewerCharId: string | null,
  ): Promise<BossView> {
    const def = bossByKey(boss.bossKey);
    const top = await this.prisma.bossDamage.findMany({
      where: { bossId: boss.id },
      orderBy: [{ totalDamage: 'desc' }, { lastHitAt: 'asc' }],
      take: LEADERBOARD_SIZE,
    });
    const participants = await this.prisma.bossDamage.count({ where: { bossId: boss.id } });

    let myDamage: string | null = null;
    let myRank: number | null = null;
    if (viewerCharId) {
      const mine = await this.prisma.bossDamage.findUnique({
        where: { bossId_characterId: { bossId: boss.id, characterId: viewerCharId } },
      });
      if (mine) {
        myDamage = mine.totalDamage.toString();
        const ahead = await this.prisma.bossDamage.count({
          where: { bossId: boss.id, totalDamage: { gt: mine.totalDamage } },
        });
        myRank = ahead + 1;
      }
    }

    const cooldown = viewerCharId ? this.cooldowns.get(viewerCharId) ?? 0 : 0;
    const cdNext = cooldown + BOSS_ATTACK_COOLDOWN_MS;
    const cooldownUntil =
      viewerCharId && cdNext > Date.now() ? new Date(cdNext).toISOString() : null;

    return {
      id: boss.id,
      bossKey: boss.bossKey,
      name: boss.name,
      description: def?.description ?? '',
      level: boss.level,
      maxHp: boss.maxHp.toString(),
      currentHp: boss.currentHp.toString(),
      status: boss.status,
      spawnedAt: boss.spawnedAt.toISOString(),
      expiresAt: boss.expiresAt.toISOString(),
      leaderboard: top.map((r, i) => ({
        rank: i + 1,
        characterId: r.characterId,
        characterName: r.characterName,
        damage: r.totalDamage.toString(),
        hits: r.hits,
      })),
      myDamage,
      myRank,
      participants,
      cooldownUntil,
      topDropPool: def?.topDropPool ?? [],
      midDropPool: def?.midDropPool ?? [],
    };
  }

  private async resolveSectKey(sectId: string | null): Promise<SectKey | null> {
    if (!sectId) return null;
    const sect = await this.prisma.sect.findUnique({ where: { id: sectId } });
    if (!sect) return null;
    if (sect.name === 'Thanh Vân Môn') return 'thanh_van';
    if (sect.name === 'Huyền Thuỷ Cung') return 'huyen_thuy';
    if (sect.name === 'Tu La Tông') return 'tu_la';
    return null;
  }

  private async refreshState(userId: string): Promise<void> {
    const state = await this.chars.findByUser(userId);
    if (state) this.realtime.emitToUser(userId, 'state:update', state);
  }
}

function pickRandom<T>(arr: readonly T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function viewerOnlyHp(hp: bigint): bigint {
  return hp;
}


