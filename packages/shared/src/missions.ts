/**
 * Mission catalog — Phase 5c.
 *
 * Định nghĩa tĩnh (không lưu DB) cho nhiệm vụ hằng ngày / hằng tuần / 1 lần.
 * Server sẽ tạo `MissionProgress` (DB) cho từng character dựa trên catalog này.
 * Client hiển thị đề bài + reward.
 *
 * Gameplay của nhiệm vụ (hook trigger khi gain exp, kill monster, …) sẽ bổ sung
 * ở phase sau — PR này chỉ cung cấp catalog để UI và BE service dùng chung key.
 */

import type { Quality } from './enums';

export type MissionPeriod = 'DAILY' | 'WEEKLY' | 'ONCE';

export type MissionGoalKind =
  | 'GAIN_EXP'
  | 'CULTIVATE_SECONDS'
  | 'KILL_MONSTER'
  | 'CLEAR_DUNGEON'
  | 'BOSS_HIT'
  | 'SELL_LISTING'
  | 'BUY_LISTING'
  | 'CHAT_MESSAGE'
  | 'SECT_CONTRIBUTE'
  | 'BREAKTHROUGH';

export interface MissionReward {
  linhThach?: number;
  tienNgoc?: number;
  exp?: number;
  congHien?: number;
  items?: Array<{ itemKey: string; qty: number }>;
}

export interface MissionDef {
  key: string;
  name: string;
  description: string;
  period: MissionPeriod;
  goalKind: MissionGoalKind;
  /** Số lượng cần đạt để claim reward. */
  goalAmount: number;
  /** Cảnh giới tối thiểu để nhận (optional). */
  requiredRealmOrder?: number;
  quality: Quality;
  rewards: MissionReward;
}

export const MISSIONS: readonly MissionDef[] = [
  // ----- DAILY -----
  {
    key: 'daily_cultivate_600s',
    name: 'Đạo tâm thường tại',
    description: 'Tu luyện liên tục đủ 10 phút (600 giây) trong ngày.',
    period: 'DAILY',
    goalKind: 'CULTIVATE_SECONDS',
    goalAmount: 600,
    quality: 'PHAM',
    rewards: { linhThach: 50, exp: 200 },
  },
  {
    key: 'daily_kill_monster_5',
    name: 'Trảm yêu trừ ma',
    description: 'Hạ gục 5 yêu thú trong các phó bản.',
    period: 'DAILY',
    goalKind: 'KILL_MONSTER',
    goalAmount: 5,
    quality: 'PHAM',
    rewards: { linhThach: 80, exp: 150 },
  },
  {
    key: 'daily_boss_hit_3',
    name: 'Chiến ma dõng mãnh',
    description: 'Đánh trúng Thế Giới Boss 3 lần.',
    period: 'DAILY',
    goalKind: 'BOSS_HIT',
    goalAmount: 3,
    quality: 'LINH',
    rewards: { linhThach: 150, congHien: 20 },
  },
  {
    key: 'daily_chat_3',
    name: 'Chào đạo hữu',
    description: 'Gửi 3 tin nhắn ở kênh thế giới hoặc tông môn.',
    period: 'DAILY',
    goalKind: 'CHAT_MESSAGE',
    goalAmount: 3,
    quality: 'PHAM',
    rewards: { linhThach: 20 },
  },
  {
    key: 'daily_sect_contribute_100',
    name: 'Vì tông môn',
    description: 'Đóng góp 100 linh thạch cho tông môn trong ngày.',
    period: 'DAILY',
    goalKind: 'SECT_CONTRIBUTE',
    goalAmount: 100,
    quality: 'LINH',
    rewards: { congHien: 50, linhThach: 30 },
  },

  // ----- WEEKLY -----
  {
    key: 'weekly_clear_dungeon_10',
    name: 'Tảo đãng phó bản',
    description: 'Hoàn thành 10 phó bản bất kỳ trong tuần.',
    period: 'WEEKLY',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 10,
    quality: 'HUYEN',
    rewards: { linhThach: 800, exp: 1500, items: [{ itemKey: 'co_thien_dan', qty: 2 }] },
  },
  {
    key: 'weekly_cultivate_18000s',
    name: 'Bế quan tu luyện',
    description: 'Tu luyện tổng cộng 5 giờ (18000 giây) trong tuần.',
    period: 'WEEKLY',
    goalKind: 'CULTIVATE_SECONDS',
    goalAmount: 18000,
    quality: 'HUYEN',
    rewards: { linhThach: 1200, exp: 5000 },
  },
  {
    key: 'weekly_market_sell_5',
    name: 'Khai môn thương hội',
    description: 'Bán thành công 5 món đồ qua Phường Thị.',
    period: 'WEEKLY',
    goalKind: 'SELL_LISTING',
    goalAmount: 5,
    quality: 'LINH',
    rewards: { linhThach: 600, tienNgoc: 10 },
  },
  {
    key: 'weekly_gain_exp_50000',
    name: 'Đạo tâm vững chắc',
    description: 'Tích luỹ 50000 EXP trong tuần.',
    period: 'WEEKLY',
    goalKind: 'GAIN_EXP',
    goalAmount: 50000,
    quality: 'HUYEN',
    rewards: { linhThach: 1500, items: [{ itemKey: 'van_linh_dan', qty: 1 }] },
  },

  // ----- ONCE -----
  {
    key: 'once_first_breakthrough',
    name: 'Phá cảnh lần đầu',
    description: 'Đột phá cảnh giới ít nhất 1 lần.',
    period: 'ONCE',
    goalKind: 'BREAKTHROUGH',
    goalAmount: 1,
    quality: 'LINH',
    rewards: { linhThach: 300, items: [{ itemKey: 'thanh_lam_dan', qty: 2 }] },
  },
  {
    key: 'once_first_dungeon',
    name: 'Hành đạo sơ thể nghiệm',
    description: 'Hoàn thành phó bản đầu tiên.',
    period: 'ONCE',
    goalKind: 'CLEAR_DUNGEON',
    goalAmount: 1,
    quality: 'PHAM',
    rewards: { linhThach: 100, items: [{ itemKey: 'huyet_chi_dan', qty: 3 }] },
  },
  {
    key: 'once_first_boss_hit',
    name: 'Thế Giới Boss khai chiến',
    description: 'Đánh trúng Thế Giới Boss lần đầu tiên.',
    period: 'ONCE',
    goalKind: 'BOSS_HIT',
    goalAmount: 1,
    quality: 'LINH',
    rewards: { linhThach: 200, congHien: 30 },
  },
];

export function missionByKey(key: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.key === key);
}

export function missionsByPeriod(period: MissionPeriod): MissionDef[] {
  return MISSIONS.filter((m) => m.period === period);
}
