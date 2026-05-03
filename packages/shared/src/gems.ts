/**
 * Phase 11.4.A PR — Gem static catalog (catalog-only foundation).
 *
 * Mục đích: define gem inventory item schema + 25 gem baseline (5 Ngũ Hành
 * × 5 quality tier `PHAM..THAN`) + helpers cho socket/combine math —
 * KHÔNG migrate Prisma, KHÔNG runtime hook. Phase 11.4.B sẽ wire:
 *
 *   - `Equipment.sockets[]` (Prisma JSON cột) lưu list `{ slotIndex, gemKey }`.
 *   - `socketGem(characterId, equipmentId, slotIndex, gemKey)` deduct
 *     gem qty từ `ItemLedger`, push `{ slotIndex, gemKey }` vào equipment.
 *   - `unsocketGem` return gem (cost linhThach), push qty back ItemLedger.
 *   - `combineGems(characterId, srcGemKey)` consume 3× gem cùng key → 1×
 *     gem next-tier theo `computeNextTierGem(srcGemKey)` deterministic.
 *
 * Server-authoritative reminder: catalog này metadata-only. EquipmentService
 * (`apps/api/src/modules/equipment/equipment.service.ts`) HIỆN KHÔNG đọc
 * gem catalog — vẫn dùng `ItemDef.bonuses` baseline. Phase 11.4.B mới wire
 * `applySocketBonus(equipment, gems[])` vào `CharacterStatService.computeStats`.
 */

import type { Quality } from './enums';
import type { ElementKey } from './combat';
import { itemByKey, type ItemDef } from './items';

// =====================================================================
// Gem grade & bonus
// =====================================================================

/**
 * Gem tier reuse `Quality` enum (`PHAM/LINH/HUYEN/TIEN/THAN`) để gem
 * fit chung quality system với equipment item — UI render quality color
 * giống nhau, drop table reuse rate weights.
 */
export type GemGrade = Quality;

export const GEM_GRADES: readonly GemGrade[] = ['PHAM', 'LINH', 'HUYEN', 'TIEN', 'THAN'];

export interface GemBonus {
  /** Cộng atk khi socket vào WEAPON. */
  atk?: number;
  /** Cộng def khi socket vào ARMOR/HAT/BELT/BOOTS. */
  def?: number;
  /** Cộng hpMax khi socket vào ARMOR/TRAM. */
  hpMax?: number;
  /** Cộng mpMax khi socket vào ARTIFACT/TRAM. */
  mpMax?: number;
  /** Cộng spirit (mọi slot). */
  spirit?: number;
}

/**
 * Slot type cho phép socket gem này vào — match `EquipSlot` trong enums.ts.
 * `'ANY'` = socket được mọi slot (utility gem). Empty array = catalog
 * error (sẽ được test bắt).
 */
export type GemCompatibleSlot =
  | 'WEAPON'
  | 'ARMOR'
  | 'HAT'
  | 'BELT'
  | 'BOOTS'
  | 'TRAM'
  | 'ARTIFACT'
  | 'ANY';

// =====================================================================
// GemDef
// =====================================================================

export interface GemDef {
  /** Stable key — convention `gem_<element>_<grade_lower>`. */
  key: string;
  name: string;
  description: string;
  /** Ngũ Hành (Kim/Mộc/Thủy/Hỏa/Thổ) — null = vô hệ utility gem. */
  element: ElementKey | null;
  grade: GemGrade;
  /**
   * Bonus áp khi socket vào equipment. Phase 11.4.B `applySocketBonus`
   * đọc + áp lên `computeStats`. Stack rule: bonus per gem additive,
   * total per-slot cap defined ở `BALANCE_MODEL.md` §6.
   */
  bonus: GemBonus;
  /** Slot type được phép socket. Empty = catalog error. */
  compatibleSlots: readonly GemCompatibleSlot[];
  /**
   * Tier kế tiếp khi combine 3× gem này → 1× next-tier. `null` =
   * THAN (tier cao nhất, không combine được nữa).
   */
  nextTierKey: string | null;
  /** Giá tham khảo (linh thạch) — sect-shop / market floor. */
  price: number;
  /** Drop source — UI hint + Phase 11.4.B drop table reference. */
  source: GemSource;
}

