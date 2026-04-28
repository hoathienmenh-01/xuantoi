import type { RealmTier } from './enums';

export interface RealmDef {
  key: string;
  name: string;
  /** Số trọng (1..9). Nếu cảnh giới đỉnh không phân trọng, stages = 1. */
  stages: number;
  /** EXP cơ bản để lên trọng 1 của cảnh giới này. */
  expCost: bigint;
  order: number;
  tier: RealmTier;
}

export const ROMAN_TRONG = [
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

/**
 * 28 đại cảnh giới (rút gọn) — danh sách đầy đủ trong file 03 §1.2-1.6.
 * `expCost` cho trọng 1; mỗi trọng tiếp theo × 1.4.
 */
const RAW: Array<Omit<RealmDef, 'expCost'>> = [
  { key: 'phamnhan', name: 'Phàm Nhân', stages: 1, order: 0, tier: 'pham' },
  { key: 'luyenkhi', name: 'Luyện Khí', stages: 9, order: 1, tier: 'pham' },
  { key: 'truc_co', name: 'Trúc Cơ', stages: 9, order: 2, tier: 'pham' },
  { key: 'kim_dan', name: 'Kim Đan', stages: 9, order: 3, tier: 'pham' },
  { key: 'nguyen_anh', name: 'Nguyên Anh', stages: 9, order: 4, tier: 'pham' },
  { key: 'hoa_than', name: 'Hoá Thần', stages: 9, order: 5, tier: 'pham' },
  { key: 'luyen_hu', name: 'Luyện Hư', stages: 9, order: 6, tier: 'pham' },
  { key: 'hop_the', name: 'Hợp Thể', stages: 9, order: 7, tier: 'pham' },
  { key: 'dai_thua', name: 'Đại Thừa', stages: 9, order: 8, tier: 'pham' },
  { key: 'do_kiep', name: 'Độ Kiếp', stages: 9, order: 9, tier: 'pham' },
  { key: 'nhan_tien', name: 'Nhân Tiên', stages: 9, order: 10, tier: 'nhan_tien' },
  { key: 'dia_tien', name: 'Địa Tiên', stages: 9, order: 11, tier: 'nhan_tien' },
  { key: 'thien_tien', name: 'Thiên Tiên', stages: 9, order: 12, tier: 'nhan_tien' },
  { key: 'huyen_tien', name: 'Huyền Tiên', stages: 9, order: 13, tier: 'tien_gioi' },
  { key: 'kim_tien', name: 'Kim Tiên', stages: 9, order: 14, tier: 'tien_gioi' },
  { key: 'thai_at_kim_tien', name: 'Thái Ất Kim Tiên', stages: 9, order: 15, tier: 'tien_gioi' },
  { key: 'dai_la_kim_tien', name: 'Đại La Kim Tiên', stages: 9, order: 16, tier: 'tien_gioi' },
  { key: 'chuan_thanh', name: 'Chuẩn Thánh', stages: 9, order: 17, tier: 'tien_gioi' },
  { key: 'thanh_nhan', name: 'Thánh Nhân', stages: 9, order: 18, tier: 'hon_nguyen' },
  { key: 'hon_nguyen', name: 'Hỗn Nguyên Đại La', stages: 9, order: 19, tier: 'hon_nguyen' },
  { key: 'dao_quan', name: 'Đạo Quân', stages: 9, order: 20, tier: 'hon_nguyen' },
  { key: 'thien_dao', name: 'Thiên Đạo', stages: 9, order: 21, tier: 'hon_nguyen' },
  { key: 'ban_nguyen', name: 'Bản Nguyên', stages: 9, order: 22, tier: 'ban_nguyen' },
  { key: 'huyen_huyen', name: 'Huyền Huyền', stages: 9, order: 23, tier: 'ban_nguyen' },
  { key: 'vo_thuy', name: 'Vô Thuỷ', stages: 9, order: 24, tier: 'ban_nguyen' },
  { key: 'vo_chung', name: 'Vô Chung', stages: 9, order: 25, tier: 'vinh_hang' },
  { key: 'vinh_hang', name: 'Vĩnh Hằng', stages: 9, order: 26, tier: 'vinh_hang' },
  { key: 'hu_khong_chi_ton', name: 'Hư Không Chí Tôn', stages: 1, order: 27, tier: 'vinh_hang' },
];

const BASE_EXP = 1000n;
function calcExpCost(order: number): bigint {
  // base = 1000 * 1.6^order — tính bằng float rồi cast về BigInt
  const f = 1000 * Math.pow(1.6, order);
  return BigInt(Math.round(f));
}

export const REALMS: readonly RealmDef[] = RAW.map((r) => ({
  ...r,
  expCost: calcExpCost(r.order) || BASE_EXP,
}));

export function realmByKey(key: string): RealmDef | undefined {
  return REALMS.find((r) => r.key === key);
}

/** Tên đầy đủ ví dụ "Kim Đan Nhị Trọng". */
export function fullRealmName(realm: RealmDef, stage: number): string {
  if (realm.stages <= 1) return realm.name;
  const idx = Math.min(Math.max(stage, 1), 9) - 1;
  return `${realm.name} ${ROMAN_TRONG[idx]} Trọng`;
}

/** EXP cần để hoàn thành trọng `stage` của cảnh giới — mỗi trọng × 1.4 so với trọng trước. */
export function expCostForStage(realm: RealmDef, stage: number): bigint;
export function expCostForStage(realmKey: string, stage: number): bigint | null;
export function expCostForStage(
  realmOrKey: RealmDef | string,
  stage: number,
): bigint | null {
  const realm =
    typeof realmOrKey === 'string' ? realmByKey(realmOrKey) ?? null : realmOrKey;
  if (!realm) return null;
  const idx = Math.min(Math.max(stage, 1), 9) - 1;
  const f = Number(realm.expCost) * Math.pow(1.4, idx);
  return BigInt(Math.round(f));
}

/** Cảnh giới ngay sau cảnh giới hiện tại (theo `order`). */
export function nextRealm(currentKey: string): RealmDef | null {
  const cur = realmByKey(currentKey);
  if (!cur) return null;
  return REALMS.find((r) => r.order === cur.order + 1) ?? null;
}

/**
 * EXP base được cộng mỗi tick cultivation cho character đứng ở cảnh giới này,
 * TRƯỚC khi cộng bonus spirit.
 *
 * Công thức: `rate(order) = base * 1.45^order`, clamp tối thiểu `base`.
 *
 * Tại base=5 (CULTIVATION_TICK_BASE_EXP):
 *   - phamnhan (order 0):  5 EXP/tick
 *   - luyenkhi (order 1):  7
 *   - kim_dan (order 3):   15
 *   - hoa_than (order 5):  32
 *   - nhan_tien (order 10):   205
 *   - chuan_thanh (order 17): 2768
 *   - dao_quan (order 20):    8440
 *   - vo_chung (order 25):    54097
 *   - hu_khong_chi_ton (27):  113738
 *
 * Kết hợp với `expCostForStage` (tăng 1.6^order), thời gian/stage đầu ở realm
 * cao tăng nhẹ nhưng vẫn reachable:
 *   - luyenkhi stage 1:          ~1.9h
 *   - kim_dan stage 1:           ~2.3h
 *   - hoa_than stage 1:          ~2.7h
 *   - nhan_tien stage 1:         ~4.5h
 *   - chuan_thanh stage 1:       ~10h
 *   - hu_khong_chi_ton stage 1:  ~23.8h
 * tất cả đều <24h ở default spirit, tick 30s, không multiplier.
 *
 * Lưu ý: rate này KHÔNG xét item/sect/event multiplier (phase sau sẽ bổ sung).
 */
const CULTIVATION_RATE_REALM_MULT = 1.45;

export function cultivationRateForRealm(
  realmKey: string,
  baseRate: number,
): number {
  const realm = realmByKey(realmKey);
  if (!realm || realm.order < 0) return baseRate;
  const mult = Math.pow(CULTIVATION_RATE_REALM_MULT, realm.order);
  return Math.max(baseRate, Math.round(baseRate * mult));
}
