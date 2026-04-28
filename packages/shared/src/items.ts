/**
 * Catalog item & drop table — Phase 4.
 *
 * Item là dữ liệu tĩnh (key cố định). Inventory của character chỉ lưu
 * `itemKey + qty + equippedSlot`, server lookup ItemDef bằng key này.
 */

import type { EquipSlot, Quality } from './enums';

export type ItemKind =
  | 'WEAPON'
  | 'ARMOR'
  | 'BELT'
  | 'BOOTS'
  | 'HAT'
  | 'TRAM'
  | 'ARTIFACT'
  | 'PILL_HP'
  | 'PILL_MP'
  | 'PILL_EXP'
  | 'ORE'
  | 'MISC';

export interface ItemBonus {
  atk?: number;
  def?: number;
  hpMax?: number;
  mpMax?: number;
  spirit?: number;
}

export interface ItemEffect {
  hp?: number;
  mp?: number;
  exp?: number;
}

export interface ItemDef {
  key: string;
  name: string;
  description: string;
  kind: ItemKind;
  quality: Quality;
  /** Có thể chồng nhiều cái 1 ô (dùng cho đan dược / quặng). */
  stackable: boolean;
  /** Nếu trang bị được, slot tương ứng. */
  slot?: EquipSlot;
  bonuses?: ItemBonus;
  effect?: ItemEffect;
  /** Giá tham khảo (linh thạch). */
  price: number;
}

