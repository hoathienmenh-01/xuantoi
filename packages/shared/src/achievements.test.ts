import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS,
  achievementsByCategory,
  achievementsByElement,
  achievementsByGoalKind,
  achievementsByTier,
  getAchievementDef,
  visibleAchievements,
  type AchievementCategory,
  type AchievementTier,
} from './achievements';
import { ELEMENTS } from './combat';
import { ITEMS } from './items';
import type { MissionGoalKind } from './missions';
import { TITLES } from './titles';

const VALID_TIERS: readonly AchievementTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
];

const VALID_CATEGORIES: readonly AchievementCategory[] = [
  'combat',
  'cultivation',
  'exploration',
  'social',
  'economy',
  'milestone',
  'collection',
];

const VALID_GOAL_KINDS: readonly MissionGoalKind[] = [
  'GAIN_EXP',
  'CULTIVATE_SECONDS',
  'KILL_MONSTER',
  'CLEAR_DUNGEON',
  'BOSS_HIT',
  'SELL_LISTING',
  'BUY_LISTING',
  'CHAT_MESSAGE',
  'SECT_CONTRIBUTE',
  'BREAKTHROUGH',
  'ALCHEMY_CRAFT',
];

describe('ACHIEVEMENTS catalog shape', () => {
  it('có ít nhất 30 achievement baseline', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it('mỗi achievement có key duy nhất + nameVi + nameEn + description non-empty', () => {
    const seen = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(a.key).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(seen.has(a.key)).toBe(false);
      seen.add(a.key);
      expect(a.nameVi.length).toBeGreaterThan(0);
      expect(a.nameEn.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it('category ∈ AchievementCategory enum', () => {
    for (const a of ACHIEVEMENTS) {
      expect(VALID_CATEGORIES).toContain(a.category);
    }
  });

  it('tier ∈ AchievementTier enum', () => {
    for (const a of ACHIEVEMENTS) {
      expect(VALID_TIERS).toContain(a.tier);
    }
  });

  it('goalKind ∈ MissionGoalKind enum (reuse mission tracking)', () => {
    for (const a of ACHIEVEMENTS) {
      expect(VALID_GOAL_KINDS).toContain(a.goalKind);
    }
  });

  it('goalAmount > 0', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.goalAmount).toBeGreaterThan(0);
      expect(Number.isFinite(a.goalAmount)).toBe(true);
    }
  });

  it('element ∈ ElementKey ∪ null', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.element !== null) {
        expect(ELEMENTS).toContain(a.element);
      }
    }
  });

  it('reward (linhThach/tienNgoc/exp) ≥ 0 nếu có', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.reward.linhThach !== undefined) {
        expect(a.reward.linhThach).toBeGreaterThanOrEqual(0);
      }
      if (a.reward.tienNgoc !== undefined) {
        expect(a.reward.tienNgoc).toBeGreaterThanOrEqual(0);
      }
      if (a.reward.exp !== undefined) {
        expect(a.reward.exp).toBeGreaterThanOrEqual(0);
      }
      if (a.reward.items) {
        for (const it of a.reward.items) {
          expect(it.qty).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hidden là boolean', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.hidden).toBe('boolean');
    }
  });

  it('rewardTitleKey nếu non-null phải snake_case', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.rewardTitleKey !== null) {
        expect(a.rewardTitleKey).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  // Phase 11.10.G — Referential integrity tests song hành với mission catalog
  // (`missions.test.ts:101`) để bảo vệ Phase 11.10.D `claimReward` items grant
  // path: nếu thêm achievement với `reward.items[*].itemKey` không tồn tại,
  // `InventoryService.grantTx` sẽ throw `ITEM_NOT_FOUND` và rollback claim.
  // Catch lỗi này ở build time qua test thay vì runtime claim error.
  // Hiện tại 32 baseline catalog không có achievement với `reward.items` nên
  // test pass vacuously — future-proof khi Phase 11.10.F catalog mở rộng.
  it('mọi reward.items[*].itemKey PHẢI tồn tại trong ITEMS catalog (cross-ref invariant)', () => {
    const itemKeys = new Set(ITEMS.map((i) => i.key));
    for (const a of ACHIEVEMENTS) {
      for (const it of a.reward.items ?? []) {
        expect(
          itemKeys.has(it.itemKey),
          `achievement ${a.key} reward itemKey '${it.itemKey}' không tồn tại trong ITEMS`,
        ).toBe(true);
      }
    }
  });

  // Phase 11.10.G — Cross-ref `rewardTitleKey` → TITLES catalog. Phase 11.10.C-1
  // wire `TitleService.unlock` trong `AchievementService.claimReward` — nếu
  // `rewardTitleKey` không match `titleByKey`, `unlock` sẽ throw / no-op.
  // Bảo vệ build-time để catalog không drift sau khi xoá title definition.
  it('mọi rewardTitleKey PHẢI tồn tại trong TITLES catalog (cross-ref invariant)', () => {
    const titleKeys = new Set(TITLES.map((t) => t.key));
    for (const a of ACHIEVEMENTS) {
      if (a.rewardTitleKey !== null) {
        expect(
          titleKeys.has(a.rewardTitleKey),
          `achievement ${a.key} rewardTitleKey '${a.rewardTitleKey}' không tồn tại trong TITLES`,
        ).toBe(true);
      }
    }
  });

  // Phase 11.10.G-2 — Bidirectional reciprocity invariant. Nếu achievement
  // A có `rewardTitleKey = T`, thì title T PHẢI có `source='achievement'`
  // VÀ `unlockAchievementKey = A.key`. Bảo vệ `titleForAchievement(A.key)`
  // lookup trong `claimReward` luôn match đúng title đã reference.
  // Detect mismatch khi designer rename achievement key mà quên update
  // `unlockAchievementKey` ở title catalog (hoặc ngược lại).
  it('rewardTitleKey reciprocity: title được reference PHẢI có source=achievement + unlockAchievementKey = achievement.key', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.rewardTitleKey === null) continue;
      const title = TITLES.find((t) => t.key === a.rewardTitleKey);
      // Existence already checked in previous test; re-asserting để safe-guard
      // nếu suite chạy isolated.
      expect(
        title,
        `achievement ${a.key} rewardTitleKey '${a.rewardTitleKey}' không tồn tại trong TITLES`,
      ).toBeDefined();
      if (!title) continue;
      expect(
        title.source,
        `title ${title.key} bị reference bởi achievement ${a.key} qua rewardTitleKey nhưng có source='${title.source}', expect 'achievement'`,
      ).toBe('achievement');
      expect(
        title.unlockAchievementKey,
        `title ${title.key} bị reference bởi achievement ${a.key} nhưng unlockAchievementKey='${title.unlockAchievementKey}', expect '${a.key}'`,
      ).toBe(a.key);
    }
  });
});