export type GemSource =
  | 'sect_shop'
  | 'dungeon_drop'
  | 'boss_drop'
  | 'event'
  | 'craft'
  | 'starter';

// =====================================================================
// Catalog — 25 gem (5 element × 5 grade)
// =====================================================================

/**
 * Bonus baseline per (grade, element) — element xác định stat type
 * (Kim → atk, Mộc → hpMax, Thủy → mpMax, Hỏa → atk crit-style high atk
 * lower def, Thổ → def). Grade scale geometric ×~1.6 mỗi tier.
 *
 * Numbers chosen để stack 3 gem same-key < total bonus của 1 gem
 * grade-up tương ứng (combine sink) — `gemBalanceCheck` test enforce.
 *
 *   PHAM atk = 3,  LINH atk = 5,  HUYEN atk = 8,  TIEN atk = 13, THAN atk = 21.
 *   3× PHAM atk = 9 < LINH atk = 5? No — wait need verify combine progress.
 *
 * Actually combine 3 PHAM = 1 LINH. So bonus ratio 3×3 = 9 vs LINH 5
 * means LINH bonus < 3× PHAM (combine encourage breadth not stacking).
 * That's INTENTIONAL — combine cost = sink mechanic, not pure power
 * upgrade. Real upgrade comes from drop boss/event high-tier.
 */
const ELEMENT_BONUS_TYPES: Readonly<
  Record<ElementKey, (atkScale: number) => GemBonus>
> = {
  kim: (s) => ({ atk: Math.round(3 * s), spirit: Math.round(s) }),
  moc: (s) => ({ hpMax: Math.round(15 * s), spirit: Math.round(s) }),
  thuy: (s) => ({ mpMax: Math.round(12 * s), spirit: Math.round(s) }),
  hoa: (s) => ({ atk: Math.round(4 * s), def: -Math.round(s) }),
  tho: (s) => ({ def: Math.round(3 * s), hpMax: Math.round(8 * s) }),
};

const GRADE_SCALE: Readonly<Record<GemGrade, number>> = {
  PHAM: 1.0,
  LINH: 1.6,
  HUYEN: 2.6,
  TIEN: 4.2,
  THAN: 6.8,
};

const GRADE_PRICE: Readonly<Record<GemGrade, number>> = {
  PHAM: 50,
  LINH: 200,
  HUYEN: 800,
  TIEN: 3200,
  THAN: 12800,
};

const GRADE_SOURCE: Readonly<Record<GemGrade, GemSource>> = {
  PHAM: 'starter',
  LINH: 'sect_shop',
  HUYEN: 'dungeon_drop',
  TIEN: 'boss_drop',
  THAN: 'event',
};

const ELEMENT_VI_NAME: Readonly<Record<ElementKey, string>> = {
  kim: 'Kim',
  moc: 'Mộc',
  thuy: 'Thuỷ',
  hoa: 'Hoả',
  tho: 'Thổ',
};

const GRADE_VI_NAME: Readonly<Record<GemGrade, string>> = {
  PHAM: 'Phàm',
  LINH: 'Linh',
  HUYEN: 'Huyền',
  TIEN: 'Tiên',
  THAN: 'Thần',
};

const ELEMENT_PREFERRED_SLOT: Readonly<Record<ElementKey, GemCompatibleSlot[]>> = {
  kim: ['WEAPON'],
  moc: ['ARMOR', 'HAT'],
  thuy: ['ARTIFACT', 'TRAM'],
  hoa: ['WEAPON', 'ARTIFACT'],
  tho: ['ARMOR', 'BELT', 'BOOTS'],
};

function buildGemKey(element: ElementKey, grade: GemGrade): string {
  return `gem_${element}_${grade.toLowerCase()}`;
}

function buildGemName(element: ElementKey, grade: GemGrade): string {
  // Convention: "<Grade VI> <Element VI> Linh Thạch"
  return `${GRADE_VI_NAME[grade]} ${ELEMENT_VI_NAME[element]} Linh Thạch`;
}

function buildGemDescription(element: ElementKey, grade: GemGrade): string {
  return `Linh thạch ${ELEMENT_VI_NAME[element]} hệ phẩm ${GRADE_VI_NAME[grade]} — khảm vào trang bị tăng thuộc tính ${ELEMENT_VI_NAME[element]}.`;
}

