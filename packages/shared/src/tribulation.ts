/**
 * Catalog Thiên Kiếp / Tâm Ma — Phase 11.6.A.
 *
 * Tribulation = "Thiên Kiếp" trigger khi tu sĩ đột phá realm threshold cao.
 * Server-authoritative: realm transition → service detect tribulation required
 * → spawn deterministic combat simulation vs `TribulationWave[]`.
 *
 * 5 type (`TribulationType`) match Ngũ Hành + Tâm:
 *   - `lei` (Lôi Kiếp)   — element: hoa (electric/fire), the iconic "9 lôi kiếp"
 *   - `phong` (Phong Kiếp) — element: kim (wind blade)
 *   - `bang` (Băng Kiếp)  — element: thuy (ice/freezing)
 *   - `hoa` (Hoả Kiếp)   — element: hoa (heart-fire variant)
 *   - `tam` (Tâm Kiếp)   — element: null (mental/inner-demon, không Ngũ Hành)
 *
 * 4 severity (`TribulationSeverity`):
 *   - `minor` (Tiểu kiếp): 3 wave, kim_dan/nguyen_anh threshold.
 *   - `major` (Trung kiếp): 5 wave, hoa_than..dai_thua threshold.
 *   - `heavenly` (Thiên kiếp): 7 wave, do_kiep → nhan_tien threshold (cross-tier).
 *   - `saint` (Thánh kiếp): 9 wave, chuan_thanh+ threshold (endgame).
 *
 * Wave structure: deterministic `baseDamage` per wave geometric scaling theo
 * order của `fromRealm`. Mỗi wave có `element` riêng (mỗi kiếp có thể mix
 * Ngũ Hành để force player wear gear đa hệ).
 *
 * Reward on success: `linhThach + expBonus + titleKey` (cosmetic) + optional
 * `uniqueDropChance` (rare special drop, e.g. tribulation skill book).
 *
 * Failure penalty: `expLossRatio` (% rớt EXP), `cooldownMinutes` (chờ retry),
 * `taoMaDebuffChance` (chance bị Tâm Ma debuff), `taoMaDebuffDurationMinutes`.
 *
 * Phase 11.6.A = catalog-only — KHÔNG runtime hook, KHÔNG schema migration.
 * Phase 11.6.B sẽ thêm `Tribulation { id, characterId, fromRealm, toRealm,
 * status, attemptCount, ... }` Prisma model + service `attemptTribulation`
 * + cooldown enforcement + Tâm Ma debuff modifier vào `CombatService`.
 */

import type { ElementKey } from './combat';

/**
 * 5 type kiếp. `tam` không có element (inner demon — combat tinh thần).
 */
export type TribulationType = 'lei' | 'phong' | 'bang' | 'hoa' | 'tam';

export const TRIBULATION_TYPES: readonly TribulationType[] = [
  'lei',
  'phong',
  'bang',
  'hoa',
  'tam',
] as const;

/**
 * 4 severity tier. Số wave + reward + failure penalty đều scale theo severity.
 */
export type TribulationSeverity = 'minor' | 'major' | 'heavenly' | 'saint';

export const TRIBULATION_SEVERITIES: readonly TribulationSeverity[] = [
  'minor',
  'major',
  'heavenly',
  'saint',
] as const;

/**
 * Wave struct cho 1 đợt sấm trong kiếp.
 *
 * - `waveIndex`: 1..N (severity-dependent).
 * - `name`: tên wave (e.g. "Sơ kiếp", "Thiên uy").
 * - `baseDamage`: damage cố định nếu defender không kháng — server-authoritative
 *   compute `effectiveDamage = baseDamage × elementMultiplier(element, defenderRoot)`.
 * - `element`: hệ của wave (null cho `tam` — inner demon, ignore element).
 * - `accuracyHint`: hint cho UI hiển thị difficulty (0..1, không phải runtime hit-rate).
 */
export interface TribulationWave {
  waveIndex: number;
  name: string;
  baseDamage: number;
  element: ElementKey | null;
  accuracyHint: number;
}

/**
 * Reward grant on success.
 *
 * - `linhThach`: tiền linh thạch reward (server cấp qua CurrencyLedger).
 * - `expBonus`: EXP bonus thêm (lên trên EXP cảnh giới mới).
 * - `titleKey`: optional cosmetic title (e.g. "do_kiep_thanh_cong").
 * - `uniqueDropChance`: 0..1 — chance roll thêm 1 special item drop (Phase 11.6.B
 *   sẽ wire vào ItemLedger). Catalog field; runtime decide actual drop.
 * - `uniqueDropItemKey`: itemKey dùng cho special drop (có thể null).
 */