export const ITEMS: readonly ItemDef[] = [
  // ----- Vũ khí -----
  {
    key: 'so_kiem',
    name: 'Sơ Kiếm',
    description: 'Một thanh kiếm sắt phàm phẩm, hợp với người mới luyện khí.',
    kind: 'WEAPON',
    quality: 'PHAM',
    stackable: false,
    slot: 'WEAPON',
    bonuses: { atk: 5 },
    price: 30,
  },
  {
    key: 'huyen_kiem',
    name: 'Huyền Kiếm',
    description: 'Hắc thiết tinh luyện, thích hợp với trúc cơ kỳ.',
    kind: 'WEAPON',
    quality: 'LINH',
    stackable: false,
    slot: 'WEAPON',
    bonuses: { atk: 12, spirit: 2 },
    price: 180,
  },
  {
    key: 'diem_phong_dao',
    name: 'Điểm Phong Đao',
    description: 'Yêu đao tia chớp, mỗi đường chém đều có gió rít.',
    kind: 'WEAPON',
    quality: 'HUYEN',
    stackable: false,
    slot: 'WEAPON',
    bonuses: { atk: 25, hpMax: 30 },
    price: 720,
  },

  // ----- Áo / Giáp -----
  {
    key: 'pham_giap',
    name: 'Phàm Giáp',
    description: 'Áo da thú thông thường, có thể đỡ vài đòn yêu thú nhỏ.',
    kind: 'ARMOR',
    quality: 'PHAM',
    stackable: false,
    slot: 'ARMOR',
    bonuses: { def: 4 },
    price: 30,
  },
  {
    key: 'linh_giap',
    name: 'Linh Giáp',
    description: 'Linh giáp dệt từ tơ nhện linh, mềm dẻo và bền.',
    kind: 'ARMOR',
    quality: 'LINH',
    stackable: false,
    slot: 'ARMOR',
    bonuses: { def: 10, hpMax: 25 },
    price: 180,
  },
  {
    key: 'huyet_phach_giap',
    name: 'Huyết Phách Giáp',
    description: 'Giáp đỏ đúc bằng huyết tinh, càng đánh càng mạnh.',
    kind: 'ARMOR',
    quality: 'HUYEN',
    stackable: false,
    slot: 'ARMOR',
    bonuses: { def: 22, hpMax: 60 },
    price: 720,
  },

  // ----- Đan dược -----
  {
    key: 'huyet_chi_dan',
    name: 'Huyết Chỉ Đan',
    description: 'Hồi 60 HP tức thì.',
    kind: 'PILL_HP',
    quality: 'PHAM',
    stackable: true,
    effect: { hp: 60 },
    price: 25,
  },
  {
    key: 'thanh_lam_dan',
    name: 'Thanh Lam Đan',
    description: 'Hồi 200 HP, vị mát lạnh hơi đắng.',
    kind: 'PILL_HP',
    quality: 'LINH',
    stackable: true,
    effect: { hp: 200 },
    price: 80,
  },
  {
    key: 'linh_lo_dan',
    name: 'Linh Lộ Đan',
    description: 'Hồi 80 MP, tinh khí ngưng tụ.',
    kind: 'PILL_MP',
    quality: 'PHAM',
    stackable: true,
    effect: { mp: 80 },
    price: 35,
  },
  {
    key: 'co_thien_dan',
    name: 'Cổ Thiên Đan',
    description: 'Tăng 500 EXP tu vi.',
    kind: 'PILL_EXP',
    quality: 'LINH',
    stackable: true,
    effect: { exp: 500 },
    price: 250,
  },
  {
    key: 'huyet_tinh',
    name: 'Huyết Tinh',
    description: 'Tinh huyết yêu thú, nguyên liệu luyện đan.',
    kind: 'ORE',
    quality: 'LINH',
    stackable: true,
    price: 60,
  },

  // ----- Drop hiếm boss đại hội (Phase 7) -----
  {
    key: 'tien_huyen_kiem',
    name: 'Tiên Huyền Kiếm',
    description: 'Cổ kiếm rớt từ tay Yêu Vương, sát khí ngút trời.',
    kind: 'WEAPON',
    quality: 'TIEN',
    stackable: false,
    slot: 'WEAPON',
    bonuses: { atk: 60, hpMax: 120, spirit: 6 },
    price: 9000,
  },
  {
    key: 'tien_huyen_giap',
    name: 'Tiên Huyền Giáp',
    description: 'Giáp Tiên phẩm, chống đỡ vạn pháp.',
    kind: 'ARMOR',
    quality: 'TIEN',
    stackable: false,
    slot: 'ARMOR',
    bonuses: { def: 55, hpMax: 250 },
    price: 9000,
  },
  {
    key: 'than_dan',
    name: 'Thần Dược Thượng Đan',
    description: 'Đan Thần phẩm, hồi 1500 HP và 600 EXP cùng lúc.',
    kind: 'PILL_HP',
    quality: 'THAN',
    stackable: true,
    effect: { hp: 1500, exp: 600 },
    price: 4000,
  },

  // ----- Thắt lưng (BELT) -----
  {
    key: 'pham_thuc_dai',
    name: 'Phàm Thúc Đái',
    description: 'Thắt lưng da thuộc, gia tăng sức chịu đựng.',
    kind: 'BELT',
    quality: 'PHAM',
    stackable: false,
    slot: 'BELT',
    bonuses: { hpMax: 20 },
    price: 35,
  },
  {
    key: 'linh_thuc_dai',
    name: 'Linh Thúc Đái',
    description: 'Thúc đái bện bằng linh ti, ôn nhuận khí huyết.',
    kind: 'BELT',
    quality: 'LINH',
    stackable: false,
    slot: 'BELT',
    bonuses: { hpMax: 45, def: 3 },
    price: 200,
  },
  {
    key: 'huyen_long_dai',
    name: 'Huyền Long Đái',
    description: 'Thúc đái khảm vảy huyền long, vững như núi non.',
    kind: 'BELT',
    quality: 'HUYEN',
    stackable: false,
    slot: 'BELT',
    bonuses: { hpMax: 120, def: 10 },
    price: 850,
  },

  // ----- Giày (BOOTS) -----
  {
    key: 'pham_hai',
    name: 'Phàm Hài',
    description: 'Giày vải phàm phẩm, thoải mái đi đường.',
    kind: 'BOOTS',
    quality: 'PHAM',
    stackable: false,
    slot: 'BOOTS',
    bonuses: { def: 2 },
    price: 28,
  },
  {
    key: 'vu_linh_hai',
    name: 'Vũ Linh Hài',
    description: 'Giày linh dệt bằng lông phượng, bước đi nhẹ như gió.',
    kind: 'BOOTS',
    quality: 'LINH',
    stackable: false,
    slot: 'BOOTS',
    bonuses: { def: 6, spirit: 2 },
    price: 190,
  },
  {
    key: 'tien_phong_hai',
    name: 'Tiên Phong Hài',
    description: 'Lưu phong hoá hài, tốc độ vô song.',
    kind: 'BOOTS',
    quality: 'HUYEN',
    stackable: false,
    slot: 'BOOTS',
    bonuses: { def: 14, spirit: 5 },
    price: 820,
  },

  // ----- Mũ (HAT) -----
  {
    key: 'pham_quan',
    name: 'Phàm Quan',
    description: 'Mũ vải phàm phẩm.',
    kind: 'HAT',
    quality: 'PHAM',
    stackable: false,
    slot: 'HAT',
    bonuses: { def: 2, mpMax: 10 },
    price: 30,
  },
  {
    key: 'tu_ngoc_quan',
    name: 'Tử Ngọc Quan',
    description: 'Mũ khảm tử ngọc, khai minh linh đài.',
    kind: 'HAT',
    quality: 'LINH',
    stackable: false,
    slot: 'HAT',
    bonuses: { def: 6, mpMax: 35, spirit: 2 },
    price: 220,
  },
  {
    key: 'huyen_thien_quan',
    name: 'Huyền Thiên Quan',
    description: 'Bảo quan thượng cổ, tâm linh thông thấu huyền thiên.',
    kind: 'HAT',
    quality: 'HUYEN',
    stackable: false,
    slot: 'HAT',
    bonuses: { def: 15, mpMax: 90, spirit: 6 },
    price: 900,
  },

  // ----- Trâm (TRAM) -----
  {
    key: 'ngoc_tram',
    name: 'Ngọc Trâm',
    description: 'Trâm ngọc khảm hoa, tinh tế an thần.',
    kind: 'TRAM',
    quality: 'LINH',
    stackable: false,
    slot: 'TRAM',
    bonuses: { mpMax: 25, spirit: 3 },
    price: 180,
  },
  {
    key: 'cuu_diep_linh_tram',
    name: 'Cửu Diệp Linh Trâm',
    description: 'Trâm chín cánh, hút linh khí thiên địa.',
    kind: 'TRAM',
    quality: 'HUYEN',
    stackable: false,
    slot: 'TRAM',
    bonuses: { mpMax: 70, spirit: 8 },
    price: 780,
  },

  // ----- Pháp bảo (ARTIFACT) -----
  {
    key: 'luyen_khi_phu',
    name: 'Luyện Khí Phù',
    description: 'Phù thuật sơ cấp, cộng sức công nhẹ.',
    kind: 'ARTIFACT',
    quality: 'PHAM',
    stackable: false,
    slot: 'ARTIFACT_1',
    bonuses: { atk: 4 },
    price: 80,
  },
  {
    key: 'bat_huyet_linh_bai',
    name: 'Bát Huyết Linh Bài',
    description: 'Linh bài tế huyết, bảo vệ chủ nhân khỏi ma khí.',
    kind: 'ARTIFACT',
    quality: 'LINH',
    stackable: false,
    slot: 'ARTIFACT_1',
    bonuses: { def: 8, hpMax: 60 },
    price: 420,
  },
  {
    key: 'huyen_kim_toa',
    name: 'Huyền Kim Toạ',
    description: 'Bảo toạ trường sinh, tăng nguyên khí.',
    kind: 'ARTIFACT',
    quality: 'HUYEN',
    stackable: false,
    slot: 'ARTIFACT_2',
    bonuses: { hpMax: 150, mpMax: 80, spirit: 5 },
    price: 1200,
  },
  {
    key: 'thien_linh_ngoc',
    name: 'Thiên Linh Ngọc',
    description: 'Ngọc trời vô giá, khai mở thiên mệnh.',
    kind: 'ARTIFACT',
    quality: 'TIEN',
    stackable: false,
    slot: 'ARTIFACT_3',
    bonuses: { atk: 30, hpMax: 200, spirit: 12 },
    price: 6500,
  },

  // ----- Đan dược bổ sung -----
  {
    key: 'hoi_nguyen_dan',
    name: 'Hồi Nguyên Đan',
    description: 'Hồi 400 MP, dùng trong đánh phó bản dài.',
    kind: 'PILL_MP',
    quality: 'LINH',
    stackable: true,
    effect: { mp: 400 },
    price: 150,
  },
  {
    key: 'van_linh_dan',
    name: 'Vạn Linh Đan',
    description: 'Tăng 2500 EXP tu vi, hiếm và đắt.',
    kind: 'PILL_EXP',
    quality: 'HUYEN',
    stackable: true,
    effect: { exp: 2500 },
    price: 1200,
  },
];

