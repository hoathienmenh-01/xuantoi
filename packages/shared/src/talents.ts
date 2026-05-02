/**
 * Talent / Thần Thông catalog foundation — Phase 11.7.A
 *
 * Pure data + deterministic helpers. KHÔNG runtime/schema/migration.
 *
 * Design intent (P11-7):
 * - 5–7 talent **passive** (always-on khi đã học): stat mod, regen, drop/exp bonus.
 * - 5–7 talent **active "thần thông"** (cooldown-based, tốn MP): damage AOE/single,
 *   crowd control, heal, DOT, utility.
 * - Unlock qua "ngộ đạo" milestone: mỗi 3 realm threshold trigger 1 talent point.
 *   `phamnhan(0)..thanh_nhan(20)` → ~6–7 talent points.
 * - Phase 11.7.B runtime sẽ thêm Prisma `CharacterTalent { characterId, talentKey, learnedAt }`
 *   + service `learnTalent` / `useActiveTalent` qua mp consume + cooldown enforcement.
 *
 * Convention:
 * - `realmRequirement`: realm key tối thiểu để có thể học (server enforce).
 * - `talentPointCost`: số điểm ngộ đạo cần để học (1/2/3 tier scale).
 * - Passive: effect áp dụng vào `CharacterStatService.computeStats` (Phase 11.7.B).
 * - Active: combat skill flow (mp cost + cooldown turns), gọi qua `simulateActiveTalent`.
 *
 * Curve (15 talent tổng):
 * - 8 passive + 7 active.
 * - 5 element coverage (kim/moc/thuy/hoa/tho) trên cả 2 type + 4 neutral talent.
 */

import type { ElementKey } from './combat';

export type TalentType = 'passive' | 'active';

/**
 * Sub-kind cho passive effect → driving CharacterStatService.computeStats.
 * - `stat_mod`: + multiplier vào atk/def/hpMax/mpMax/spirit
 * - `regen`: + flat hp/mp regen mỗi tick combat
 * - `drop_bonus`: + multiplier loot drop rate
 * - `exp_bonus`: + multiplier exp gain
 * - `damage_bonus`: + multiplier damage vs specific element (counter)
 */
export type PassiveTalentKind =
  | 'stat_mod'
  | 'regen'
  | 'drop_bonus'
  | 'exp_bonus'
  | 'damage_bonus';

/**
 * Sub-kind cho active "thần thông" effect.
 * - `damage`: deal damage scale theo atk hoặc spirit
 * - `cc`: crowd control (root/stun/silence)
 * - `heal`: hồi hp
 * - `dot`: damage over time (burn/poison)
 * - `utility`: dispel, shield, teleport, escape
 */
export type ActiveTalentKind = 'damage' | 'cc' | 'heal' | 'dot' | 'utility';

export type StatTarget = 'atk' | 'def' | 'hpMax' | 'mpMax' | 'spirit';

export interface PassiveTalentEffect {
  readonly kind: PassiveTalentKind;
  /** Multiplier (1.10 = +10%) hoặc flat value (regen). */
  readonly value: number;
  /** Stat target cho `stat_mod` / `regen`. */
  readonly statTarget: StatTarget | null;
  /** Element target cho `damage_bonus` (vs enemy element). */
  readonly elementTarget: ElementKey | null;
}

export interface ActiveTalentEffect {
  readonly kind: ActiveTalentKind;
  /** Multiplier vào atk/spirit (damage/heal) hoặc duration turns (cc/dot). */
  readonly value: number;
  /** AoE = true thì hit all, false thì single target. */
  readonly aoe: boolean;
  /** Cooldown turns sau mỗi lần dùng. */
  readonly cooldownTurns: number;
  /** MP cost mỗi lần phát động. */
  readonly mpCost: number;
}

export interface TalentDef {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly type: TalentType;
  /** Element của talent (null = neutral). */
  readonly element: ElementKey | null;
  /** Realm key tối thiểu để học. */
  readonly realmRequirement: string;
  /** Số ngộ-đạo điểm cần để học (1/2/3). */
  readonly talentPointCost: number;
  /** Effect: passive xor active. */
  readonly passiveEffect: PassiveTalentEffect | null;
  readonly activeEffect: ActiveTalentEffect | null;
}