export interface TribulationReward {
  linhThach: number;
  expBonus: bigint;
  titleKey: string | null;
  uniqueDropChance: number;
  uniqueDropItemKey: string | null;
}

/**
 * Failure penalty.
 *
 * - `expLossRatio`: 0..1 — % EXP rớt sau khi fail kiếp.
 * - `cooldownMinutes`: thời gian phải chờ trước khi retry kiếp (server-side timer).
 * - `taoMaDebuffChance`: 0..1 — chance bị Tâm Ma debuff sau fail.
 * - `taoMaDebuffDurationMinutes`: nếu trúng debuff, kéo dài bao lâu.
 *   Tâm Ma debuff: `cultivating: false` (không tu luyện được) + atk -10% combat.
 */
export interface TribulationFailurePenalty {
  expLossRatio: number;
  cooldownMinutes: number;
  taoMaDebuffChance: number;
  taoMaDebuffDurationMinutes: number;
}

/**
 * TribulationDef — 1 entry per realm-transition trigger.
 */
export interface TribulationDef {
  key: string;
  name: string;
  description: string;
  /** Realm key đứng tại để trigger kiếp. */
  fromRealmKey: string;
  /** Realm key sau khi vượt kiếp thành công. */
  toRealmKey: string;
  type: TribulationType;
  severity: TribulationSeverity;
  waves: readonly TribulationWave[];
  reward: TribulationReward;
  failurePenalty: TribulationFailurePenalty;
}

/**
 * Số wave per severity.
 */
const SEVERITY_WAVE_COUNT: Record<TribulationSeverity, number> = {
  minor: 3,
  major: 5,
  heavenly: 7,
  saint: 9,
};

/**
 * Base damage anchor per severity (wave 1).
 */
const SEVERITY_BASE_DAMAGE: Record<TribulationSeverity, number> = {
  minor: 800,
  major: 4000,
  heavenly: 25000,
  saint: 200000,
};

/**
 * Damage growth per wave (geometric).
 */
const WAVE_DAMAGE_GROWTH = 1.35;

/**
 * Failure penalty per severity (cooldown + exp loss + tao_ma chance).
 */
const SEVERITY_FAILURE: Record<TribulationSeverity, TribulationFailurePenalty> = {
  minor: {
    expLossRatio: 0.10,
    cooldownMinutes: 30,
    taoMaDebuffChance: 0.05,
    taoMaDebuffDurationMinutes: 15,
  },
  major: {
    expLossRatio: 0.20,
    cooldownMinutes: 60,
    taoMaDebuffChance: 0.10,
    taoMaDebuffDurationMinutes: 30,
  },
  heavenly: {
    expLossRatio: 0.35,
    cooldownMinutes: 120,
    taoMaDebuffChance: 0.20,
    taoMaDebuffDurationMinutes: 60,
  },
  saint: {
    expLossRatio: 0.50,
    cooldownMinutes: 240,
    taoMaDebuffChance: 0.30,
    taoMaDebuffDurationMinutes: 120,
  },
};

/**
 * Reward anchor per severity.
 */
const SEVERITY_REWARD_BASE: Record<
  TribulationSeverity,
  { linhThach: number; expBonus: bigint; uniqueDropChance: number }
> = {
  minor: { linhThach: 5_000, expBonus: 1_000n, uniqueDropChance: 0.02 },
  major: { linhThach: 25_000, expBonus: 10_000n, uniqueDropChance: 0.05 },
  heavenly: { linhThach: 150_000, expBonus: 100_000n, uniqueDropChance: 0.10 },
  saint: { linhThach: 1_000_000, expBonus: 1_000_000n, uniqueDropChance: 0.15 },
};

/**
 * Element rotation per type (cyclic for waves).
 *
 * `lei` Kiếp = Hoả/Kim alternating (lôi = Hoả-Kim hybrid).
 * `phong` Kiếp = Kim only (gió kim).
 * `bang` Kiếp = Thuỷ only.
 * `hoa` Kiếp = Hoả only.
 * `tam` Kiếp = null (inner demon, không hệ).
 */
const TYPE_ELEMENTS: Record<TribulationType, readonly (ElementKey | null)[]> = {
  lei: ['hoa', 'kim', 'hoa'],
  phong: ['kim'],
  bang: ['thuy'],
  hoa: ['hoa'],
  tam: [null],
};

const WAVE_NAMES: readonly string[] = [
  'Sơ Khởi',
  'Tiểu Lôi',
  'Trung Phong',
  'Đại Băng',
  'Hoả Diệt',
  'Thiên Uy',
  'Thần Sấm',
  'Hư Vô',
  'Đỉnh Phong',
];