export function itemByKey(key: string): ItemDef | undefined {
  return ITEMS.find((i) => i.key === key);
}

/** Drop table theo dungeon: list { itemKey, weight, qtyMin, qtyMax }. */
export interface LootEntry {
  itemKey: string;
  weight: number;
  qtyMin: number;
  qtyMax: number;
}

export const DUNGEON_LOOT: Record<string, readonly LootEntry[]> = {
  son_coc: [
    { itemKey: 'so_kiem', weight: 8, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'pham_giap', weight: 8, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'huyet_chi_dan', weight: 30, qtyMin: 1, qtyMax: 3 },
    { itemKey: 'linh_lo_dan', weight: 12, qtyMin: 1, qtyMax: 2 },
  ],
  hac_lam: [
    { itemKey: 'huyen_kiem', weight: 5, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'linh_giap', weight: 5, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'thanh_lam_dan', weight: 20, qtyMin: 1, qtyMax: 2 },
    { itemKey: 'linh_lo_dan', weight: 18, qtyMin: 1, qtyMax: 3 },
    { itemKey: 'co_thien_dan', weight: 6, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'huyet_tinh', weight: 25, qtyMin: 1, qtyMax: 4 },
  ],
  yeu_thu_dong: [
    { itemKey: 'diem_phong_dao', weight: 3, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'huyet_phach_giap', weight: 3, qtyMin: 1, qtyMax: 1 },
    { itemKey: 'co_thien_dan', weight: 15, qtyMin: 1, qtyMax: 3 },
    { itemKey: 'thanh_lam_dan', weight: 22, qtyMin: 1, qtyMax: 4 },
    { itemKey: 'huyet_tinh', weight: 35, qtyMin: 2, qtyMax: 6 },
  ],
};

export interface RolledLoot {
  itemKey: string;
  qty: number;
}

/** Roll 1-2 entry từ drop table, áp dụng weight. */
export function rollDungeonLoot(dungeonKey: string, count = 2): RolledLoot[] {
  const table = DUNGEON_LOOT[dungeonKey];
  if (!table || table.length === 0) return [];
  const total = table.reduce((s, e) => s + e.weight, 0);
  const out: RolledLoot[] = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    for (const entry of table) {
      r -= entry.weight;
      if (r <= 0) {
        const qty =
          entry.qtyMin + Math.floor(Math.random() * (entry.qtyMax - entry.qtyMin + 1));
        out.push({ itemKey: entry.itemKey, qty });
        break;
      }
    }
  }
  return out;
}

export const QUALITY_COLOR: Record<Quality, string> = {
  PHAM: 'text-ink-200',
  LINH: 'text-emerald-300',
  HUYEN: 'text-sky-300',
  TIEN: 'text-violet-300',
  THAN: 'text-amber-300',
};

export const QUALITY_LABEL_VI: Record<Quality, string> = {
  PHAM: 'Phàm',
  LINH: 'Linh',
  HUYEN: 'Huyền',
  TIEN: 'Tiên',
  THAN: 'Thần',
};
