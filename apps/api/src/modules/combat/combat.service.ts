import { Injectable } from '@nestjs/common';
import { Prisma, EncounterStatus } from '@prisma/client';
import {
  DUNGEONS,
  STAMINA_PER_ACTION,
  SKILL_BASIC_ATTACK,
  dungeonByKey,
  monsterByKey,
  rollDamage,
  skillByKey,
  type DungeonDef,
  type MonsterDef,
  type SectKey,
  type SkillDef,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';

export interface EncounterState {
  monsterIndex: number;
  monsterHp: number;
}

export interface EncounterLogLine {
  side: 'player' | 'monster' | 'system';
  text: string;
  ts: number;
}

export interface EncounterView {
  id: string;
  dungeon: DungeonDef;
  status: EncounterStatus;
  monster: MonsterDef | null;
  monsterHp: number;
  monsterIndex: number;
  log: EncounterLogLine[];
  reward: { exp: string; linhThach: string } | null;
}

interface ActionInput {
  skillKey?: string;
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

    const log: EncounterLogLine[] = [
      ...((enc.log as unknown as EncounterLogLine[]) ?? []),
    ];

    // — Player attack
    const dmg = rollDamage(char.power, monster.def, skill.atkScale);
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
      // — Monster counter-attack
      const reply = rollDamage(monster.atk, char.spirit + char.power * 0.3, 1);
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
    if (linhThachGain > 0n) updateChar.linhThach = { increment: linhThachGain };

    await this.prisma.character.update({ where: { id: char.id }, data: updateChar });

    if (nextStatus === EncounterStatus.WON || nextStatus === EncounterStatus.LOST) {
      reward = {
        exp: expGain.toString(),
        linhThach: linhThachGain.toString(),
      };
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