function buildElementGems(element: ElementKey): GemDef[] {
  const out: GemDef[] = [];
  for (let i = 0; i < GEM_GRADES.length; i++) {
    const grade = GEM_GRADES[i];
    const nextGrade = i + 1 < GEM_GRADES.length ? GEM_GRADES[i + 1] : null;
    const scale = GRADE_SCALE[grade];
    out.push({
      key: buildGemKey(element, grade),
      name: buildGemName(element, grade),
      description: buildGemDescription(element, grade),
      element,
      grade,
      bonus: ELEMENT_BONUS_TYPES[element](scale),
      compatibleSlots: ELEMENT_PREFERRED_SLOT[element],
      nextTierKey: nextGrade ? buildGemKey(element, nextGrade) : null,
      price: GRADE_PRICE[grade],
      source: GRADE_SOURCE[grade],
    });
  }
  return out;
}

const ELEMENTS_ORDERED: readonly ElementKey[] = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

export const GEMS: readonly GemDef[] = ELEMENTS_ORDERED.flatMap(buildElementGems);

// =====================================================================
// Helpers
// =====================================================================

export function getGemDef(key: string): GemDef | undefined {
  return GEMS.find((g) => g.key === key);
}

export function gemsByElement(element: ElementKey): GemDef[] {
  return GEMS.filter((g) => g.element === element).slice();
}

export function gemsByGrade(grade: GemGrade): GemDef[] {
  return GEMS.filter((g) => g.grade === grade).slice();
}

/**
 * Compose effective socket bonus của 1 equipment có nhiều gem khảm.
 * Catalog-level pure function — Phase 11.4.B `applySocketBonus` runtime
 * sẽ lookup `gemKey` từ `equipment.sockets[]` rồi gọi helper này.
 *
 * Stack rule: bonus per gem additive (không cap ở catalog level — cap
 * sẽ enforce ở runtime per `BALANCE_MODEL.md` §6 stat budget).
 */
export function composeSocketBonus(gemKeys: readonly string[]): GemBonus {
  const total: Required<GemBonus> = { atk: 0, def: 0, hpMax: 0, mpMax: 0, spirit: 0 };
  for (const key of gemKeys) {
    const gem = getGemDef(key);
    if (!gem) continue;
    total.atk += gem.bonus.atk ?? 0;
    total.def += gem.bonus.def ?? 0;
    total.hpMax += gem.bonus.hpMax ?? 0;
    total.mpMax += gem.bonus.mpMax ?? 0;
    total.spirit += gem.bonus.spirit ?? 0;
  }
  // Trim zero fields để output gọn (UI dễ render).
  const out: GemBonus = {};
  if (total.atk !== 0) out.atk = total.atk;
  if (total.def !== 0) out.def = total.def;
  if (total.hpMax !== 0) out.hpMax = total.hpMax;
  if (total.mpMax !== 0) out.mpMax = total.mpMax;
  if (total.spirit !== 0) out.spirit = total.spirit;
  return out;
}

/**
 * Catalog-level combine math — 3× gem cùng key → 1× gem next-tier.
 * Phase 11.4.B `combineGems(characterId, srcKey)` runtime gọi helper
 * này + verify ItemLedger qty ≥ 3 + deduct atomic.
 *
 * Trả về `null` nếu:
 *   - srcKey không tồn tại.
 *   - srcKey grade = THAN (không có next tier).
 */
export interface GemCombineResult {
  srcKey: string;
  srcQtyConsumed: 3;
  resultKey: string;
  resultQtyGained: 1;
}

export function combineGems(srcKey: string): GemCombineResult | null {
  const src = getGemDef(srcKey);
  if (!src) return null;
  if (src.nextTierKey === null) return null;
  return {
    srcKey,
    srcQtyConsumed: 3,
    resultKey: src.nextTierKey,
    resultQtyGained: 1,
  };
}

/**
 * Verify gem có thể socket vào slot này không. Slot must match
 * `compatibleSlots` hoặc gem có `'ANY'`.
 */
export function canSocketGem(gemKey: string, slot: GemCompatibleSlot): boolean {
  const gem = getGemDef(gemKey);
  if (!gem) return false;
  return gem.compatibleSlots.includes('ANY') || gem.compatibleSlots.includes(slot);
}

// =====================================================================
// Phase 11.4.B Gem MVP runtime — socket capacity per equipment quality
// =====================================================================

