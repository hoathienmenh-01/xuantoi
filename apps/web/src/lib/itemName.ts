/**
 * `itemName(key, t?)` — resolve display name cho một item key.
 *
 * Strategy (priority order):
 *   1. Nếu `t` (vue-i18n composer) được truyền và có entry `items.<key>` —
 *      dùng nó. Cho phép override per-locale trong `vi.json` / `en.json`.
 *   2. Lookup qua `itemByKey(key)?.name` trong catalog `@xuantoi/shared`
 *      (mặc định tiếng Việt — single source of truth cho tên item).
 *   3. Fallback cuối cùng — trả về raw `key`. Tránh blank UI khi key lạ
 *      (vd item từ server PR sau, FE chưa update catalog).
 *
 * Helper hỗ trợ format inline list: `formatItemReward({itemKey, qty})`.
 */
import { itemByKey } from '@xuantoi/shared';

type Translator = (key: string, fallback?: string) => string;

const I18N_PREFIX = 'items.';

export function itemName(key: string, t?: Translator): string {
  if (t) {
    // vue-i18n trả về key nếu missing — sentinel để detect.
    const SENTINEL = '__xt_item_missing__';
    const translated = t(`${I18N_PREFIX}${key}`, SENTINEL);
    if (translated && translated !== SENTINEL && translated !== `${I18N_PREFIX}${key}`) {
      return translated;
    }
  }
  const def = itemByKey(key);
  if (def?.name) return def.name;
  return key;
}

export interface ItemRewardLike {
  itemKey: string;
  qty: number;
}

/**
 * Format một reward item: `"Sơ Kiếm ×3"` (nếu qty > 1) hoặc `"Sơ Kiếm"`.
 */
export function formatItemReward(it: ItemRewardLike, t?: Translator): string {
  const name = itemName(it.itemKey, t);
  return it.qty > 1 ? `${name} ×${it.qty}` : name;
}

/**
 * Format một list reward items, join bằng `, `.
 */
export function formatItemRewardList(
  items: readonly ItemRewardLike[],
  t?: Translator,
): string {
  return items.map((it) => formatItemReward(it, t)).join(', ');
}
