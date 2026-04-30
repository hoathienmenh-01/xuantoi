import { describe, it, expect } from 'vitest';

import {
  ROLES,
  QUALITIES,
  ITEM_TYPES,
  EQUIP_SLOTS,
  DIFFICULTIES,
  TOPUP_STATUSES,
  REALM_TIERS,
} from './enums';

/**
 * Catalog integrity tests cho `packages/shared/src/enums.ts`.
 *
 * Các tuple enum này được dùng khắp BE/FE (Prisma schema, zod parser, Pinia
 * store, i18n key). Nếu một giá trị bị xoá/đổi tên/typo mà không có test bắt,
 * sẽ lộ lỗi runtime sâu trong app (vd topup status 'APROVED' lọt schema, hoặc
 * FE render quality 'DI_VAT' không trong list i18n key).
 */
describe('enums', () => {
  describe('ROLES', () => {
    it('contains PLAYER / MOD / ADMIN (3 roles)', () => {
      expect(ROLES).toEqual(['PLAYER', 'MOD', 'ADMIN']);
      expect(ROLES).toHaveLength(3);
    });

    it('is readonly tuple (frozen via `as const`)', () => {
      expect(Array.isArray(ROLES)).toBe(true);
      // TS `as const` produces readonly tuple; runtime is plain array.
      // Lock-in test: duplicate detection.
      expect(new Set(ROLES).size).toBe(ROLES.length);
    });
  });

  describe('QUALITIES', () => {
    it('is 5-tier progression PHAM / LINH / HUYEN / TIEN / THAN', () => {
      expect(QUALITIES).toEqual(['PHAM', 'LINH', 'HUYEN', 'TIEN', 'THAN']);
      expect(QUALITIES).toHaveLength(5);
    });

    it('has unique values', () => {
      expect(new Set(QUALITIES).size).toBe(QUALITIES.length);
    });
  });

  describe('ITEM_TYPES', () => {
    it('covers 12 item types (6 equip + PILL/HERB/ORE/KEY/ARTIFACT/MISC)', () => {
      expect(ITEM_TYPES).toHaveLength(12);
      expect(ITEM_TYPES).toContain('WEAPON');
      expect(ITEM_TYPES).toContain('PILL');
      expect(ITEM_TYPES).toContain('ARTIFACT');
      expect(ITEM_TYPES).toContain('MISC');
    });

    it('includes all 6 equippable base slots (WEAPON/ARMOR/BELT/BOOTS/HAT/TRAM)', () => {
      const equipBase = ['WEAPON', 'ARMOR', 'BELT', 'BOOTS', 'HAT', 'TRAM'];
      for (const slot of equipBase) {
        expect(ITEM_TYPES).toContain(slot);
      }
    });

    it('has unique values', () => {
      expect(new Set(ITEM_TYPES).size).toBe(ITEM_TYPES.length);
    });
  });

  describe('EQUIP_SLOTS', () => {
    it('has 9 slots (6 base + 3 ARTIFACT_1/2/3)', () => {
      expect(EQUIP_SLOTS).toHaveLength(9);
      expect(EQUIP_SLOTS).toContain('ARTIFACT_1');
      expect(EQUIP_SLOTS).toContain('ARTIFACT_2');
      expect(EQUIP_SLOTS).toContain('ARTIFACT_3');
    });

    it('has unique values', () => {
      expect(new Set(EQUIP_SLOTS).size).toBe(EQUIP_SLOTS.length);
    });

    it('6 base slot names share namespace với ITEM_TYPES', () => {
      // Cross-ref invariant: equip slot name phải trùng ITEM_TYPES để catalog
      // equipment (ITEMS.slot) có thể dùng cùng literal với `kind`.
      const baseSlots = EQUIP_SLOTS.filter((s) => !s.startsWith('ARTIFACT_'));
      for (const slot of baseSlots) {
        expect(ITEM_TYPES as readonly string[]).toContain(slot);
      }
    });
  });

  describe('DIFFICULTIES', () => {
    it('has 4 tiers THUONG / KHO / AC_MONG / BAO_TAU', () => {
      expect(DIFFICULTIES).toEqual(['THUONG', 'KHO', 'AC_MONG', 'BAO_TAU']);
      expect(DIFFICULTIES).toHaveLength(4);
    });

    it('has unique values', () => {
      expect(new Set(DIFFICULTIES).size).toBe(DIFFICULTIES.length);
    });
  });

  describe('TOPUP_STATUSES', () => {
    it('is state machine {PENDING, APPROVED, REJECTED}', () => {
      expect(TOPUP_STATUSES).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
      expect(TOPUP_STATUSES).toHaveLength(3);
    });

    it('has unique values', () => {
      expect(new Set(TOPUP_STATUSES).size).toBe(TOPUP_STATUSES.length);
    });
  });

  describe('REALM_TIERS', () => {
    it('has 6 ordered mega-tiers phàm → vĩnh hằng', () => {
      expect(REALM_TIERS).toEqual([
        'pham',
        'nhan_tien',
        'tien_gioi',
        'hon_nguyen',
        'ban_nguyen',
        'vinh_hang',
      ]);
      expect(REALM_TIERS).toHaveLength(6);
    });

    it('has unique values (no duplicate tier key)', () => {
      expect(new Set(REALM_TIERS).size).toBe(REALM_TIERS.length);
    });

    it('all values are snake_case (lowercase + underscore)', () => {
      for (const tier of REALM_TIERS) {
        expect(tier).toMatch(/^[a-z]+(_[a-z]+)*$/);
      }
    });
  });
});
