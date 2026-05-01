/**
 * Achievement (Thành Tựu) catalog foundation — Phase 11.10.A
 *
 * Pure data + deterministic helpers. KHÔNG runtime/schema/migration.
 *
 * Design intent (P11-10):
 * - Static catalog cho AchievementDef song song với MissionDef nhưng khác
 *   semantic: mission DAILY/WEEKLY/ONCE tracker reward; achievement là milestone
 *   one-time reward + cosmetic title unlock + permanent record.
 * - Reuse `MissionGoalKind` enum (`KILL_MONSTER`, `CLEAR_DUNGEON`, `BOSS_HIT`,
 *   `BREAKTHROUGH`, `GAIN_EXP`, `CULTIVATE_SECONDS`, `BUY_LISTING`,
 *   `SELL_LISTING`, `CHAT_MESSAGE`, `SECT_CONTRIBUTE`) để Phase 11.10.B service
 *   share tracking logic với mission service.
 * - Category variety: combat / cultivation / exploration / social / economy /
 *   milestone / collection.
 * - Tier (rarity-equivalent): bronze / silver / gold / platinum / diamond
 *   (matching achievement convention in MMO).
 * - rewardTitleKey link với `titles.ts` `titleForAchievement` lookup → khi
 *   achievement complete, auto-unlock title (Phase 11.10.B + 11.9.B service
 *   wire `unlockTitle`).
 *
 * Phase 11.10.B runtime sẽ thêm Prisma `CharacterAchievement { id, characterId,
 *   achievementKey, progress, completedAt? }` + service `incrementAchievement`
 *   (idempotent on `[characterId, achievementKey]`) + `claimAchievement`
 *   (validate `completedAt!=null` + grant reward + auto-unlock title qua
 *   `titleForAchievement(key)`) + event listener cho mỗi `goalKind`.
 *
 * Curve (32 achievement baseline):
 * - Combat: 8 (first kill / 100 kill / 1000 kill / element-specialist × 5).
 * - Cultivation: 6 (first breakthrough / mỗi major realm milestone).
 * - Exploration: 5 (first dungeon / 10 dungeon / 100 dungeon / boss / element
 *   dungeon).
 * - Social: 4 (sect join / first chat / first contribute / sect elder).
 * - Economy: 4 (first buy / first sell / 1m linhthach earned / 10m).
 * - Milestone: 3 (first login / 30-day login / 365-day login).
 * - Collection: 2 (collect 50 item / collect 100 item).
 */

import type { ElementKey } from './combat';
import type { MissionGoalKind } from './missions';

export type AchievementTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

export type AchievementCategory =
  | 'combat'
  | 'cultivation'
  | 'exploration'
  | 'social'
  | 'economy'
  | 'milestone'
  | 'collection';

export interface AchievementReward {
  readonly linhThach?: number;
  readonly tienNgoc?: number;
  readonly exp?: number;
  readonly items?: ReadonlyArray<{ readonly itemKey: string; readonly qty: number }>;
}

export interface AchievementDef {
  readonly key: string;
  readonly nameVi: string;
  readonly nameEn: string;
  readonly description: string;
  readonly category: AchievementCategory;
  readonly tier: AchievementTier;
  /**
   * Tracking goalKind (reuse MissionGoalKind). Phase 11.10.B service wire
   * cùng event listener với mission service.
   */
  readonly goalKind: MissionGoalKind;
  /** Số lượng cần đạt để complete. */
  readonly goalAmount: number;
  /** Element affinity (null = neutral). */
  readonly element: ElementKey | null;
  /**
   * Title key sẽ unlock khi complete (link với `titles.ts`
   * `titleForAchievement` lookup).
   */
  readonly rewardTitleKey: string | null;
  readonly reward: AchievementReward;
  /**
   * Hidden achievement (chỉ hiện khi complete). Default false.
   */
  readonly hidden: boolean;
}