/**
 * Số slot socket tối đa cho 1 equipment dựa trên `Quality` của item.
 *
 * Convention: PHAM = 0, LINH = 1, HUYEN = 2, TIEN = 3, THAN = 4.
 * Equipment quality cao mới có nhiều socket → progression khuyến khích
 * upgrade gear endgame thay vì dán đầy gem PHAM lên gear PHAM.
 *
 * Phase 11.4.B `GemService.socketGem` enforce server-authoritative.
 * Total bonus per equipment cap theo `BALANCE_MODEL.md` §6.
 */
export function socketCapacityForQuality(quality: GemGrade): number {
  switch (quality) {
    case 'PHAM':
      return 0;
    case 'LINH':
      return 1;
    case 'HUYEN':
      return 2;
    case 'TIEN':
      return 3;
    case 'THAN':
      return 4;
  }
}

/**
 * Tính cost full upgrade từ 1 gem grade `from` sang 1 gem grade `to`
 * (cùng element). Geometric: cần `3^(to-from)` gem `from` để tạo 1 gem `to`.
 *
 * Throw nếu `to <= from` hoặc element không match.
 */
export function gemUpgradePathCost(
  fromKey: string,
  toKey: string
): { gemsRequired: number; pathSteps: number } {
  const from = getGemDef(fromKey);
  const to = getGemDef(toKey);
  if (!from) throw new Error(`gemUpgradePathCost: unknown fromKey "${fromKey}"`);
  if (!to) throw new Error(`gemUpgradePathCost: unknown toKey "${toKey}"`);
  if (from.element !== to.element) {
    throw new Error(
      `gemUpgradePathCost: element mismatch ${from.element} → ${to.element}`
    );
  }
  const fromIdx = GEM_GRADES.indexOf(from.grade);
  const toIdx = GEM_GRADES.indexOf(to.grade);
  if (toIdx <= fromIdx) {
    throw new Error(
      `gemUpgradePathCost: toGrade ${to.grade} <= fromGrade ${from.grade}`
    );
  }
  const pathSteps = toIdx - fromIdx;
  const gemsRequired = Math.pow(3, pathSteps);
  return { gemsRequired, pathSteps };
}

// =====================================================================
// Phase 11.4.C — Gem ↔ ItemDef bridge cho UI inventory
// =====================================================================

/**
 * Synth `ItemDef` từ `GemDef` để inventory UI có thể render gem rows
 * cùng layout với item rows. `kind = 'MISC'` (gem không có ItemKind
 * dedicated; tránh thêm `'GEM'` vào `ItemKind` union để giữ blast
 * radius nhỏ — switch/filter consumers vẫn an toàn). `slot = undefined`
 * (gem không equip trực tiếp). `bonuses` reuse `GemBonus` shape (atk/def/
 * hpMax/mpMax/spirit) — đã match `ItemBonus` shape 1:1, an toàn cast.
 *
 * Dùng bởi:
 *   - `inventory.service.ts:list()` fallback khi `itemByKey` undefined.
 *   - Frontend gem combine UI tra cứu name/description/quality/price.
 */
export function gemDefAsItemDef(g: GemDef): ItemDef {
  return {
    key: g.key,
    name: g.name,
    description: g.description,
    kind: 'MISC',
    quality: g.grade,
    stackable: true,
    bonuses: { ...g.bonus },
    price: g.price,
  };
}

/**
 * Lookup item key trong cả `ITEMS` catalog VÀ `GEMS` catalog (gems được
 * synth thành ItemDef-shape qua `gemDefAsItemDef`). Tránh duplicate logic
 * fallback ở mọi consumer.
 *
 * Phase 11.4.C — wire vào `inventory.service.list()` để gem inventory
 * rows hiển trên UI (trước đó bị skip vì `itemByKey` chỉ search `ITEMS`).
 *
 * Thứ tự lookup:
 *   1. `itemByKey(key)` — match item catalog phổ thông trước.
 *   2. `getGemDef(key)` — fallback qua gem catalog.
 *   3. `undefined` — không tồn tại trong cả 2 catalog.
 */
export function itemOrGemByKey(key: string): ItemDef | undefined {
  const item = itemByKey(key);
  if (item) return item;
  const gem = getGemDef(key);
  if (gem) return gemDefAsItemDef(gem);
  return undefined;
}
