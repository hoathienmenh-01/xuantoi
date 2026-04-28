/**
 * Combat constants & formulas — Phase 3.
 *
 * Mô hình text-mode đơn giản:
 *   damage = max(1, atk * (1 + skillBonus) - def * 0.5) * (rand 0.85..1.15)
 */

export interface MonsterDef {
  key: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  expDrop: number;
  /** linh thạch drop, lưu thành bigint string. */
  linhThachDrop: number;
}

export interface DungeonDef {
  key: string;
  name: string;
  description: string;
  /** Cảnh giới đề nghị (key) — chỉ là gợi ý, không cản. */
  recommendedRealm: string;
  /** Đường đi quái: list key theo thứ tự. */
  monsters: string[];
  /** Stamina cần để mở instance. */
  staminaEntry: number;
}

export const MONSTERS: readonly MonsterDef[] = [
  // Sơn Cốc — luyện khí thấp
  { key: 'son_thu_lon',  name: 'Sơn Thử Lớn',     level: 1, hp: 30,  atk: 6,  def: 2,  speed: 6, expDrop: 12,  linhThachDrop: 5 },
  { key: 'da_quan',      name: 'Đá Quan Yêu Tinh', level: 2, hp: 55,  atk: 9,  def: 4,  speed: 5, expDrop: 25,  linhThachDrop: 9 },
  { key: 'huyet_lang',   name: 'Huyết Lang',      level: 3, hp: 80,  atk: 14, def: 5,  speed: 9, expDrop: 45,  linhThachDrop: 15 },

  // Hắc Lâm — luyện khí cao / trúc cơ
  { key: 'hac_yeu_xa',   name: 'Hắc Yêu Xà',      level: 5, hp: 140, atk: 22, def: 8,  speed: 11, expDrop: 90,  linhThachDrop: 28 },
  { key: 'thi_quy',      name: 'Thi Quỷ',         level: 6, hp: 200, atk: 28, def: 12, speed: 8,  expDrop: 130, linhThachDrop: 40 },
  { key: 'hac_lam_ma',   name: 'Hắc Lâm Ma',      level: 8, hp: 320, atk: 38, def: 18, speed: 12, expDrop: 220, linhThachDrop: 65 },

  // Yêu Thú Động — trúc cơ / kim đan
  { key: 'kim_giap_thu',   name: 'Kim Giáp Thú',    level: 10, hp: 480, atk: 52,  def: 28, speed: 11, expDrop: 360, linhThachDrop: 100 },
  { key: 'huyen_quy',      name: 'Huyền Quy',       level: 12, hp: 700, atk: 60,  def: 45, speed: 6,  expDrop: 520, linhThachDrop: 140 },
  { key: 'yeu_long_tieu',  name: 'Yêu Long Tiểu',   level: 15, hp: 980, atk: 86,  def: 38, speed: 14, expDrop: 800, linhThachDrop: 220 },
];

export function monsterByKey(key: string): MonsterDef | undefined {
  return MONSTERS.find((m) => m.key === key);
}

export const DUNGEONS: readonly DungeonDef[] = [
  {
    key: 'son_coc',
    name: 'Sơn Cốc',
    description: 'Sơn cốc xanh thẳm, yêu thú nhỏ phù hợp đạo hữu mới luyện khí.',
    recommendedRealm: 'luyenkhi',
    monsters: ['son_thu_lon', 'da_quan', 'huyet_lang'],
    staminaEntry: 10,
  },
  {
    key: 'hac_lam',
    name: 'Hắc Lâm',
    description: 'Hắc lâm âm khí dày đặc, thi quỷ và yêu xà nương bóng tối.',
    recommendedRealm: 'truc_co',
    monsters: ['hac_yeu_xa', 'thi_quy', 'hac_lam_ma'],
    staminaEntry: 18,
  },
  {
    key: 'yeu_thu_dong',
    name: 'Yêu Thú Động',
    description: 'Hang yêu thú thượng cổ — chỉ kim đan trở lên mới sống sót.',
    recommendedRealm: 'kim_dan',
    monsters: ['kim_giap_thu', 'huyen_quy', 'yeu_long_tieu'],
    staminaEntry: 28,
  },
];

export function dungeonByKey(key: string): DungeonDef | undefined {
  return DUNGEONS.find((d) => d.key === key);
}

export type SectKey = 'thanh_van' | 'huyen_thuy' | 'tu_la';

export interface SkillDef {
  key: string;
  name: string;
  description: string;
  /** mp cần để dùng. */
  mpCost: number;
  /** Hệ số nhân atk gốc. 1.0 = đòn thường. */
  atkScale: number;
  /** Hệ số hồi HP của bản thân (% hpMax). 0 = không hồi. */
  selfHealRatio: number;
  /** % hp bản thân tự trừ (huyết tế). */
  selfBloodCost: number;
  /** Sect sở hữu (null = ai cũng dùng). */
  sect: SectKey | null;
}