/**
 * 32 achievement baseline cover combat / cultivation / exploration / social
 * / economy / milestone / collection × bronze → diamond tier.
 *
 * Stable order: category → tier ascending → key alphabetical.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ===== COMBAT — 8 =====
  {
    key: 'first_monster_kill',
    nameVi: 'Sơ Sát',
    nameEn: 'First Blood',
    description: 'Lần đầu chính thức ra tay sát địch.',
    category: 'combat',
    tier: 'bronze',
    goalKind: 'KILL_MONSTER',
    goalAmount: 1,
    element: null,
    rewardTitleKey: 'achievement_first_kill',
    reward: { linhThach: 100, exp: 50 },
    hidden: false,
  },
  {
    key: 'kill_100_monsters',
    nameVi: 'Bách Sát Tiên',
    nameEn: 'Hundred Slayer',
    description: 'Sát hạ 100 địch nhân.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'KILL_MONSTER',
    goalAmount: 100,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 1_000, exp: 500 },
    hidden: false,
  },
  {
    key: 'kill_1000_monsters',
    nameVi: 'Thiên Sát Yêu Tu',
    nameEn: 'Thousand Slayer',
    description: 'Sát hạ 1000 địch nhân.',
    category: 'combat',
    tier: 'gold',
    goalKind: 'KILL_MONSTER',
    goalAmount: 1000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 10_000, exp: 5_000 },
    hidden: false,
  },
  {
    key: 'first_boss_kill',
    nameVi: 'Đồ Lục Yêu Vương',
    nameEn: 'Boss Slayer',
    description: 'Đầu tiên đánh hạ một yêu vương.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'BOSS_HIT',
    goalAmount: 1,
    element: null,
    rewardTitleKey: 'achievement_first_boss',
    reward: { linhThach: 2_000, exp: 1_000 },
    hidden: false,
  },
  {
    key: 'kim_specialist',
    nameVi: 'Kim Hệ Chuyên Tinh',
    nameEn: 'Kim Element Specialist',
    description: 'Sát hạ 50 địch nhân hệ Kim.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'KILL_MONSTER',
    goalAmount: 50,
    element: 'kim',
    rewardTitleKey: null,
    reward: { linhThach: 800, exp: 400 },
    hidden: false,
  },
  {
    key: 'moc_specialist',
    nameVi: 'Mộc Hệ Chuyên Tinh',
    nameEn: 'Moc Element Specialist',
    description: 'Sát hạ 50 địch nhân hệ Mộc.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'KILL_MONSTER',
    goalAmount: 50,
    element: 'moc',
    rewardTitleKey: null,
    reward: { linhThach: 800, exp: 400 },
    hidden: false,
  },
  {
    key: 'thuy_specialist',
    nameVi: 'Thuỷ Hệ Chuyên Tinh',
    nameEn: 'Thuy Element Specialist',
    description: 'Sát hạ 50 địch nhân hệ Thuỷ.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'KILL_MONSTER',
    goalAmount: 50,
    element: 'thuy',
    rewardTitleKey: null,
    reward: { linhThach: 800, exp: 400 },
    hidden: false,
  },
  {
    key: 'hoa_specialist',
    nameVi: 'Hoả Hệ Chuyên Tinh',
    nameEn: 'Hoa Element Specialist',
    description: 'Sát hạ 50 địch nhân hệ Hoả.',
    category: 'combat',
    tier: 'silver',
    goalKind: 'KILL_MONSTER',
    goalAmount: 50,
    element: 'hoa',
    rewardTitleKey: null,
    reward: { linhThach: 800, exp: 400 },
    hidden: false,
  },

  // ===== CULTIVATION — 6 =====
  {
    key: 'first_breakthrough',
    nameVi: 'Đột Phá Nhất Trọng',
    nameEn: 'First Breakthrough',
    description: 'Lần đầu vượt qua bình cảnh, lên trọng kế tiếp.',
    category: 'cultivation',
    tier: 'bronze',
    goalKind: 'BREAKTHROUGH',
    goalAmount: 1,
    element: null,
    rewardTitleKey: 'achievement_first_breakthrough',
    reward: { linhThach: 200, exp: 100 },
    hidden: false,
  },
  {
    key: 'reach_truc_co',
    nameVi: 'Trúc Cơ Đăng Đỉnh',
    nameEn: 'Foundation Established',
    description: 'Đạt cảnh giới Trúc Cơ.',
    category: 'cultivation',
    tier: 'silver',
    goalKind: 'BREAKTHROUGH',
    goalAmount: 10,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 1_500, exp: 800 },
    hidden: false,
  },
  {
    key: 'reach_kim_dan',
    nameVi: 'Kim Đan Hữu Thành',
    nameEn: 'Golden Core Achieved',
    description: 'Đạt cảnh giới Kim Đan.',
    category: 'cultivation',
    tier: 'gold',
    goalKind: 'BREAKTHROUGH',
    goalAmount: 19,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 5_000, exp: 3_000 },
    hidden: false,
  },
  {
    key: 'reach_nguyen_anh',
    nameVi: 'Nguyên Anh Xuất Khiếu',
    nameEn: 'Nascent Soul Emerges',
    description: 'Đạt cảnh giới Nguyên Anh.',
    category: 'cultivation',
    tier: 'platinum',
    goalKind: 'BREAKTHROUGH',
    goalAmount: 28,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 20_000, exp: 10_000 },
    hidden: false,
  },
  {
    key: 'cultivate_24_hours',
    nameVi: 'Tu Luyện Nhất Nhật',
    nameEn: 'One-Day Cultivator',
    description: 'Tu luyện tổng cộng 24 giờ (86400 giây).',
    category: 'cultivation',
    tier: 'silver',
    goalKind: 'CULTIVATE_SECONDS',
    goalAmount: 86_400,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 1_000, exp: 500 },
    hidden: false,
  },
  {
    key: 'cultivate_30_days',
    nameVi: 'Tu Luyện Tam Tuần',
    nameEn: 'Thirty-Day Cultivator',
    description: 'Tu luyện tổng cộng 30 ngày (2,592,000 giây).',
    category: 'cultivation',
    tier: 'gold',
    goalKind: 'CULTIVATE_SECONDS',
    goalAmount: 2_592_000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 8_000, exp: 4_000 },
    hidden: false,
  },

  // ===== EXPLORATION — 5 =====
  {
    key: 'first_dungeon_clear',
    nameVi: 'Sơ Đăng Bí Cảnh',
    nameEn: 'First Dungeon Clear',
    description: 'Bước chân đầu tiên vào bí cảnh.',
    category: 'exploration',
    tier: 'bronze',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 1,
    element: null,
    rewardTitleKey: 'achievement_first_dungeon',
    reward: { linhThach: 150, exp: 80 },
    hidden: false,
  },
  {
    key: 'clear_10_dungeons',
    nameVi: 'Thập Đại Bí Cảnh',
    nameEn: 'Ten Dungeons Conquered',
    description: 'Hoàn thành 10 bí cảnh.',
    category: 'exploration',
    tier: 'silver',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 10,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 1_500, exp: 800 },
    hidden: false,
  },
  {
    key: 'clear_100_dungeons',
    nameVi: 'Bách Đại Bí Cảnh',
    nameEn: 'Hundred Dungeons Conquered',
    description: 'Hoàn thành 100 bí cảnh.',
    category: 'exploration',
    tier: 'gold',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 100,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 15_000, exp: 8_000 },
    hidden: false,
  },
  {
    key: 'clear_kim_dungeon',
    nameVi: 'Kim Sơn Mạch Khám Phá',
    nameEn: 'Kim Mountain Vein Explorer',
    description: 'Hoàn thành 5 bí cảnh hệ Kim.',
    category: 'exploration',
    tier: 'silver',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 5,
    element: 'kim',
    rewardTitleKey: null,
    reward: { linhThach: 1_000, exp: 500 },
    hidden: false,
  },
  {
    key: 'clear_endgame_dungeon',
    nameVi: 'Cửu La Điện Đăng Đỉnh',
    nameEn: 'Cuu La Dien Conqueror',
    description: 'Hoàn thành dungeon endgame `cuu_la_dien` (single-boss).',
    category: 'exploration',
    tier: 'diamond',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 1,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 50_000, exp: 25_000 },
    hidden: true,
  },

  // ===== SOCIAL — 4 =====
  {
    key: 'first_sect_join',
    nameVi: 'Tông Môn Đăng Tịch',
    nameEn: 'Sect Initiate',
    description: 'Lần đầu gia nhập tông môn.',
    category: 'social',
    tier: 'bronze',
    goalKind: 'SECT_CONTRIBUTE',
    goalAmount: 1,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 100, exp: 50 },
    hidden: false,
  },
  {
    key: 'first_chat',
    nameVi: 'Khẩu Khai Chí Tôn',
    nameEn: 'First Words',
    description: 'Lần đầu gửi tin nhắn world chat.',
    category: 'social',
    tier: 'bronze',
    goalKind: 'CHAT_MESSAGE',
    goalAmount: 1,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 50 },
    hidden: false,
  },
  {
    key: 'sect_donate_1000',
    nameVi: 'Tông Môn Cống Hiến Tiểu Cấp',
    nameEn: 'Sect Patron',
    description: 'Cống hiến 1000 cho tông môn.',
    category: 'social',
    tier: 'silver',
    goalKind: 'SECT_CONTRIBUTE',
    goalAmount: 1000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 800, exp: 400 },
    hidden: false,
  },
  {
    key: 'sect_donate_10000',
    nameVi: 'Tông Môn Cống Hiến Đại Cấp',
    nameEn: 'Sect Benefactor',
    description: 'Cống hiến 10,000 cho tông môn.',
    category: 'social',
    tier: 'gold',
    goalKind: 'SECT_CONTRIBUTE',
    goalAmount: 10_000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 8_000, exp: 4_000 },
    hidden: false,
  },

  // ===== ECONOMY — 4 =====
  {
    key: 'first_market_buy',
    nameVi: 'Sơ Mua Hàng',
    nameEn: 'First Market Buy',
    description: 'Lần đầu mua một item từ market.',
    category: 'economy',
    tier: 'bronze',
    goalKind: 'BUY_LISTING',
    goalAmount: 1,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 50 },
    hidden: false,
  },
  {
    key: 'first_market_sell',
    nameVi: 'Sơ Bán Hàng',
    nameEn: 'First Market Sale',
    description: 'Lần đầu bán một item lên market.',
    category: 'economy',
    tier: 'bronze',
    goalKind: 'SELL_LISTING',
    goalAmount: 1,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 50 },
    hidden: false,
  },
  {
    key: 'market_buyer_100',
    nameVi: 'Bách Đại Thương Khách',
    nameEn: 'Veteran Buyer',
    description: 'Mua 100 item từ market.',
    category: 'economy',
    tier: 'silver',
    goalKind: 'BUY_LISTING',
    goalAmount: 100,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 2_000, exp: 1_000 },
    hidden: false,
  },
  {
    key: 'market_seller_100',
    nameVi: 'Bách Đại Cửa Hiệu',
    nameEn: 'Veteran Seller',
    description: 'Bán 100 item lên market.',
    category: 'economy',
    tier: 'silver',
    goalKind: 'SELL_LISTING',
    goalAmount: 100,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 2_000, exp: 1_000 },
    hidden: false,
  },

  // ===== MILESTONE — 3 =====
  {
    key: 'gain_exp_1000',
    nameVi: 'Sơ Thiêm Kinh Nghiệm',
    nameEn: 'First Milestone',
    description: 'Tích luỹ 1000 EXP.',
    category: 'milestone',
    tier: 'bronze',
    goalKind: 'GAIN_EXP',
    goalAmount: 1_000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 100 },
    hidden: false,
  },
  {
    key: 'gain_exp_100000',
    nameVi: 'Bách Thiên Kinh Nghiệm',
    nameEn: 'Hundred-Thousand Mark',
    description: 'Tích luỹ 100,000 EXP.',
    category: 'milestone',
    tier: 'silver',
    goalKind: 'GAIN_EXP',
    goalAmount: 100_000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 3_000, exp: 1_500 },
    hidden: false,
  },
  {
    key: 'gain_exp_10million',
    nameVi: 'Thập Triệu Kinh Nghiệm',
    nameEn: 'Ten-Million Master',
    description: 'Tích luỹ 10,000,000 EXP.',
    category: 'milestone',
    tier: 'platinum',
    goalKind: 'GAIN_EXP',
    goalAmount: 10_000_000,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 30_000, exp: 15_000 },
    hidden: false,
  },

  // ===== COLLECTION — 2 =====
  {
    key: 'collect_50_items_bought',
    nameVi: 'Sưu Tầm Tiểu Cấp',
    nameEn: 'Item Collector I',
    description: 'Mua tổng cộng 50 item từ market.',
    category: 'collection',
    tier: 'silver',
    goalKind: 'BUY_LISTING',
    goalAmount: 50,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 1_500, exp: 800 },
    hidden: false,
  },
  {
    key: 'collect_500_items_bought',
    nameVi: 'Sưu Tầm Đại Cấp',
    nameEn: 'Item Collector II',
    description: 'Mua tổng cộng 500 item từ market.',
    category: 'collection',
    tier: 'gold',
    goalKind: 'BUY_LISTING',
    goalAmount: 500,
    element: null,
    rewardTitleKey: null,
    reward: { linhThach: 8_000, exp: 4_000 },
    hidden: false,
  },
];

const ACHIEVEMENTS_BY_KEY = new Map<string, AchievementDef>(
  ACHIEVEMENTS.map((a) => [a.key, a])
);

/**
 * Lookup achievement by key.
 */
export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS_BY_KEY.get(key);
}

/**
 * Filter theo category.
 */
export function achievementsByCategory(
  category: AchievementCategory
): readonly AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Filter theo tier.
 */
export function achievementsByTier(
  tier: AchievementTier
): readonly AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.tier === tier);
}

/**
 * Filter theo goalKind (Phase 11.10.B service event listener routing).
 */
export function achievementsByGoalKind(
  goalKind: MissionGoalKind
): readonly AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.goalKind === goalKind);
}

/**
 * Filter theo element (null = neutral).
 */
export function achievementsByElement(
  element: ElementKey | null
): readonly AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.element === element);
}

/**
 * Filter visible (non-hidden).
 */
export function visibleAchievements(): readonly AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !a.hidden);
}
