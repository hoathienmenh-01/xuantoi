/**
 * Boss đại hội — Phase 7.
 *
 * Hệ thống world boss:
 * - Cron tự spawn theo rotation, sống đến khi bị giết hoặc hết thời gian.
 * - Mọi người đánh chung, server ghi nhận tổng sát thương per character.
 * - Boss chết → phân thưởng theo BXH (top 1 / top 2-3 / top 4-10 / all).
 */

export interface BossDef {
  key: string;
  name: string;
  description: string;
  /** Mức cảnh giới khuyến nghị (text) — chỉ hiển thị. */
  recommendedRealm: string;
  baseMaxHp: number;
  atk: number;
  def: number;
  /** Linh thạch reward gốc (sẽ phân theo rank). */
  baseRewardLinhThach: number;
  /** Top-1 chắc chắn nhận 1 item từ list này (random). */
  topDropPool: readonly string[];
  /** Top 2-3 nhận. */
  midDropPool: readonly string[];
}

export const BOSSES: readonly BossDef[] = [
  {
    key: 'yeu_vuong_tho_huyet',
    name: 'Yêu Vương Thổ Huyết',
    description: 'Cổ yêu trăm năm tỉnh giấc, hắc khí ngút trời.',
    recommendedRealm: 'truc_co',
    baseMaxHp: 120000,
    atk: 90,
    def: 30,
    baseRewardLinhThach: 30000,
    topDropPool: ['tien_huyen_kiem', 'tien_huyen_giap'],
    midDropPool: ['than_dan', 'co_thien_dan'],
  },
  {
    key: 'huyet_long_quan',
    name: 'Huyết Long Quân',
    description: 'Yêu long ngậm châu đỏ, mỗi vảy đều là phá thiên.',
    recommendedRealm: 'kim_dan',
    baseMaxHp: 240000,
    atk: 130,
    def: 50,
    baseRewardLinhThach: 60000,
    topDropPool: ['tien_huyen_kiem', 'tien_huyen_giap'],
    midDropPool: ['than_dan', 'co_thien_dan', 'huyet_phach_giap'],
  },
];

export function bossByKey(key: string): BossDef | undefined {
  return BOSSES.find((b) => b.key === key);
}

/** Rotation theo index — server lưu state ngoài hoặc derive từ count. */
export function pickBossByRotation(seed: number): BossDef {
  return BOSSES[seed % BOSSES.length];
}

/** Rate-limit attack 1.5s per character. */
export const BOSS_ATTACK_COOLDOWN_MS = 1500;

/** Mỗi đòn tốn 8 stamina + skill mp riêng. */
export const BOSS_STAMINA_PER_HIT = 8;

/** Boss sống tối đa N phút — sau đó EXPIRED và phân thưởng. */
export const BOSS_LIFETIME_MS = 30 * 60 * 1000;

/** Cooldown sau khi boss chết/hết hạn → spawn boss mới. */
export const BOSS_RESPAWN_DELAY_MS = 30 * 60 * 1000;

/** Reward distribution theo rank. */
export interface RewardSlice {
  rank: number;
  characterId: string;
  characterName: string;
  damage: string; // bigint string
  linhThach: string; // bigint string
  items: { itemKey: string; qty: number }[];
}