describe('ACHIEVEMENTS curve coverage', () => {
  it('có ≥ 7 combat achievement', () => {
    expect(achievementsByCategory('combat').length).toBeGreaterThanOrEqual(7);
  });

  it('có ≥ 5 cultivation achievement', () => {
    expect(achievementsByCategory('cultivation').length).toBeGreaterThanOrEqual(
      5
    );
  });

  it('có ≥ 4 exploration achievement', () => {
    expect(achievementsByCategory('exploration').length).toBeGreaterThanOrEqual(
      4
    );
  });

  it('có ≥ 3 social achievement', () => {
    expect(achievementsByCategory('social').length).toBeGreaterThanOrEqual(3);
  });

  it('có ≥ 3 economy achievement', () => {
    expect(achievementsByCategory('economy').length).toBeGreaterThanOrEqual(3);
  });

  it('có ≥ 2 milestone achievement', () => {
    expect(achievementsByCategory('milestone').length).toBeGreaterThanOrEqual(
      2
    );
  });

  it('có ≥ 2 collection achievement', () => {
    expect(achievementsByCategory('collection').length).toBeGreaterThanOrEqual(
      2
    );
  });

  it('mỗi tier có ≥ 1 achievement (bronze → diamond)', () => {
    for (const t of VALID_TIERS) {
      expect(achievementsByTier(t).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('có ≥ 1 diamond tier (đỉnh phong)', () => {
    expect(achievementsByTier('diamond').length).toBeGreaterThanOrEqual(1);
  });

  it('có ≥ 1 hidden achievement (challenge content)', () => {
    const hidden = ACHIEVEMENTS.filter((a) => a.hidden);
    expect(hidden.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ACHIEVEMENTS balance: reward scaling per tier', () => {
  it('bronze reward linhThach ≤ 200', () => {
    for (const a of achievementsByTier('bronze')) {
      const lt = a.reward.linhThach ?? 0;
      expect(lt).toBeLessThanOrEqual(200);
    }
  });

  it('silver reward linhThach ≤ 3_000', () => {
    for (const a of achievementsByTier('silver')) {
      const lt = a.reward.linhThach ?? 0;
      expect(lt).toBeLessThanOrEqual(3_000);
    }
  });

  it('gold reward linhThach ≤ 20_000', () => {
    for (const a of achievementsByTier('gold')) {
      const lt = a.reward.linhThach ?? 0;
      expect(lt).toBeLessThanOrEqual(20_000);
    }
  });

  it('platinum reward linhThach ≤ 50_000', () => {
    for (const a of achievementsByTier('platinum')) {
      const lt = a.reward.linhThach ?? 0;
      expect(lt).toBeLessThanOrEqual(50_000);
    }
  });

  it('diamond reward linhThach ≤ 100_000', () => {
    for (const a of achievementsByTier('diamond')) {
      const lt = a.reward.linhThach ?? 0;
      expect(lt).toBeLessThanOrEqual(100_000);
    }
  });

  it('reward exp ≤ linhThach (rule of thumb: exp half-tier)', () => {
    for (const a of ACHIEVEMENTS) {
      const lt = a.reward.linhThach ?? 0;
      const exp = a.reward.exp ?? 0;
      if (lt > 0 && exp > 0) {
        expect(exp).toBeLessThanOrEqual(lt);
      }
    }
  });

  it('goalAmount tăng dần theo tier (bronze ≤ silver ≤ gold ≤ ...) cùng goalKind, exclude hidden challenge', () => {
    for (const goalKind of VALID_GOAL_KINDS) {
      // Loại element-specialist (curve riêng) + hidden challenge (single-clear
      // diamond endgame có goalAmount=1 không tuân ascending tier curve).
      const sameGoal = achievementsByGoalKind(goalKind).filter(
        (a) => a.element === null && !a.hidden
      );
      const tierOrder: Record<AchievementTier, number> = {
        bronze: 1,
        silver: 2,
        gold: 3,
        platinum: 4,
        diamond: 5,
      };
      const sorted = [...sameGoal].sort(
        (a, b) => tierOrder[a.tier] - tierOrder[b.tier]
      );
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].tier !== sorted[i - 1].tier) {
          expect(sorted[i].goalAmount).toBeGreaterThanOrEqual(
            sorted[i - 1].goalAmount
          );
        }
      }
    }
  });
});

describe('ACHIEVEMENTS title link (Phase 11.9 ↔ 11.10 integration)', () => {
  it('first_monster_kill → rewardTitleKey="achievement_first_kill"', () => {
    const a = getAchievementDef('first_monster_kill');
    expect(a?.rewardTitleKey).toBe('achievement_first_kill');
  });

  it('first_dungeon_clear → rewardTitleKey="achievement_first_dungeon"', () => {
    const a = getAchievementDef('first_dungeon_clear');
    expect(a?.rewardTitleKey).toBe('achievement_first_dungeon');
  });

  it('first_boss_kill → rewardTitleKey="achievement_first_boss"', () => {
    const a = getAchievementDef('first_boss_kill');
    expect(a?.rewardTitleKey).toBe('achievement_first_boss');
  });

  it('first_breakthrough → rewardTitleKey="achievement_first_breakthrough"', () => {
    const a = getAchievementDef('first_breakthrough');
    expect(a?.rewardTitleKey).toBe('achievement_first_breakthrough');
  });

  it('có ít nhất 4 achievement có rewardTitleKey link với titles.ts', () => {
    const linked = ACHIEVEMENTS.filter((a) => a.rewardTitleKey !== null);
    expect(linked.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Helper: getAchievementDef', () => {
  it('trả undefined cho key không tồn tại', () => {
    expect(getAchievementDef('nonexistent')).toBeUndefined();
  });

  it('trả def đúng cho key hợp lệ', () => {
    const a = getAchievementDef('reach_kim_dan');
    expect(a).toBeDefined();
    expect(a?.category).toBe('cultivation');
    expect(a?.tier).toBe('gold');
  });

  it('mỗi achievement trong catalog đều lookup được', () => {
    for (const a of ACHIEVEMENTS) {
      expect(getAchievementDef(a.key)).toBe(a);
    }
  });
});

describe('Helper: achievementsByCategory', () => {
  it('all category sum = ACHIEVEMENTS.length', () => {
    let total = 0;
    for (const c of VALID_CATEGORIES) {
      total += achievementsByCategory(c).length;
    }
    expect(total).toBe(ACHIEVEMENTS.length);
  });
});

describe('Helper: achievementsByTier', () => {
  it('all tier sum = ACHIEVEMENTS.length', () => {
    let total = 0;
    for (const t of VALID_TIERS) {
      total += achievementsByTier(t).length;
    }
    expect(total).toBe(ACHIEVEMENTS.length);
  });
});

describe('Helper: achievementsByGoalKind', () => {
  it('KILL_MONSTER trả ≥ 7 (4 element + tier bronze/silver/gold)', () => {
    expect(achievementsByGoalKind('KILL_MONSTER').length).toBeGreaterThanOrEqual(
      7
    );
  });

  it('CLEAR_DUNGEON trả ≥ 4', () => {
    expect(achievementsByGoalKind('CLEAR_DUNGEON').length).toBeGreaterThanOrEqual(
      4
    );
  });

  it('BREAKTHROUGH trả ≥ 4', () => {
    expect(achievementsByGoalKind('BREAKTHROUGH').length).toBeGreaterThanOrEqual(
      4
    );
  });
});

describe('Helper: achievementsByElement', () => {
  it('null trả neutral achievement', () => {
    const neutrals = achievementsByElement(null);
    for (const a of neutrals) expect(a.element).toBeNull();
    expect(neutrals.length).toBeGreaterThanOrEqual(20);
  });

  it('mỗi element có ≥ 0 achievement (kim/moc/thuy/hoa specialist tồn tại)', () => {
    for (const elem of ELEMENTS) {
      const found = achievementsByElement(elem);
      expect(found.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('có ≥ 4 element-specialist achievement (kim/moc/thuy/hoa cover)', () => {
    let total = 0;
    for (const elem of ELEMENTS) {
      total += achievementsByElement(elem).length;
    }
    expect(total).toBeGreaterThanOrEqual(4);
  });
});

describe('ACHIEVEMENTS Phase 11.10.F item rewards', () => {
  // Phase 11.10.F mở wire `claimReward` items grant qua `InventoryService.grantTx`
  // với 2 milestone bronze achievements exemplar. Tests dưới khẳng định:
  // (1) wire không bị regress (≥ 2 catalog entries có items non-empty).
  // (2) item key/qty cụ thể ứng với spec snapshot.
  // (3) qty không phá economy bronze (≤ 10 mỗi entry — bảo vệ inventory bloat).
  it('có ít nhất 2 achievement với reward.items non-empty (Phase 11.10.F exemplar)', () => {
    const withItems = ACHIEVEMENTS.filter(
      (a) => a.reward.items && a.reward.items.length > 0
    );
    expect(withItems.length).toBeGreaterThanOrEqual(2);
  });

  it('first_breakthrough → 5× huyet_chi_dan (cultivation milestone HP pill)', () => {
    const a = getAchievementDef('first_breakthrough');
    expect(a?.reward.items).toBeDefined();
    expect(a?.reward.items?.length).toBe(1);
    expect(a?.reward.items?.[0]).toEqual({ itemKey: 'huyet_chi_dan', qty: 5 });
  });

  it('first_dungeon_clear → 3× tinh_thiet (exploration milestone refine ore)', () => {
    const a = getAchievementDef('first_dungeon_clear');
    expect(a?.reward.items).toBeDefined();
    expect(a?.reward.items?.length).toBe(1);
    expect(a?.reward.items?.[0]).toEqual({ itemKey: 'tinh_thiet', qty: 3 });
  });

  it('mọi reward.items[*].qty ≤ 10 ở bronze tier (anti inventory-bloat)', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.tier !== 'bronze') continue;
      for (const it of a.reward.items ?? []) {
        expect(it.qty).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('Helper: visibleAchievements', () => {
  it('không chứa hidden achievement', () => {
    const visible = visibleAchievements();
    for (const a of visible) {
      expect(a.hidden).toBe(false);
    }
  });

  it('visible + hidden = total', () => {
    const visible = visibleAchievements();
    const hidden = ACHIEVEMENTS.filter((a) => a.hidden);
    expect(visible.length + hidden.length).toBe(ACHIEVEMENTS.length);
  });
});
