import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/skill', () => ({
  getSkillState: vi.fn(),
  equipSkill: vi.fn(),
  unequipSkill: vi.fn(),
  upgradeSkillMastery: vi.fn(),
}));

import * as api from '@/api/skill';
import { useSkillStore } from '@/stores/skill';

const mockedGet = vi.mocked(api.getSkillState);
const mockedEquip = vi.mocked(api.equipSkill);
const mockedUnequip = vi.mocked(api.unequipSkill);
const mockedUpgrade = vi.mocked(api.upgradeSkillMastery);

const STATE_WITH_BASIC: api.SkillState = {
  maxEquipped: 4,
  learned: [
    {
      skillKey: 'basic_attack',
      tier: 'basic',
      masteryLevel: 1,
      maxMastery: 5,
      isEquipped: true,
      source: 'starter',
      learnedAt: '2026-05-03T17:00:00.000Z',
      effective: { atkScale: 1, mpCost: 0, cooldownTurns: 0 },
      nextLevelLinhThachCost: 100,
      nextLevelShardCost: 0,
    },
  ],
};

const STATE_AFTER_EQUIP: api.SkillState = {
  maxEquipped: 4,
  learned: [
    ...STATE_WITH_BASIC.learned,
    {
      skillKey: 'kiem_khi_chem',
      tier: 'intermediate',
      masteryLevel: 1,
      maxMastery: 7,
      isEquipped: true,
      source: 'sect',
      learnedAt: '2026-05-03T17:00:01.000Z',
      effective: { atkScale: 1.7, mpCost: 12, cooldownTurns: 0 },
      nextLevelLinhThachCost: 200,
      nextLevelShardCost: 0,
    },
  ],
};

describe('useSkillStore — Phase 11.2.C', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: empty learned, not loaded, no inFlight, equipped=0', () => {
    const s = useSkillStore();
    expect(s.learned).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.maxEquipped).toBe(4);
    expect(s.equippedCount).toBe(0);
  });

  it('fetchState hydrate + equippedCount derive', async () => {
    mockedGet.mockResolvedValueOnce(STATE_AFTER_EQUIP);
    const s = useSkillStore();
    await s.fetchState();
    expect(s.loaded).toBe(true);
    expect(s.learned.length).toBe(2);
    expect(s.equippedCount).toBe(2);
  });

  it('equip success: refresh state + return null', async () => {
    mockedEquip.mockResolvedValueOnce(STATE_AFTER_EQUIP);
    const s = useSkillStore();
    s.learned = [...STATE_WITH_BASIC.learned];
    s.loaded = true;
    const code = await s.equip('kiem_khi_chem');
    expect(code).toBeNull();
    expect(s.learned.length).toBe(2);
    expect(s.isInFlight('kiem_khi_chem')).toBe(false);
  });

  it('equip server error: return code, state không đổi', async () => {
    mockedEquip.mockRejectedValueOnce({ code: 'TOO_MANY_EQUIPPED' });
    const s = useSkillStore();
    s.learned = [...STATE_WITH_BASIC.learned];
    s.loaded = true;
    const code = await s.equip('kiem_khi_chem');
    expect(code).toBe('TOO_MANY_EQUIPPED');
    expect(s.learned.length).toBe(1);
    expect(s.isInFlight('kiem_khi_chem')).toBe(false);
  });

  it('equip nested error.code (envelope): extract đúng', async () => {
    mockedEquip.mockRejectedValueOnce({
      error: { code: 'NOT_LEARNED', message: 'not learned' },
    });
    const s = useSkillStore();
    const code = await s.equip('kiem_khi_chem');
    expect(code).toBe('NOT_LEARNED');
  });

  it('equip unknown error → "UNKNOWN"', async () => {
    mockedEquip.mockRejectedValueOnce(new Error('boom'));
    const s = useSkillStore();
    const code = await s.equip('kiem_khi_chem');
    expect(code).toBe('UNKNOWN');
  });

  it('equip double-call: second returns IN_FLIGHT (race protect)', async () => {
    let resolveFn!: (v: api.SkillState) => void;
    mockedEquip.mockImplementationOnce(
      () =>
        new Promise<api.SkillState>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const s = useSkillStore();
    const p1 = s.equip('kiem_khi_chem');
    const r2 = await s.equip('kiem_khi_chem');
    expect(r2).toBe('IN_FLIGHT');
    resolveFn(STATE_AFTER_EQUIP);
    await p1;
    expect(s.isInFlight('kiem_khi_chem')).toBe(false);
  });

  it('unequip success: refresh state', async () => {
    mockedUnequip.mockResolvedValueOnce(STATE_WITH_BASIC);
    const s = useSkillStore();
    s.learned = [...STATE_AFTER_EQUIP.learned];
    s.loaded = true;
    const code = await s.unequip('kiem_khi_chem');
    expect(code).toBeNull();
    expect(s.learned.length).toBe(1);
  });

  it('upgradeMastery success: re-fetch full state', async () => {
    mockedUpgrade.mockResolvedValueOnce({
      skillKey: 'kiem_khi_chem',
      previousLevel: 1,
      newLevel: 2,
      linhThachSpent: 200,
      shardSpent: 0,
    });
    mockedGet.mockResolvedValueOnce(STATE_AFTER_EQUIP);
    const s = useSkillStore();
    s.learned = [...STATE_AFTER_EQUIP.learned];
    s.loaded = true;
    const code = await s.upgradeMastery('kiem_khi_chem');
    expect(code).toBeNull();
    expect(mockedUpgrade).toHaveBeenCalledWith('kiem_khi_chem');
    expect(mockedGet).toHaveBeenCalled();
  });

  it('upgradeMastery INSUFFICIENT_FUNDS error → return code without re-fetch', async () => {
    mockedUpgrade.mockRejectedValueOnce({ code: 'INSUFFICIENT_FUNDS' });
    const s = useSkillStore();
    s.learned = [...STATE_AFTER_EQUIP.learned];
    s.loaded = true;
    const code = await s.upgradeMastery('kiem_khi_chem');
    expect(code).toBe('INSUFFICIENT_FUNDS');
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('reset: clear all state', () => {
    const s = useSkillStore();
    s.learned = [...STATE_AFTER_EQUIP.learned];
    s.loaded = true;
    s.maxEquipped = 4;
    s.reset();
    expect(s.learned).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.maxEquipped).toBe(4);
    expect(s.isInFlight('kiem_khi_chem')).toBe(false);
  });
});