/**
 * 15 talent baseline cover passive + active × 5 element + neutral.
 * (Phase 11.X.AA: thêm `talent_huyen_thuy_tam` thuy +10% spirit — producer
 * đầu tiên cho `composePassiveTalentMods.spiritMul`, activate Phase 11.4.G
 * (boss spirit branch wire) + Phase 11.X.U (combat effSpirit defense wire).)
 *
 * Stable order: passive trước → active sau.
 */
export const TALENTS: readonly TalentDef[] = [
  // ===== PASSIVE TALENTS (8) =====
  {
    key: 'talent_kim_thien_co',
    name: 'Kim Thiên Cơ',
    description: 'Linh hồn hấp thu kim khí thiên địa, +10% sát thương vật lý.',
    type: 'passive',
    element: 'kim',
    realmRequirement: 'kim_dan',
    talentPointCost: 1,
    passiveEffect: {
      kind: 'stat_mod',
      value: 1.1,
      statTarget: 'atk',
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_thuy_long_an',
    name: 'Thuỷ Long Ấn',
    description: 'Thân thể như thuỷ long, +10% HP tối đa.',
    type: 'passive',
    element: 'thuy',
    realmRequirement: 'kim_dan',
    talentPointCost: 1,
    passiveEffect: {
      kind: 'stat_mod',
      value: 1.1,
      statTarget: 'hpMax',
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_huyen_thuy_tam',
    name: 'Huyền Thuỷ Tâm',
    description: 'Linh tâm hấp thu thuỷ khí huyền diệu, +10% linh khí công kích.',
    type: 'passive',
    element: 'thuy',
    realmRequirement: 'kim_dan',
    talentPointCost: 1,
    passiveEffect: {
      kind: 'stat_mod',
      value: 1.1,
      statTarget: 'spirit',
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_moc_linh_quy',
    name: 'Mộc Linh Quy',
    description: 'Linh khí mộc tự hồi, +5 HP regen mỗi tick combat.',
    type: 'passive',
    element: 'moc',
    realmRequirement: 'truc_co',
    talentPointCost: 1,
    passiveEffect: {
      kind: 'regen',
      value: 5,
      statTarget: 'hpMax',
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_hoa_tam_dao',
    name: 'Hoả Tâm Đạo',
    description: 'Tâm tựa hoả thiêu, +15% sát thương lên kẻ thù hệ Kim (tương khắc).',
    type: 'passive',
    element: 'hoa',
    realmRequirement: 'kim_dan',
    talentPointCost: 2,
    passiveEffect: {
      kind: 'damage_bonus',
      value: 1.15,
      statTarget: null,
      elementTarget: 'kim',
    },
    activeEffect: null,
  },
  {
    key: 'talent_tho_son_tuong',
    name: 'Thổ Sơn Tướng',
    description: 'Thân giáp như thổ sơn, +10% phòng ngự.',
    type: 'passive',
    element: 'tho',
    realmRequirement: 'truc_co',
    talentPointCost: 1,
    passiveEffect: {
      kind: 'stat_mod',
      value: 1.1,
      statTarget: 'def',
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_thien_di',
    name: 'Thiên Di',
    description: 'Cảm ngộ thiên đạo, +20% tỉ lệ rớt đồ từ quái/dungeon.',
    type: 'passive',
    element: null,
    realmRequirement: 'nguyen_anh',
    talentPointCost: 2,
    passiveEffect: {
      kind: 'drop_bonus',
      value: 1.2,
      statTarget: null,
      elementTarget: null,
    },
    activeEffect: null,
  },
  {
    key: 'talent_ngo_dao',
    name: 'Ngộ Đạo',
    description: 'Tâm cảnh thông suốt, +15% EXP tu vi mỗi lần tu luyện.',
    type: 'passive',
    element: null,
    realmRequirement: 'hoa_than',
    talentPointCost: 2,
    passiveEffect: {
      kind: 'exp_bonus',
      value: 1.15,
      statTarget: null,
      elementTarget: null,
    },
    activeEffect: null,
  },

  // ===== ACTIVE TALENTS / THẦN THÔNG (7) =====
  {
    key: 'talent_kim_quang_tram',
    name: 'Kim Quang Trảm',
    description: 'Vung kim kiếm chém AOE 2× atk, mp cost 30, cooldown 3 lượt.',
    type: 'active',
    element: 'kim',
    realmRequirement: 'kim_dan',
    talentPointCost: 2,
    passiveEffect: null,
    activeEffect: {
      kind: 'damage',
      value: 2.0,
      aoe: true,
      cooldownTurns: 3,
      mpCost: 30,
    },
  },
  {
    key: 'talent_thuy_yen_nguc',
    name: 'Thuỷ Yên Ngục',
    description: 'Khoá kẻ thù trong ngục thuỷ 3 lượt, mp cost 25, cooldown 5 lượt.',
    type: 'active',
    element: 'thuy',
    realmRequirement: 'kim_dan',
    talentPointCost: 2,
    passiveEffect: null,
    activeEffect: {
      kind: 'cc',
      value: 3,
      aoe: false,
      cooldownTurns: 5,
      mpCost: 25,
    },
  },
  {
    key: 'talent_moc_chu_lam',
    name: 'Mộc Chu Lâm',
    description: 'Triệu rừng mộc hồi 30% HP cho mình, mp cost 40, cooldown 6 lượt.',
    type: 'active',
    element: 'moc',
    realmRequirement: 'truc_co',
    talentPointCost: 1,
    passiveEffect: null,
    activeEffect: {
      kind: 'heal',
      value: 0.3,
      aoe: false,
      cooldownTurns: 6,
      mpCost: 40,
    },
  },
  {
    key: 'talent_hoa_long_phun',
    name: 'Hoả Long Phún',
    description: 'Hoả long phun lửa, burn DOT 5 lượt = 0.5× spirit/lượt, mp cost 35, cd 4.',
    type: 'active',
    element: 'hoa',
    realmRequirement: 'kim_dan',
    talentPointCost: 2,
    passiveEffect: null,
    activeEffect: {
      kind: 'dot',
      value: 5,
      aoe: false,
      cooldownTurns: 4,
      mpCost: 35,
    },
  },
  {
    key: 'talent_tho_dia_chan',
    name: 'Thổ Địa Chấn',
    description: 'Chấn động đất stun toàn AOE 1 lượt, mp cost 45, cooldown 6 lượt.',
    type: 'active',
    element: 'tho',
    realmRequirement: 'nguyen_anh',
    talentPointCost: 2,
    passiveEffect: null,
    activeEffect: {
      kind: 'cc',
      value: 1,
      aoe: true,
      cooldownTurns: 6,
      mpCost: 45,
    },
  },
  {
    key: 'talent_thien_loi_trung_tri',
    name: 'Thiên Lôi Trừng Trị',
    description: 'Triệu thiên lôi gây true damage 3× spirit (bỏ qua def), mp 50, cd 7.',
    type: 'active',
    element: null,
    realmRequirement: 'hoa_than',
    talentPointCost: 3,
    passiveEffect: null,
    activeEffect: {
      kind: 'damage',
      value: 3.0,
      aoe: false,
      cooldownTurns: 7,
      mpCost: 50,
    },
  },
  {
    key: 'talent_phong_lui',
    name: 'Phong Lui Pháp Tướng',
    description: 'Triệu phong pháp tướng escape combat, mp cost 60, cooldown 10 lượt.',
    type: 'active',
    element: null,
    realmRequirement: 'luyen_hu',
    talentPointCost: 3,
    passiveEffect: null,
    activeEffect: {
      kind: 'utility',
      value: 1,
      aoe: false,
      cooldownTurns: 10,
      mpCost: 60,
    },
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Lookup talent theo key.
 */
export function getTalentDef(key: string): TalentDef | undefined {
  return TALENTS.find((t) => t.key === key);
}

/**
 * Filter theo type.
 */
export function talentsByType(type: TalentType): readonly TalentDef[] {
  return TALENTS.filter((t) => t.type === type);
}

/**
 * Filter theo element (null = neutral talent).
 */
export function talentsByElement(
  element: ElementKey | null
): readonly TalentDef[] {
  return TALENTS.filter((t) => t.element === element);
}

/**
 * Filter theo realm requirement (talent có thể học ở realm này).
 *
 * @param currentRealmOrder Order của realm hiện tại (REALMS[i].order)
 * @param realmKeyToOrder Map từ realm key → order (để check threshold)
 */
export function talentsAvailableAtRealm(
  currentRealmOrder: number,
  realmKeyToOrder: ReadonlyMap<string, number>
): readonly TalentDef[] {
  if (!Number.isFinite(currentRealmOrder) || currentRealmOrder < 0) {
    throw new Error(
      `currentRealmOrder must be non-negative finite, got ${currentRealmOrder}`
    );
  }
  return TALENTS.filter((t) => {
    const reqOrder = realmKeyToOrder.get(t.realmRequirement);
    if (reqOrder === undefined) return false;
    return reqOrder <= currentRealmOrder;
  });
}

/**
 * Tính số talent point sẵn có theo realm milestone:
 * "Mỗi 3 realm threshold trigger 1 ngộ-đạo point".
 *
 * Ex:
 * - phamnhan(0): 0 points (chưa có realm).
 * - luyenkhi(1): 0 points.
 * - truc_co(2): 0 points.
 * - kim_dan(3): 1 point (3 realms = first milestone).
 * - nguyen_anh(4): 1 point.
 * - hoa_than(5): 1 point.
 * - luyen_hu(6): 2 points (6 realms = second milestone).
 * - ...
 *
 * @param currentRealmOrder Order của realm hiện tại
 */
export function computeTalentPointBudget(currentRealmOrder: number): number {
  if (!Number.isFinite(currentRealmOrder) || currentRealmOrder < 0) {
    throw new Error(
      `currentRealmOrder must be non-negative finite, got ${currentRealmOrder}`
    );
  }
  return Math.floor(currentRealmOrder / 3);
}

/**
 * Check character có thể học talent này:
 * 1. Đạt realm requirement?
 * 2. Còn đủ talent point budget (chưa spent)?
 *
 * @returns Object `{ canLearn, reason }`
 */
export function canCharacterLearnTalent(
  talent: TalentDef,
  currentRealmOrder: number,
  realmKeyToOrder: ReadonlyMap<string, number>,
  pointsAlreadySpent: number
): { canLearn: boolean; reason: string | null } {
  const reqOrder = realmKeyToOrder.get(talent.realmRequirement);
  if (reqOrder === undefined) {
    return { canLearn: false, reason: 'invalid_realm_requirement' };
  }
  if (currentRealmOrder < reqOrder) {
    return { canLearn: false, reason: 'realm_too_low' };
  }
  const budget = computeTalentPointBudget(currentRealmOrder);
  const remaining = budget - pointsAlreadySpent;
  if (remaining < talent.talentPointCost) {
    return { canLearn: false, reason: 'insufficient_talent_points' };
  }
  return { canLearn: true, reason: null };
}

/**
 * Compose passive talent stat mods từ list talent đã học.
 *
 * @returns Object `{ atkMul, defMul, hpMaxMul, mpMaxMul, spiritMul, hpRegenFlat, dropMul, expMul, damageBonusByElement }`
 */
export interface PassiveTalentMods {
  readonly atkMul: number;
  readonly defMul: number;
  readonly hpMaxMul: number;
  readonly mpMaxMul: number;
  readonly spiritMul: number;
  readonly hpRegenFlat: number;
  readonly mpRegenFlat: number;
  readonly dropMul: number;
  readonly expMul: number;
  readonly damageBonusByElement: ReadonlyMap<ElementKey, number>;
}

export function composePassiveTalentMods(
  learnedTalentKeys: readonly string[]
): PassiveTalentMods {
  let atkMul = 1;
  let defMul = 1;
  let hpMaxMul = 1;
  let mpMaxMul = 1;
  let spiritMul = 1;
  let hpRegenFlat = 0;
  let mpRegenFlat = 0;
  let dropMul = 1;
  let expMul = 1;
  const damageBonusByElement = new Map<ElementKey, number>();

  for (const key of learnedTalentKeys) {
    const t = getTalentDef(key);
    if (!t || t.type !== 'passive' || !t.passiveEffect) continue;
    const eff = t.passiveEffect;

    if (eff.kind === 'stat_mod' && eff.statTarget) {
      switch (eff.statTarget) {
        case 'atk':
          atkMul *= eff.value;
          break;
        case 'def':
          defMul *= eff.value;
          break;
        case 'hpMax':
          hpMaxMul *= eff.value;
          break;
        case 'mpMax':
          mpMaxMul *= eff.value;
          break;
        case 'spirit':
          spiritMul *= eff.value;
          break;
      }
    } else if (eff.kind === 'regen' && eff.statTarget) {
      if (eff.statTarget === 'hpMax') {
        hpRegenFlat += eff.value;
      } else if (eff.statTarget === 'mpMax') {
        mpRegenFlat += eff.value;
      }
    } else if (eff.kind === 'drop_bonus') {
      dropMul *= eff.value;
    } else if (eff.kind === 'exp_bonus') {
      expMul *= eff.value;
    } else if (eff.kind === 'damage_bonus' && eff.elementTarget) {
      const cur = damageBonusByElement.get(eff.elementTarget) ?? 1;
      damageBonusByElement.set(eff.elementTarget, cur * eff.value);
    }
  }

  return {
    atkMul,
    defMul,
    hpMaxMul,
    mpMaxMul,
    spiritMul,
    hpRegenFlat,
    mpRegenFlat,
    dropMul,
    expMul,
    damageBonusByElement,
  };
}

export interface ActiveTalentResult {
  readonly talentKey: string;
  readonly damage: number;
  readonly heal: number;
  readonly ccTurns: number;
  readonly dotTurns: number;
  readonly aoe: boolean;
  readonly mpConsumed: number;
}

/**
 * Simulate 1 lần phát động active talent — deterministic.
 *
 * @param talent Talent def (phải có activeEffect)
 * @param attackerAtk attack stat
 * @param attackerSpirit spirit stat (cho true damage hoặc dot scale)
 * @returns Damage / heal / cc turns / dot turns
 *
 * Convention:
 * - `damage` kind: damage = atk × value (deterministic, no rng)
 * - `heal` kind: heal = attackerAtk × value (or hpMax × value at runtime — Phase 11.7.B)
 * - `cc` kind: ccTurns = value
 * - `dot` kind: dotTurns = value (damage per turn = spirit × 0.5 hardcoded)
 * - `utility` kind: damage/heal/cc/dot = 0 (chỉ effect runtime như escape)
 */
export function simulateActiveTalent(
  talent: TalentDef,
  attackerAtk: number,
  attackerSpirit: number
): ActiveTalentResult {
  if (talent.type !== 'active' || !talent.activeEffect) {
    throw new Error(
      `talent ${talent.key} is not an active talent`
    );
  }
  if (!Number.isFinite(attackerAtk) || attackerAtk < 0) {
    throw new Error(`attackerAtk must be non-negative finite, got ${attackerAtk}`);
  }
  if (!Number.isFinite(attackerSpirit) || attackerSpirit < 0) {
    throw new Error(
      `attackerSpirit must be non-negative finite, got ${attackerSpirit}`
    );
  }

  const eff = talent.activeEffect;
  let damage = 0;
  let heal = 0;
  let ccTurns = 0;
  let dotTurns = 0;

  switch (eff.kind) {
    case 'damage':
      damage = Math.round(attackerAtk * eff.value);
      break;
    case 'heal':
      heal = Math.round(attackerAtk * eff.value);
      break;
    case 'cc':
      ccTurns = eff.value;
      break;
    case 'dot':
      dotTurns = eff.value;
      break;
    case 'utility':
      // No-op damage/heal — runtime effect only
      break;
  }

  return {
    talentKey: talent.key,
    damage,
    heal,
    ccTurns,
    dotTurns,
    aoe: eff.aoe,
    mpConsumed: eff.mpCost,
  };
}