function buildWaves(severity: TribulationSeverity, type: TribulationType): readonly TribulationWave[] {
  const count = SEVERITY_WAVE_COUNT[severity];
  const baseDamage = SEVERITY_BASE_DAMAGE[severity];
  const elementCycle = TYPE_ELEMENTS[type];
  const waves: TribulationWave[] = [];
  for (let i = 0; i < count; i++) {
    const damage = Math.round(baseDamage * Math.pow(WAVE_DAMAGE_GROWTH, i));
    const element = elementCycle[i % elementCycle.length];
    waves.push({
      waveIndex: i + 1,
      name: WAVE_NAMES[i] ?? `Sấm Thứ ${i + 1}`,
      baseDamage: damage,
      element,
      // accuracyHint: linear from 0.95 down to 0.65 across waves
      accuracyHint: Math.max(0.65, Math.round((0.95 - i * 0.04) * 100) / 100),
    });
  }
  return waves;
}

function buildReward(severity: TribulationSeverity, type: TribulationType): TribulationReward {
  const base = SEVERITY_REWARD_BASE[severity];
  const titleKey = `tribulation_${severity}_${type}_pass`;
  // Special drop — only `heavenly` and `saint` (endgame).
  let uniqueDropItemKey: string | null = null;
  if (severity === 'heavenly') uniqueDropItemKey = 'kiep_van_thach';
  else if (severity === 'saint') uniqueDropItemKey = 'thanh_kiep_tinh';
  return {
    linhThach: base.linhThach,
    expBonus: base.expBonus,
    titleKey,
    uniqueDropChance: base.uniqueDropChance,
    uniqueDropItemKey,
  };
}

/**
 * TRIBULATIONS catalog: 8 entries cover các realm threshold quan trọng.
 *
 * - kim_dan → nguyen_anh: minor lei
 * - nguyen_anh → hoa_than: minor lei
 * - hoa_than → luyen_hu: major hoa
 * - luyen_hu → hop_the: major bang
 * - hop_the → dai_thua: major phong
 * - dai_thua → do_kiep: heavenly lei
 * - do_kiep → nhan_tien: heavenly tam (cross-tier — Tâm Ma kiếp)
 * - chuan_thanh → thanh_nhan: saint lei (endgame)
 */
const RAW_TRIBULATIONS: Array<Omit<TribulationDef, 'waves' | 'reward' | 'failurePenalty'>> = [
  {
    key: 'tribulation_kim_dan_nguyen_anh',
    name: 'Tiểu Kim Lôi',
    description: 'Kiếp nhỏ khi tu sĩ Kim Đan đột phá Nguyên Anh — sấm tiểu Lôi 3 đợt.',
    fromRealmKey: 'kim_dan',
    toRealmKey: 'nguyen_anh',
    type: 'lei',
    severity: 'minor',
  },
  {
    key: 'tribulation_nguyen_anh_hoa_than',
    name: 'Trung Lôi Kiếp',
    description: 'Sấm Lôi nhị đợt khi Nguyên Anh đột phá Hoá Thần.',
    fromRealmKey: 'nguyen_anh',
    toRealmKey: 'hoa_than',
    type: 'lei',
    severity: 'minor',
  },
  {
    key: 'tribulation_hoa_than_luyen_hu',
    name: 'Hoả Diệt Kiếp',
    description: 'Hoả Kiếp 5 đợt khi Hoá Thần đột phá Luyện Hư — yêu cầu kháng Hoả.',
    fromRealmKey: 'hoa_than',
    toRealmKey: 'luyen_hu',
    type: 'hoa',
    severity: 'major',
  },
  {
    key: 'tribulation_luyen_hu_hop_the',
    name: 'Băng Phong Kiếp',
    description: 'Băng Kiếp 5 đợt khi Luyện Hư đột phá Hợp Thể — yêu cầu kháng Thuỷ.',
    fromRealmKey: 'luyen_hu',
    toRealmKey: 'hop_the',
    type: 'bang',
    severity: 'major',
  },
  {
    key: 'tribulation_hop_the_dai_thua',
    name: 'Phong Kim Kiếp',
    description: 'Phong Kiếp 5 đợt khi Hợp Thể đột phá Đại Thừa — yêu cầu kháng Kim.',
    fromRealmKey: 'hop_the',
    toRealmKey: 'dai_thua',
    type: 'phong',
    severity: 'major',
  },
  {
    key: 'tribulation_dai_thua_do_kiep',
    name: 'Đại Lôi Kiếp',
    description: 'Đại Lôi Kiếp 7 đợt — đột phá Đại Thừa lên Độ Kiếp, sấm cường.',
    fromRealmKey: 'dai_thua',
    toRealmKey: 'do_kiep',
    type: 'lei',
    severity: 'heavenly',
  },
  {
    key: 'tribulation_do_kiep_nhan_tien',
    name: 'Tâm Ma Thiên Kiếp',
    description:
      'Vượt phàm thành tiên — kiếp Tâm Ma 7 đợt, không dùng được trang bị Ngũ Hành; phải tự thắng nội tâm.',
    fromRealmKey: 'do_kiep',
    toRealmKey: 'nhan_tien',
    type: 'tam',
    severity: 'heavenly',
  },
  {
    key: 'tribulation_chuan_thanh_thanh_nhan',
    name: 'Thánh Lôi Cửu Kiếp',
    description:
      'Cửu Lôi Thánh Kiếp 9 đợt — Chuẩn Thánh đột phá Thánh Nhân, kiếp gấp đôi sức mạnh hỗn nguyên.',
    fromRealmKey: 'chuan_thanh',
    toRealmKey: 'thanh_nhan',
    type: 'lei',
    severity: 'saint',
  },
];

