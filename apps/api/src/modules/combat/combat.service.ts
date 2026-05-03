import { Injectable, Optional } from '@nestjs/common';
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
  type EffectiveSkill,
  type MonsterDef,
  type SectKey,
  type SkillDef,
  type SpiritualRootGrade,
} from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CharacterSkillService } from '../character/character-skill.service';
import { CurrencyService } from '../character/currency.service';
import { AchievementService } from '../character/achievement.service';
import { TalentService } from '../character/talent.service';
import { BuffService } from '../character/buff.service';
import { TitleService } from '../character/title.service';
import { methodStatBonusFor } from '../character/cultivation-method.service';
import { InventoryService } from '../inventory/inventory.service';
import { MissionService } from '../mission/mission.service';
import { composePassiveTalentMods, type PassiveTalentMods } from '@xuantoi/shared';
import { composeBuffMods, type BuffMods } from '@xuantoi/shared';
import { composeTitleMods, type TitleMods } from '@xuantoi/shared';

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
      | 'MP_LOW'
      | 'CONTROLLED',
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
    @Optional() private readonly characterSkill?: CharacterSkillService,
    @Optional() private readonly achievements?: AchievementService,
    @Optional() private readonly talents?: TalentService,
    @Optional() private readonly buffs?: BuffService,
    @Optional() private readonly titles?: TitleService,
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

    // Phase 11.2.B — compose mastery effect. Legacy character (no
    // CharacterSkill row) → masteryLevel = 0 → no bonus. Service không
    // injected (legacy DI) → fallback baseline.
    const effective: EffectiveSkill = this.characterSkill
      ? await this.characterSkill.getEffectiveSkillFor(char.id, skill)
      : baselineEffective(skill);

    let charHp = char.hp;
    let charMp = char.mp;
    if (charMp < effective.mpCost) throw new CombatError('MP_LOW');

    const equip = await this.inventory.equipBonus(char.id);
    // Phase 11.3.C — Linh căn statBonusPercent wire vào atk/def.
    // Legacy character (spiritualRootGrade=null) → statMul = 1.0.
    const statMul = isValidSpiritualRootGrade(char.spiritualRootGrade)
      ? 1 + getSpiritualRootGradeDef(char.spiritualRootGrade).statBonusPercent / 100
      : 1.0;
    // Phase 11.7.C — Talent passive mods compose. Legacy character (no
    // talent learned) → all multipliers identity (1.0). Service không
    // injected (legacy DI hoặc test fixture) → fallback identity baseline.
    const talentMods: PassiveTalentMods = this.talents
      ? await this.talents.getMods(char.id)
      : composePassiveTalentMods([]);
    // Phase 11.8.C — Buff/debuff stat mods compose. No active buffs or service
    // not injected → identity baseline (all mul = 1.0, all flat = 0).
    const buffMods: BuffMods = this.buffs
      ? await this.buffs.getMods(char.id)
      : composeBuffMods([]);
    // Phase 11.X.O — Buff control (root/stun/silence) block player action.
    // `controlTurnsMax > 0` khi có active control debuff trong DB
    // (`debuff_root_thuy` 3 turns, `debuff_stun_tho` 1 turn, `debuff_silence_kim`
    // 2 turns). Identity (0, no-op) khi service không injected hoặc không có
    // control debuff. Throw EARLY trước mọi state mutation: encounter status,
    // character HP/MP/stamina, ledger row đều không đụng tới. Player nhận lại
    // CombatError('CONTROLLED') và phải chờ debuff hết hạn (expiresAt sweep).
    if (buffMods.controlTurnsMax > 0) {
      throw new CombatError('CONTROLLED');
    }
    // Phase 11.9.C — Title flavor stat mods compose. No equipped title or
    // service không injected → identity baseline (atkMul=defMul=spiritMul=1).
    // Multiplicative compose với linh căn × talent × buff (Phase 11.3.C/11.7.C/11.8.C).
    // hpMaxMul/mpMaxMul KHÔNG wire ở đây — là stat cap modifier (defer
    // CharacterStatService.computeStats), không ảnh hưởng combat action.
    const titleMods: TitleMods = this.titles
      ? await this.titles.getMods(char.id)
      : composeTitleMods([]);
    // Phase 11.1.D — Cultivation method statBonus.atk/defPercent wire vào
    // effPower/effDef. Catalog huyen-grade `cuu_cuc_kim_cuong_quyet` (atk +5%,
    // def +12%) v.v. — trước đó `statBonus` được khai báo nhưng KHÔNG consume
    // runtime. Pure helper `methodStatBonusFor` legacy (key=null) → identity.
    // Pham starter `khai_thien_quyet` (0%) → identity. hpMaxMul/mpMaxMul là
    // stat cap (defer `CharacterStatService.computeStats`), KHÔNG wire ở đây.
    const methodStat = methodStatBonusFor(char.equippedCultivationMethodKey);
    const effPower =
      (char.power + equip.atk) *
      statMul *
      talentMods.atkMul *
      buffMods.atkMul *
      titleMods.atkMul *
      methodStat.atkMul;
    const effDef =
      equip.def *
      statMul *
      talentMods.defMul *
      buffMods.defMul *
      titleMods.defMul *
      methodStat.defMul;

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
    // Phase 11.7.C — Talent damage_bonus theo element. Compound multiplicative
    // với element bonus (Linh căn) — talent passive ngộ đạo theo hệ.
    const skillElement = skill.element ?? null;
    const talentElementMul =
      skillElement !== null
        ? talentMods.damageBonusByElement.get(skillElement) ?? 1
        : 1;
    // Phase 11.8.C — Buff damage_bonus theo element. Compound multiplicative
    // với talent + linh căn element bonus.
    const buffElementMul =
      skillElement !== null
        ? buffMods.damageBonusByElement.get(skillElement) ?? 1
        : 1;

    // — Player attack (Phase 11.2.B — atkScale + mpCost từ mastery curve)
    const dmgBase = rollDamage(effPower, monster.def, effective.atkScale);
    const dmg = Math.max(1, Math.round(dmgBase * playerElementMul * talentElementMul * buffElementMul));
    let monsterHp = state.monsterHp - dmg;
    charMp -= effective.mpCost;
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
      // Phase 11.7.C — Talent expMul (exp_bonus) + dropMul (drop_bonus) wire.
      // Floor để giữ BigInt deterministic, mul = 1 → identity (no change).
      const expDropEff = Math.max(0, Math.floor(monster.expDrop * talentMods.expMul));
      const linhThachDropEff = Math.max(
        0,
        Math.floor(monster.linhThachDrop * talentMods.dropMul),
      );
      log.push({
        side: 'system',
        text: `${monster.name} đổ xuống — đắc thủ ${expDropEff} EXP, ${linhThachDropEff} linh thạch.`,
        ts: Date.now(),
      });
      expGain += BigInt(expDropEff);
      linhThachGain += BigInt(linhThachDropEff);

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
      // Phase 11.8.C — spiritMul buff wire vào defense calc.
      // Phase 11.9.C — title spiritMul compose (mythic/legendary title flavor).
      // Phase 11.4.D — equip.spiritBonus (item base spirit + gem spirit socket
      // bonus + refine multiplier, đã compute ở `inventory.equipBonus`) cộng
      // additive vào base spirit, sau đó multiply với buff/title spiritMul.
      // Cùng pattern (base + flat) × multipliers như atk: line 232.
      // Phase 11.X.U — talent spiritMul wire. `composePassiveTalentMods`
      // produces `spiritMul` từ `kind=stat_mod, statTarget=spirit`. Hiện tại
      // catalog không có talent producer (talent_kim_thien_co=atk,
      // talent_thuy_long_an=hpMax, talent_tho_son_tuong=def, etc.) → identity
      // 1.0 → zero balance impact. Wire để pattern coverage nhất quán với
      // atkMul/defMul/damageBonusByElement/dropMul/expMul đã wire (#251) và
      // future-proof cho talent spirit producer (vd `talent_huyen_thuy_tam`
      // future +10% spirit). Service không inject (legacy DI/test fixture)
      // → talentMods=identity baseline → no-op.
      const effSpirit =
        (char.spirit + equip.spiritBonus) *
        talentMods.spiritMul *
        buffMods.spiritMul *
        titleMods.spiritMul;
      const replyBase = rollDamage(monster.atk, effSpirit + effPower * 0.3 + effDef, 1);
      const monsterElementMul = elementMultiplier(
        (monster.element ?? null) as ElementKey | null,
        (char.primaryElement ?? null) as ElementKey | null,
      );
      // Phase 11.8.C — damageReductionByElement buff wire: reduce incoming
      // damage from monster's element. Identity (1.0) khi no buff hoặc
      // monster element không match.
      const monsterElemKey = (monster.element ?? null) as ElementKey | null;
      const buffDmgReduction =
        monsterElemKey !== null
          ? buffMods.damageReductionByElement.get(monsterElemKey) ?? 1
          : 1;
      const reply = Math.max(1, Math.round(replyBase * monsterElementMul * buffDmgReduction));
      log.push({
        side: 'monster',
        text: `${monster.name} phản kích, gây ${reply} sát thương.`,
        ts: Date.now(),
      });
      // Phase 11.X.V — Buff invuln (kind=invuln) override: nullify all
      // monster reply damage. Áp PRE-shield: invuln là "ignore all damage"
      // theo spec → không cần shield absorb tốn. Identity false → no-op
      // (hiện tại catalog chưa có producer cho `kind=invuln`, dành future
      // buff design). Pattern coverage nhất quán với cultivationBlocked
      // (#270) + control (#264) — boolean buff state gates damage path.
      if (buffMods.invulnActive) {
        log.push({
          side: 'system',
          text: `Bất tử — vô hiệu hóa toàn bộ sát thương phản kích.`,
          ts: Date.now(),
        });
      } else {
        // Phase 11.X.N — Buff shield (talent_shield_phong: 30% hpMax, etc.)
        // absorb monster reply damage. `shieldAbsorb = floor(char.hpMax *
        // buffMods.shieldHpMaxRatio)` re-applied mỗi turn còn buff active
        // (per-turn refresh aura model). Buff hết hạn (`expiresAt` sweep) →
        // shieldHpMaxRatio = 0 → no absorb. Identity (0, no-op) khi service
        // không injected hoặc no shield buff. KHÔNG mutate buff DB row —
        // duration-based, không depletion-based.
        const shieldAbsorb = Math.floor(char.hpMax * buffMods.shieldHpMaxRatio);
        const absorbed = Math.min(shieldAbsorb, reply);
        const netReply = reply - absorbed;
        if (absorbed > 0) {
          log.push({
            side: 'system',
            text: `Khiên hấp thu ${absorbed} sát thương.`,
            ts: Date.now(),
          });
        }
        charHp -= netReply;
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
    }

    // Phase 11.X.M — Buff DOT (debuff_burn_hoa, debuff_poison_moc) per-turn HP
    // loss. Áp end-of-turn cho encounter còn ACTIVE (đã không WON/LOST do
    // player attack / monster reply). `dotPerTickFlat` đã tính theo stack
    // (composeBuffMods stack handler: value × stacks). Service không inject
    // hoặc no dot debuff active → identity (0, no-op).
    // Phase 11.X.V — invulnActive cũng skip DOT damage (spec: "ignore all
    // damage"). Identity false → DOT vẫn áp. Future-proof.
    const dotDmg = Math.floor(buffMods.dotPerTickFlat);
    if (dotDmg > 0 && nextStatus === EncounterStatus.ACTIVE && !buffMods.invulnActive) {
      charHp = Math.max(0, charHp - dotDmg);
      log.push({
        side: 'system',
        text: `Độc/bỏng phát tác — chịu ${dotDmg} sát thương DOT.`,
        ts: Date.now(),
      });
      if (charHp <= 0) {
        nextStatus = EncounterStatus.LOST;
        charHp = 1;
        log.push({
          side: 'system',
          text: `Đạo hữu hôn mê do độc/bỏng — chiến đấu thất bại.`,
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

    // Mission + Achievement tracking — dựa trên transition. Một turn có thể
    // vừa kill monster vừa (nếu là quái cuối) clear dungeon. Không throw nếu
    // mission/achievement lỗi (Phase 11.10.C-2 wire trackEvent vào achievement
    // bằng cùng goalKind với mission — fail-soft).
    try {
      if (monsterHp <= 0) {
        await this.missions.track(char.id, 'KILL_MONSTER', 1);
        if (this.achievements) {
          await this.achievements.trackEvent(char.id, 'KILL_MONSTER', 1);
        }
      }
      if (nextStatus === EncounterStatus.WON) {
        await this.missions.track(char.id, 'CLEAR_DUNGEON', 1);
        if (this.achievements) {
          await this.achievements.trackEvent(char.id, 'CLEAR_DUNGEON', 1);
        }
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

/**
 * Phase 11.2.B fallback — khi `CharacterSkillService` không inject (legacy
 * test setup, integration không cần mastery), trả EffectiveSkill từ
 * baseline `SkillDef` không bonus. Tránh CombatService bị break khi
 * service vắng mặt.
 */
function baselineEffective(skill: SkillDef): EffectiveSkill {
  return {
    key: skill.key,
    atkScale: skill.atkScale,
    mpCost: skill.mpCost,
    selfHealRatio: skill.selfHealRatio,
    selfBloodCost: skill.selfBloodCost,
    cooldownTurns: skill.cooldownTurns ?? 0,
    element: skill.element ?? null,
    sect: skill.sect,
    masteryLevel: 0,
    tier: 'basic',
  };
}

export { CombatError };
