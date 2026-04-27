/**
 * Hệ cảnh giới MVP — file 03 §1 (rút gọn).
 * 10 đại cảnh giới đầu, mỗi đại 9 trọng (trừ trọng đỉnh không phân trọng nếu có).
 *
 * Công thức đột phá MVP:
 *   - Luyện Khí Nhất Trọng → Nhị Trọng = 100 EXP.
 *   - Mỗi trọng kế tiếp × 1.45.
 *   - Mỗi đại cảnh giới kế tiếp × 2.2 so với đại trước.
 *
 * Cost(realmOrder, stage→stage+1) = round(100 * 1.45^(stage-1) * 2.2^(realmOrder-1))
 * (realmOrder bắt đầu từ 1 = Luyện Khí; stage ∈ [1..9])
 */

export interface RealmDef {
  /** key bền vững dùng trong DB. */
  key: string;
  /** Tên hiển thị tiếng Việt. */
  name: string;
  /** Vị trí (1-indexed, Luyện Khí = 1). */
  order: number;
  /** Số trọng (luôn = 9 ở MVP). */
  stages: number;
  /** EXP base để hoàn thành trọng 1 → trọng 2 của cảnh giới này (không nhân hệ số trọng). */
  baseExpCost: bigint;
}

const ROMAN_TRONG = [
  'Nhất',
  'Nhị',
  'Tam',
  'Tứ',
  'Ngũ',
  'Lục',
  'Thất',
  'Bát',
  'Cửu',
] as const;

const STAGE_MULTIPLIER = 1.45;
const REALM_MULTIPLIER = 2.2;
const BASE_EXP_AT_LUYEN_KHI = 100;

interface RawRealm {
  key: string;
  name: string;
}

const RAW_REALMS: readonly RawRealm[] = [
  { key: 'luyen_khi', name: 'Luyện Khí' },
  { key: 'truc_co', name: 'Trúc Cơ' },
  { key: 'kim_dan', name: 'Kim Đan' },
  { key: 'nguyen_anh', name: 'Nguyên Anh' },
  { key: 'hoa_than', name: 'Hoá Thần' },
  { key: 'luyen_hu', name: 'Luyện Hư' },
  { key: 'hop_the', name: 'Hợp Thể' },
  { key: 'dai_thua', name: 'Đại Thừa' },
  { key: 'do_kiep', name: 'Độ Kiếp' },
  { key: 'chan_tien', name: 'Chân Tiên' },
];

function calcBaseExpCost(order: number): bigint {
  const f = BASE_EXP_AT_LUYEN_KHI * Math.pow(REALM_MULTIPLIER, order - 1);
  return BigInt(Math.round(f));
}

export const REALMS: readonly RealmDef[] = RAW_REALMS.map((r, idx) => ({
  key: r.key,
  name: r.name,
  order: idx + 1,
  stages: 9,
  baseExpCost: calcBaseExpCost(idx + 1),
}));

export const FIRST_REALM_KEY = REALMS[0].key;

export function realmByKey(key: string): RealmDef | undefined {
  return REALMS.find((r) => r.key === key);
}

export function realmByOrder(order: number): RealmDef | undefined {
  return REALMS.find((r) => r.order === order);
}

function clampStage(stage: number): number {
  if (!Number.isFinite(stage)) return 1;
  return Math.min(Math.max(Math.trunc(stage), 1), 9);
}

/** Tên đầy đủ cảnh giới + trọng, ví dụ "Kim Đan Tam Trọng". */
export function getRealmStageName(realmKey: string, stage: number): string {
  const realm = realmByKey(realmKey);
  if (!realm) return 'Vô Danh';
  if (realm.stages <= 1) return realm.name;
  const idx = clampStage(stage) - 1;
  return `${realm.name} ${ROMAN_TRONG[idx]} Trọng`;
}

/**
 * EXP cần để đột phá từ (realm, stage) → trọng/cảnh giới kế tiếp.
 * Trả về 0n nếu đã ở đỉnh (không thể đột phá nữa).
 */
export function getBreakthroughCost(realmKey: string, stage: number): bigint {
  const realm = realmByKey(realmKey);
  if (!realm) return 0n;
  const stageClamped = clampStage(stage);
  // Nếu đang ở stage cuối cùng (9) và không có realm kế tiếp → 0n.
  if (stageClamped >= realm.stages && !realmByOrder(realm.order + 1)) {
    return 0n;
  }
  const f =
    Number(realm.baseExpCost) * Math.pow(STAGE_MULTIPLIER, stageClamped - 1);
  return BigInt(Math.round(f));
}

export interface RealmStagePointer {
  realmKey: string;
  stage: number;
}

/**
 * Cảnh giới + trọng kế tiếp sau khi đột phá.
 * Trả về null nếu đã đỉnh.
 */
export function getNextRealmStage(
  realmKey: string,
  stage: number,
): RealmStagePointer | null {
  const realm = realmByKey(realmKey);
  if (!realm) return null;
  const stageClamped = clampStage(stage);
  if (stageClamped < realm.stages) {
    return { realmKey: realm.key, stage: stageClamped + 1 };
  }
  const next = realmByOrder(realm.order + 1);
  if (!next) return null;
  return { realmKey: next.key, stage: 1 };
}

/**
 * EXP/giây khi tu luyện. MVP: 0.2/s ở Luyện Khí, +10% mỗi đại cảnh kế tiếp.
 *   Luyện Khí (order=1): 0.2 EXP/s   → 1 EXP / 5s
 *   Trúc Cơ  (order=2): 0.22 EXP/s
 *   ...
 *   Chân Tiên (order=10): 0.38 EXP/s
 */
export const CULTIVATION_BASE_EXP_PER_SEC = 0.2;
export const CULTIVATION_REALM_BONUS = 0.1;

export function getCultivationExpPerSec(realmKey: string): number {
  const realm = realmByKey(realmKey);
  const order = realm?.order ?? 1;
  return CULTIVATION_BASE_EXP_PER_SEC * (1 + CULTIVATION_REALM_BONUS * (order - 1));
}