export const SKILL_BASIC_ATTACK: SkillDef = {
  key: 'basic_attack',
  name: 'Đòn Thường',
  description: 'Một chiêu cơ bản, không tốn linh khí.',
  mpCost: 0,
  atkScale: 1,
  selfHealRatio: 0,
  selfBloodCost: 0,
  sect: null,
};

export const SKILLS: readonly SkillDef[] = [
  SKILL_BASIC_ATTACK,
  {
    key: 'kiem_khi_chem',
    name: 'Kiếm Khí Trảm',
    description: 'Một đạo kiếm khí xé ngang trời — sát thương lớn, tốn 12 MP.',
    mpCost: 12,
    atkScale: 1.7,
    selfHealRatio: 0,
    selfBloodCost: 0,
    sect: 'thanh_van',
  },
  {
    key: 'thuy_tieu_phu',
    name: 'Thuỷ Tiêu Phù',
    description: 'Phù thuỷ giúp ngừng chảy máu, hồi 25% HP, tốn 18 MP.',
    mpCost: 18,
    atkScale: 0.6,
    selfHealRatio: 0.25,
    selfBloodCost: 0,
    sect: 'huyen_thuy',
  },
  {
    key: 'huyet_te_chi_thuat',
    name: 'Huyết Tế Chi Thuật',
    description: 'Lấy 10% HP đổi sát thương cuồng bạo (×2.4), tốn 8 MP.',
    mpCost: 8,
    atkScale: 2.4,
    selfHealRatio: 0,
    selfBloodCost: 0.1,
    sect: 'tu_la',
  },
  // Thanh Vân — chiêu thượng thừa
  {
    key: 'tu_hanh_kiem_quyet',
    name: 'Tứ Hành Kiếm Quyết',
    description: 'Bốn đường kiếm dồn dập, sát thương mạnh, tốn 25 MP.',
    mpCost: 25,
    atkScale: 2.6,
    selfHealRatio: 0,
    selfBloodCost: 0,
    sect: 'thanh_van',
  },
  {
    key: 'van_kiem_quy_tong',
    name: 'Vạn Kiếm Quy Tông',
    description: 'Tuyệt kỹ Thanh Vân — triệu vạn kiếm, sát thương bạo liệt, tốn 48 MP.',
    mpCost: 48,
    atkScale: 3.8,
    selfHealRatio: 0,
    selfBloodCost: 0,
    sect: 'thanh_van',
  },
  // Huyền Thuỷ — tu tâm dưỡng tính
  {
    key: 'huyen_bang_khoa_tran',
    name: 'Huyền Băng Khoá Trận',
    description: 'Phong ấn đối thủ bằng băng linh, gây 1.4× sát thương, tốn 22 MP.',
    mpCost: 22,
    atkScale: 1.4,
    selfHealRatio: 0.15,
    selfBloodCost: 0,
    sect: 'huyen_thuy',
  },
  {
    key: 'thanh_lien_hoan_sinh',
    name: 'Thanh Liên Hoàn Sinh',
    description: 'Tuyệt kỹ cứu mạng — hồi 50% HP, tốn 45 MP.',
    mpCost: 45,
    atkScale: 0,
    selfHealRatio: 0.5,
    selfBloodCost: 0,
    sect: 'huyen_thuy',
  },
  // Tu La — tà đạo
  {
    key: 'tu_la_chan_that',
    name: 'Tu La Chân Thật',
    description: 'Đốt 20% HP, sát thương ×3.2, tốn 20 MP.',
    mpCost: 20,
    atkScale: 3.2,
    selfHealRatio: 0,
    selfBloodCost: 0.2,
    sect: 'tu_la',
  },
  {
    key: 'huyet_ma_giang_the',
    name: 'Huyết Ma Giáng Thế',
    description: 'Tuyệt kỹ Tu La — triệu huyết ma, sát thương ×4.5, đổi 30% HP, tốn 50 MP.',
    mpCost: 50,
    atkScale: 4.5,
    selfHealRatio: 0,
    selfBloodCost: 0.3,
    sect: 'tu_la',
  },
];

export function skillByKey(key: string): SkillDef | undefined {
  return SKILLS.find((s) => s.key === key);
}

export function skillsForSect(sect: SectKey | null): SkillDef[] {
  return SKILLS.filter((s) => s.sect === null || s.sect === sect);
}

export interface CombatActor {
  name: string;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  power: number;
  spirit: number;
  speed: number;
}

/** RNG seeded — server tự cấp Math.random; client chỉ display. */
export function rollDamage(atk: number, def: number, scale: number): number {
  const base = atk * scale - def * 0.5;
  const variance = 0.85 + Math.random() * 0.3; // 0.85..1.15
  return Math.max(1, Math.round(base * variance));
}

export const STAMINA_PER_ACTION = 5;
export const STAMINA_REGEN_PER_TICK = 3;