export const TRIBULATIONS: readonly TribulationDef[] = RAW_TRIBULATIONS.map((raw) => ({
  ...raw,
  waves: buildWaves(raw.severity, raw.type),
  reward: buildReward(raw.severity, raw.type),
  failurePenalty: SEVERITY_FAILURE[raw.severity],
}));

/**
 * Lookup tribulation by key.
 */
export function getTribulationDef(key: string): TribulationDef | undefined {
  return TRIBULATIONS.find((t) => t.key === key);
}

/**
 * Lookup tribulation cho 1 cụ thể realm transition (nếu có).
 *
 * Server gọi hàm này khi character toàn bộ EXP của `fromRealmKey` đã đầy
 * và sắp đột phá → nếu trả về `TribulationDef`, force kiếp combat.
 * Trả `undefined` nếu transition KHÔNG có kiếp (early realm).
 */
export function getTribulationForBreakthrough(
  fromRealmKey: string,
  toRealmKey: string,
): TribulationDef | undefined {
  return TRIBULATIONS.find(
    (t) => t.fromRealmKey === fromRealmKey && t.toRealmKey === toRealmKey,
  );
}

/**
 * Filter TRIBULATIONS theo type (Lôi/Phong/Băng/Hoả/Tâm).
 */
export function tribulationsByType(type: TribulationType): readonly TribulationDef[] {
  return TRIBULATIONS.filter((t) => t.type === type);
}

/**
 * Filter TRIBULATIONS theo severity (minor/major/heavenly/saint).
 */
export function tribulationsBySeverity(
  severity: TribulationSeverity,
): readonly TribulationDef[] {
  return TRIBULATIONS.filter((t) => t.severity === severity);
}

/**
 * Result của 1 wave simulation.
 */
export interface TribulationWaveResult {
  waveIndex: number;
  /** Damage tạo lên defender sau khi áp element resist. */
  effectiveDamage: number;
  /** True nếu defender còn HP > 0 sau wave. */
  survived: boolean;
  defenderHpAfter: number;
}

/**
 * Simulate 1 wave deterministically (server-authoritative).
 *
 * @param wave wave def
 * @param defenderHp current HP của defender (trước wave)
 * @param elementResistMultiplier 0..2 (1.0 = no resist, 0.5 = strong resist,
 *   1.5 = weak resist). Server tính từ defender's spiritual root + equipment.
 *   Phase 11.6.B sẽ wire actual computeStats result vào đây.
 *
 * Note: KHÔNG có RNG — kiếp deterministic 100% (intent: server replay-able,
 * test-able, không có unfair luck factor cho user). Variance đến từ defender
 * stats + element kháng + thái độ player (đã đeo gear phù hợp chưa).
 */
export function simulateTribulationWave(
  wave: TribulationWave,
  defenderHp: number,
  elementResistMultiplier: number,
): TribulationWaveResult {
  if (!Number.isFinite(defenderHp)) {
    throw new Error(`defenderHp must be finite, got: ${defenderHp}`);
  }
  if (!Number.isFinite(elementResistMultiplier) || elementResistMultiplier < 0) {
    throw new Error(
      `elementResistMultiplier must be >= 0 finite, got: ${elementResistMultiplier}`,
    );
  }
  const effectiveDamage = Math.round(wave.baseDamage * elementResistMultiplier);
  const defenderHpAfter = Math.max(0, defenderHp - effectiveDamage);
  return {
    waveIndex: wave.waveIndex,
    effectiveDamage,
    survived: defenderHpAfter > 0,
    defenderHpAfter,
  };
}

