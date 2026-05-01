import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma, EncounterStatus } from '@prisma/client';
import {
  DUNGEONS,
  SPIRITUAL_ROOT_GRADES,
  STAMINA_PER_ACTION,
  SKILL_BASIC_ATTACK,
  characterSkillElementBonus,
  dungeonByKey,
  elementMultiplier,
  getSpiritualRootGradeDef,
  itemByKey,
  monsterByKey,
  rollDamage,
  rollDungeonLoot,
  skillByKey,
  type DungeonDef,
  type ElementKey,
  type MonsterDef,
  type SectKey,
  type SkillDef,
  type SpiritualRootGrade,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { MissionService } from '../mission/mission.service';

export interface EncounterState {
  monsterIndex: number;
  monsterHp: number;
}

export interface EncounterLogLine {
  side: 'player' | 'monster' | 'system';
  text: string;
  ts: number;
}

export interface EncounterRewardLoot {
  itemKey: string;
  qty: number;
  itemName: string;
  quality: string;
}

export interface EncounterView {
  id: string;
  dungeon: DungeonDef;
  status: EncounterStatus;
  monster: MonsterDef | null;
  monsterHp: number;
  monsterIndex: number;
  log: EncounterLogLine[];
  reward: { exp: string; linhThach: string; loot: EncounterRewardLoot[] } | null;
}

interface ActionInput {
  skillKey?: string;
}

/**
 * Phase 11.3.C narrowing helper — Prisma trả về `string | null` cho
 * `spiritualRootGrade`, runtime cần check khớp catalog
 * `SPIRITUAL_ROOT_GRADES` trước khi gọi `getSpiritualRootGradeDef` để
 * tránh throw. Legacy character (`null`) → return false → multiplier 1.0.
 */
function isValidSpiritualRootGrade(
  grade: string | null,
): grade is SpiritualRootGrade {
  return grade !== null && (SPIRITUAL_ROOT_GRADES as readonly string[]).includes(grade);
}

class CombatError extends Error {
  constructor(
    public code:
      | 'NO_CHARACTER'
      | 'DUNGEON_NOT_FOUND'
      | 'STAMINA_LOW'
      | 'ALREADY_IN_FIGHT'
      | 'ENCOUNTER_NOT_FOUND'
      | 'ENCOUNTER_ENDED'
      | 'SKILL_NOT_USABLE'
      | 'MP_LOW',
  ) {
    super(code);
  }
}

@Injectable()
export class CombatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly chars: CharacterService,
    private readonly inventory: InventoryService,
    private readonly currency: CurrencyService,
    private readonly missions: MissionService,
  ) {}

  listDungeons() {
    return DUNGEONS;
  }

  async getActive(characterId: string): Promise<EncounterView | null> {
    const e = await this.prisma.encounter.findFirst({
      where: { characterId, status: EncounterStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    return e ? this.toView(e) : null;
  }

  async start(userId: string, dungeonKey: string): Promise<EncounterView> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new CombatError('NO_CHARACTER');
    const dungeon = dungeonByKey(dungeonKey);
    if (!dungeon) throw new CombatError('DUNGEON_NOT_FOUND');
    if (char.stamina < dungeon.staminaEntry) throw new CombatError('STAMINA_LOW');

    const existing = await this.prisma.encounter.findFirst({
      where: { characterId: char.id, status: EncounterStatus.ACTIVE },
    });
    if (existing) throw new CombatError('ALREADY_IN_FIGHT');

    const firstMonster = monsterByKey(dungeon.monsters[0]);
    if (!firstMonster) throw new CombatError('DUNGEON_NOT_FOUND');

    await this.prisma.character.update({
      where: { id: char.id },
      data: { stamina: char.stamina - dungeon.staminaEntry },
    });

    const state: EncounterState = { monsterIndex: 0, monsterHp: firstMonster.hp };
    const log: EncounterLogLine[] = [
      {
        side: 'system',
        text: `Đạo hữu vào ${dungeon.name}, đối diện ${firstMonster.name} (Lv.${firstMonster.level}).`,
        ts: Date.now(),
      },
    ];

    const enc = await this.prisma.encounter.create({
      data: {
        characterId: char.id,
        dungeonKey,
        state: state as unknown as Prisma.InputJsonValue,
        log: log as unknown as Prisma.InputJsonValue,
      },
    });

    const charState = await this.chars.findByUser(userId);
    if (charState) this.realtime.emitToUser(userId, 'state:update', charState);
    return this.toView(enc);
  }

  async action(userId: string, encounterId: string, input: ActionInput): Promise<EncounterView> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new CombatError('NO_CHARACTER');
    if (char.stamina < STAMINA_PER_ACTION) throw new CombatError('STAMINA_LOW');

    const enc = await this.prisma.encounter.findUnique({ where: { id: encounterId } });
    if (!enc || enc.characterId !== char.id) throw new CombatError('ENCOUNTER_NOT_FOUND');
    if (enc.status !== EncounterStatus.ACTIVE) throw new CombatError('ENCOUNTER_ENDED');

    const dungeon = dungeonByKey(enc.dungeonKey);
    if (!dungeon) throw new CombatError('DUNGEON_NOT_FOUND');
    const state = enc.state as unknown as EncounterState;
    const monster = monsterByKey(dungeon.monsters[state.monsterIndex]);
    if (!monster) throw new CombatError('DUNGEON_NOT_FOUND');

    const sectKey = await this.resolveSectKey(char.sectId);
    const skill: SkillDef = input.skillKey
      ? skillByKey(input.skillKey) ?? SKILL_BASIC_ATTACK
      : SKILL_BASIC_ATTACK;
    if (skill.sect !== null && skill.sect !== sectKey) {
      throw new CombatError('SKILL_NOT_USABLE');
    }

    let charHp = char.hp;
    let charMp = char.mp;
    if (charMp < skill.mpCost) throw new CombatError('MP_LOW');

    const equip = await this.inventory.equipBonus(char.id);
    // Phase 11.3.C — Linh căn statBonusPercent wire vào atk/def.
    // Legacy character (spiritualRootGrade=null) → statMul = 1.0.
    const statMul = isValidSpiritualRootGrade(char.spiritualRootGrade)
      ? 1 + getSpiritualRootGradeDef(char.spiritualRootGrade).statBonusPercent / 100
      : 1.0;
    const effPower = (char.power + equip.atk) * statMul;
    const effDef = equip.def * statMul;

    const log: EncounterLogLine[] = [
      ...((enc.log as unknown as EncounterLogLine[]) ?? []),
    ];

    // Phase 11.3.B — Linh căn / Ngũ Hành element wire.
    // characterSkillElementBonus = elementMultiplier(skill,target) + character
    // primary +0.10 / secondary +0.05 nếu skill cùng hệ. Legacy character
    // (primaryElement=null) → bypass character bonus, chỉ dùng base multiplier.
    const charElementState =
      char.primaryElement && char.spiritualRootGrade
        ? {
            primaryElement: char.primaryElement as ElementKey,
            secondaryElements: char.secondaryElements as ElementKey[],
          }
        : null;
    const playerElementMul = characterSkillElementBonus(
      charElementState,
      skill.element ?? null,
      monster.element ?? null,
    );

    // — Player attack
    const dmgBase = rollDamage(effPower, monster.def, skill.atkScale);
    const dmg = Math.max(1, Math.round(dmgBase * playerElementMul));
    let monsterHp = state.monsterHp - dmg;
    charMp -= skill.mpCost;
    if (skill.selfBloodCost > 0) {
      const lose = Math.max(1, Math.floor(char.hpMax * skill.selfBloodCost));
      charHp = Math.max(1, charHp - lose);
      log.push({ side: 'player', text: `Hi sinh ${lose} HP để dụng ${skill.name}.`, ts: Date.now() });
    }
    log.push({
      side: 'player',
      text: `Đạo hữu tung ${skill.name}, gây ${dmg} sát thương lên ${monster.name}.`,
      ts: Date.now(),
    });
    if (playerElementMul >= 1.15) {
      log.push({
        side: 'system',
        text: `Ngũ Hành tương khắc/sinh — sát thương khuếch đại ×${playerElementMul.toFixed(2)}.`,
        ts: Date.now(),
      });
    } else if (playerElementMul <= 0.9) {
      log.push({
        side: 'system',
        text: `Ngũ Hành lệch hệ — sát thương suy giảm ×${playerElementMul.toFixed(2)}.`,
        ts: Date.now(),
      });
    }

    let healLine: EncounterLogLine | null = null;
    if (skill.selfHealRatio > 0) {
      const heal = Math.floor(char.hpMax * skill.selfHealRatio);
      const before = charHp;
      charHp = Math.min(char.hpMax, charHp + heal);
      healLine = {
        side: 'player',
        text: `Linh khí xoay vần, hồi ${charHp - before} HP.`,
        ts: Date.now(),
      };
      log.push(healLine);
    }

    let nextStatus: EncounterStatus = EncounterStatus.ACTIVE;
    let nextState: EncounterState = { ...state, monsterHp };
    let reward: EncounterView['reward'] = null;
    let expGain = 0n;
    let linhThachGain = 0n;

    if (monsterHp <= 0) {
      log.push({
        side: 'system',
        text: `${monster.name} đổ xuống — đắc thủ ${monster.expDrop} EXP, ${monster.linhThachDrop} linh thạch.`,
        ts: Date.now(),
      });
      expGain += BigInt(monster.expDrop);
      linhThachGain += BigInt(monster.linhThachDrop);

      const nextIdx = state.monsterIndex + 1;
      if (nextIdx >= dungeon.monsters.length) {
        nextStatus = EncounterStatus.WON;
        log.push({
          side: 'system',
          text: `Chinh phục ${dungeon.name} thành công, đạo hữu thoát quan.`,
          ts: Date.now(),
        });
        nextState = { monsterIndex: nextIdx, monsterHp: 0 };
      } else {
        const nextMonster = monsterByKey(dungeon.monsters[nextIdx]);
        if (nextMonster) {
          nextState = { monsterIndex: nextIdx, monsterHp: nextMonster.hp };
          log.push({
            side: 'system',
            text: `${nextMonster.name} (Lv.${nextMonster.level}) lao tới.`,
            ts: Date.now(),
          });
        }
      }
    } else {
      // — Monster counter-attack (Phase 11.3.B — element vs character primary)
      const replyBase = rollDamage(monster.atk, char.spirit + effPower * 0.3 + effDef, 1);
      const monsterElementMul = elementMultiplier(
        (monster.element ?? null) as ElementKey | null,
        (char.primaryElement ?? null) as ElementKey | null,
      );
      const reply = Math.max(1, Math.round(replyBase * monsterElementMul));
      charHp -= reply;
      log.push({
        side: 'monster',
        text: `${monster.name} phản kích, gây ${reply} sát thương.`,
        ts: Date.now(),
      });
      if (charHp <= 0) {
        nextStatus = EncounterStatus.LOST;
        charHp = 1;
        log.push({
          side: 'system',
          text: `Đạo hữu rơi vào hôn mê, đan điền tổn thương — phải hồi phục mới có thể chiến tiếp.`,
          ts: Date.now(),
        });
      }
    }

    // Persist encounter & character.
    await this.prisma.encounter.update({
      where: { id: enc.id },
      data: {
        status: nextStatus,
        state: nextState as unknown as Prisma.InputJsonValue,
        log: log as unknown as Prisma.InputJsonValue,
      },
    });

    const newStamina = Math.max(0, char.stamina - STAMINA_PER_ACTION);
    const updateChar: Prisma.CharacterUpdateInput = {
      hp: charHp,
      mp: charMp,
      stamina: newStamina,
    };
    if (expGain > 0n) updateChar.exp = { increment: expGain };

    // Bao trong tx để character.update + ledger row cùng commit/rollback.
    await this.prisma.$transaction(async (tx) => {
      await tx.character.update({ where: { id: char.id }, data: updateChar });
      if (linhThachGain > 0n) {
        await this.currency.applyTx(tx, {
          characterId: char.id,
          currency: CurrencyKind.LINH_THACH,
          delta: linhThachGain,
          reason: 'COMBAT_LOOT',
          refType: 'Encounter',
          refId: enc.id,
          meta: {
            dungeonKey: dungeon.key,
            status: nextStatus,
          },
        });
      }
    });

    const lootView: EncounterRewardLoot[] = [];
    if (nextStatus === EncounterStatus.WON) {
      const loot = rollDungeonLoot(dungeon.key, 2);
      if (loot.length > 0) {
        await this.inventory.grant(char.id, loot, {
          reason: 'COMBAT_LOOT',
          refType: 'Encounter',
          refId: enc.id,
          extra: { dungeonKey: dungeon.key },
        });
        for (const l of loot) {
          const def = itemByKey(l.itemKey);
          if (!def) continue;
          lootView.push({
            itemKey: l.itemKey,
            qty: l.qty,
            itemName: def.name,
            quality: def.quality,
          });
        }
        log.push({
          side: 'system',
          text: `Đắc thủ chiến lợi: ${lootView
            .map((l) => `${l.itemName} ×${l.qty}`)
            .join(', ')}.`,
          ts: Date.now(),
        });
        // Cập nhật log lần nữa với dòng loot.
        await this.prisma.encounter.update({
          where: { id: enc.id },
          data: { log: log as unknown as Prisma.InputJsonValue },
        });
      }
    }

    if (nextStatus === EncounterStatus.WON || nextStatus === EncounterStatus.LOST) {
      reward = {
        exp: expGain.toString(),
        linhThach: linhThachGain.toString(),
        loot: lootView,
      };
    }

    // Mission tracking — dựa trên transition. Một turn có thể vừa kill monster
    // vừa (nếu là quái cuối) clear dungeon. Không throw nếu mission lỗi.
    try {
      if (monsterHp <= 0) {
        await this.missions.track(char.id, 'KILL_MONSTER', 1);
      }
      if (nextStatus === EncounterStatus.WON) {
        await this.missions.track(char.id, 'CLEAR_DUNGEON', 1);
      }
    } catch {
      // bỏ qua
    }

    const charState = await this.chars.findByUser(userId);
    if (charState) this.realtime.emitToUser(userId, 'state:update', charState);

    const finalEnc = await this.prisma.encounter.findUniqueOrThrow({ where: { id: enc.id } });
    const view = this.toView(finalEnc);
    view.reward = reward;
    return view;
  }

  async abandon(userId: string, encounterId: string): Promise<EncounterView> {
    const char = await this.prisma.character.findUnique({ where: { userId } });
    if (!char) throw new CombatError('NO_CHARACTER');
    const enc = await this.prisma.encounter.findUnique({ where: { id: encounterId } });
    if (!enc || enc.characterId !== char.id) throw new CombatError('ENCOUNTER_NOT_FOUND');
    if (enc.status !== EncounterStatus.ACTIVE) throw new CombatError('ENCOUNTER_ENDED');

    const log: EncounterLogLine[] = [
      ...((enc.log as unknown as EncounterLogLine[]) ?? []),
      { side: 'system', text: 'Đạo hữu rút lui khỏi ải.', ts: Date.now() },
    ];
    const updated = await this.prisma.encounter.update({
      where: { id: enc.id },
      data: {
        status: EncounterStatus.ABANDONED,
        log: log as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toView(updated);
  }

  private toView(e: {
    id: string;
    dungeonKey: string;
    status: EncounterStatus;
    state: Prisma.JsonValue;
    log: Prisma.JsonValue;
  }): EncounterView {
    const dungeon = dungeonByKey(e.dungeonKey);
    if (!dungeon) {
      throw new CombatError('DUNGEON_NOT_FOUND');
    }
    const st = (e.state as unknown as EncounterState) ?? { monsterIndex: 0, monsterHp: 0 };
    const monster = monsterByKey(dungeon.monsters[st.monsterIndex]) ?? null;
    return {
      id: e.id,
      dungeon,
      status: e.status,
      monster,
      monsterHp: st.monsterHp,
      monsterIndex: st.monsterIndex,
      log: ((e.log as unknown as EncounterLogLine[]) ?? []).slice(-30),
      reward: null,
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
}

export { CombatError };
