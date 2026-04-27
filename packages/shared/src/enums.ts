export const ROLES = ['PLAYER', 'MOD', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const QUALITIES = ['PHAM', 'LINH', 'HUYEN', 'TIEN', 'THAN'] as const;
export type Quality = (typeof QUALITIES)[number];

export const ITEM_TYPES = [
  'WEAPON',
  'ARMOR',
  'BELT',
  'BOOTS',
  'HAT',
  'TRAM',
  'PILL',
  'HERB',
  'ORE',
  'KEY',
  'ARTIFACT',
  'MISC',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const EQUIP_SLOTS = [
  'WEAPON',
  'ARMOR',
  'BELT',
  'BOOTS',
  'HAT',
  'TRAM',
  'ARTIFACT_1',
  'ARTIFACT_2',
  'ARTIFACT_3',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const DIFFICULTIES = ['THUONG', 'KHO', 'AC_MONG', 'BAO_TAU'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TOPUP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type TopupStatus = (typeof TOPUP_STATUSES)[number];

export const REALM_TIERS = [
  'pham',
  'nhan_tien',
  'tien_gioi',
  'hon_nguyen',
  'ban_nguyen',
  'vinh_hang',
] as const;
export type RealmTier = (typeof REALM_TIERS)[number];