/**
 * Result của full tribulation simulation.
 */
export interface TribulationSimulationResult {
  success: boolean;
  /** Wave gặp trước khi chết hoặc total nếu success. */
  wavesCompleted: number;
  /** Tổng damage taken. */
  totalDamage: number;
  /** HP còn lại sau kiếp (0 nếu chết). */
  finalHp: number;
  waveResults: readonly TribulationWaveResult[];
}

/**
 * Simulate full tribulation deterministically.
 *
 * @param tribulation TribulationDef
 * @param defenderHpInitial HP ban đầu của defender
 * @param elementResistFn function trả elementResistMultiplier cho element
 *   của wave (server compute từ character stats; vitest mock).
 *
 * Server gọi hàm này khi character trigger kiếp (deterministic) — không có
 * RNG, replay-able. Reward/failure decide sau từ `success`.
 */
export function simulateTribulation(
  tribulation: TribulationDef,
  defenderHpInitial: number,
  elementResistFn: (element: ElementKey | null) => number,
): TribulationSimulationResult {
  let hp = defenderHpInitial;
  let totalDamage = 0;
  const waveResults: TribulationWaveResult[] = [];
  for (const wave of tribulation.waves) {
    const resist = elementResistFn(wave.element);
    const result = simulateTribulationWave(wave, hp, resist);
    waveResults.push(result);
    totalDamage += result.effectiveDamage;
    hp = result.defenderHpAfter;
    if (!result.survived) break;
  }
  return {
    success: hp > 0,
    wavesCompleted: waveResults.length,
    totalDamage,
    finalHp: hp,
    waveResults,
  };
}

/**
 * Compute reward grant on tribulation success.
 *
 * Phase 11.6.B sẽ wire CurrencyLedger + ItemLedger atomic.
 */
export function computeTribulationReward(def: TribulationDef): {
  linhThach: number;
  expBonus: bigint;
  titleKey: string | null;
  uniqueDropItemKey: string | null;
  uniqueDropChance: number;
} {
  return {
    linhThach: def.reward.linhThach,
    expBonus: def.reward.expBonus,
    titleKey: def.reward.titleKey,
    uniqueDropItemKey: def.reward.uniqueDropItemKey,
    uniqueDropChance: def.reward.uniqueDropChance,
  };
}

/**
 * Compute failure penalty (preview — Phase 11.6.B sẽ wire vào DB write).
 *
 * @param currentExp EXP hiện tại của character (BigInt)
 * @param def tribulation def
 * @param now Date gốc cho cooldownAt + taoMaExpiresAt computation
 * @param taoMaRoll 0..1 RNG roll (server seed-by-attemptId); compare với
 *   `def.failurePenalty.taoMaDebuffChance`.
 *
 * Returns:
 *   - `expAfter`: EXP còn lại = `currentExp × (1 - expLossRatio)`.
 *   - `cooldownAt`: thời điểm có thể retry (now + cooldownMinutes).
 *   - `taoMaActive`: true nếu trúng debuff.
 *   - `taoMaExpiresAt`: thời điểm debuff hết (chỉ set nếu taoMaActive).
 */
export function computeTribulationFailurePenalty(
  currentExp: bigint,
  def: TribulationDef,
  now: Date,
  taoMaRoll: number,
): {
  expAfter: bigint;
  cooldownAt: Date;
  taoMaActive: boolean;
  taoMaExpiresAt: Date | null;
} {
  if (taoMaRoll < 0 || taoMaRoll > 1 || !Number.isFinite(taoMaRoll)) {
    throw new Error(`taoMaRoll must be in [0, 1], got: ${taoMaRoll}`);
  }
  const fp = def.failurePenalty;
  // BigInt-safe ratio multiplication: convert to Number for ratio (loss < 1.0)
  // then floor back to BigInt. Acceptable precision for game EXP values.
  const expLossNumerator = BigInt(Math.floor(fp.expLossRatio * 1_000_000));
  const expLoss = (currentExp * expLossNumerator) / 1_000_000n;
  const expAfter = currentExp - expLoss;
  const cooldownAt = new Date(now.getTime() + fp.cooldownMinutes * 60_000);
  const taoMaActive = taoMaRoll < fp.taoMaDebuffChance;
  const taoMaExpiresAt = taoMaActive
    ? new Date(now.getTime() + fp.taoMaDebuffDurationMinutes * 60_000)
    : null;
  return {
    expAfter,
    cooldownAt,
    taoMaActive,
    taoMaExpiresAt,
  };
}
