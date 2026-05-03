import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { AchievementDef } from '@xuantoi/shared';

vi.mock('@/api/achievements', () => ({
  getAchievementsState: vi.fn(),
  claimAchievement: vi.fn(),
}));

import * as api from '@/api/achievements';
import { useAchievementsStore } from '@/stores/achievements';

const mockedGet = vi.mocked(api.getAchievementsState);
const mockedClaim = vi.mocked(api.claimAchievement);

const STUB_DEF: AchievementDef = {
  key: 'first_monster_kill',
  nameVi: 'Sơ Sát',
  nameEn: 'First Blood',
  description: 'desc',
  category: 'combat',
  tier: 'bronze',
  goalKind: 'KILL_MONSTER',
  goalAmount: 1,
  element: null,
  rewardTitleKey: 'achievement_first_kill',
  reward: { linhThach: 100, exp: 50 },
  hidden: false,
};

const STUB_DEF_2: AchievementDef = {
  ...STUB_DEF,
  key: 'kill_100_monsters',
  nameVi: 'Bách Sát',
  nameEn: 'Hundred',
  goalAmount: 100,
  tier: 'silver',
};

const ROW_COMPLETED_UNCLAIMED: api.AchievementRow = {
  achievementKey: 'first_monster_kill',
  progress: 1,
  completedAt: '2026-01-01T00:00:00.000Z',
  claimedAt: null,
  def: STUB_DEF,
};

const ROW_IN_PROGRESS: api.AchievementRow = {
  achievementKey: 'kill_100_monsters',
  progress: 30,
  completedAt: null,
  claimedAt: null,
  def: STUB_DEF_2,
};

const ROW_CLAIMED: api.AchievementRow = {
  ...ROW_COMPLETED_UNCLAIMED,
  claimedAt: '2026-01-02T00:00:00.000Z',
};

describe('useAchievementsStore — Phase 11.10.E', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: rows empty, not loaded, no inFlight, lastClaim null', () => {
    const s = useAchievementsStore();
    expect(s.rows).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.inFlight.size).toBe(0);
    expect(s.lastClaim).toBeNull();
    expect(s.completedCount).toBe(0);
    expect(s.claimableCount).toBe(0);
  });

  it('fetchState: hydrate rows + loaded=true', async () => {
    mockedGet.mockResolvedValueOnce([ROW_COMPLETED_UNCLAIMED, ROW_IN_PROGRESS]);
    const s = useAchievementsStore();
    await s.fetchState();
    expect(s.rows).toHaveLength(2);
    expect(s.loaded).toBe(true);
  });

  it('completedCount/claimableCount computed reflect rows state', async () => {
    mockedGet.mockResolvedValueOnce([
      ROW_COMPLETED_UNCLAIMED,
      ROW_IN_PROGRESS,
      ROW_CLAIMED,
    ]);
    const s = useAchievementsStore();
    await s.fetchState();
    expect(s.completedCount).toBe(2); // 2 có completedAt
    expect(s.claimableCount).toBe(1); // 1 chưa claim
  });

  it('isClaiming/findRow helpers', async () => {
    mockedGet.mockResolvedValueOnce([ROW_COMPLETED_UNCLAIMED]);
    const s = useAchievementsStore();
    await s.fetchState();
    expect(s.isClaiming('first_monster_kill')).toBe(false);
    expect(s.findRow('first_monster_kill')?.progress).toBe(1);
    expect(s.findRow('does_not_exist')).toBeUndefined();
  });

  it('claim success: patch row.claimedAt + set lastClaim', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED, ROW_IN_PROGRESS];
    s.loaded = true;
    mockedClaim.mockResolvedValueOnce({
      achievementKey: 'first_monster_kill',
      claimedAt: '2026-01-02T00:00:00.000Z',
      granted: {
        linhThach: 100,
        tienNgoc: 0,
        exp: 50,
        titleKey: 'achievement_first_kill',
        items: [],
      },
    });
    const err = await s.claim('first_monster_kill');
    expect(err).toBeNull();
    expect(mockedClaim).toHaveBeenCalledWith('first_monster_kill');
    expect(s.findRow('first_monster_kill')?.claimedAt).toBe(
      '2026-01-02T00:00:00.000Z',
    );
    expect(s.lastClaim?.achievementKey).toBe('first_monster_kill');
    expect(s.lastClaim?.granted.linhThach).toBe(100);
  });

  it('claim server error code: trả code, không update row', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED];
    mockedClaim.mockRejectedValueOnce({ code: 'NOT_FOUND_PROGRESS' });
    const err = await s.claim('first_monster_kill');
    expect(err).toBe('NOT_FOUND_PROGRESS');
    expect(s.findRow('first_monster_kill')?.claimedAt).toBeNull();
  });

  it('claim nested error.code: extract đúng (axios envelope)', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED];
    mockedClaim.mockRejectedValueOnce({
      error: { code: 'ALREADY_CLAIMED', message: 'already' },
    });
    const err = await s.claim('first_monster_kill');
    expect(err).toBe('ALREADY_CLAIMED');
  });

  it('claim unknown error: trả "UNKNOWN"', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED];
    mockedClaim.mockRejectedValueOnce(new Error('boom'));
    const err = await s.claim('first_monster_kill');
    expect(err).toBe('UNKNOWN');
  });

  it('claim row đã claimed: trả ALREADY_CLAIMED, không gọi API', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_CLAIMED];
    const err = await s.claim('first_monster_kill');
    expect(err).toBe('ALREADY_CLAIMED');
    expect(mockedClaim).not.toHaveBeenCalled();
  });

  it('claim row chưa complete: trả NOT_COMPLETED, không gọi API', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_IN_PROGRESS];
    const err = await s.claim('kill_100_monsters');
    expect(err).toBe('NOT_COMPLETED');
    expect(mockedClaim).not.toHaveBeenCalled();
  });

  it('claim double-call same key → second returns IN_FLIGHT (race protect)', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED];
    s.loaded = true;
    let resolveFn!: (v: api.AchievementClaimResult) => void;
    mockedClaim.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const p1 = s.claim('first_monster_kill');
    const r2 = await s.claim('first_monster_kill');
    expect(r2).toBe('IN_FLIGHT');
    resolveFn({
      achievementKey: 'first_monster_kill',
      claimedAt: '2026-01-02T00:00:00.000Z',
      granted: {
        linhThach: 100,
        tienNgoc: 0,
        exp: 50,
        titleKey: null,
        items: [],
      },
    });
    await p1;
  });

  it('reset: trả về state ban đầu', async () => {
    const s = useAchievementsStore();
    s.rows = [ROW_COMPLETED_UNCLAIMED];
    s.loaded = true;
    s.lastClaim = {
      achievementKey: 'x',
      claimedAt: '2026-01-01T00:00:00.000Z',
      granted: { linhThach: 0, tienNgoc: 0, exp: 0, titleKey: null, items: [] },
    };
    s.reset();
    expect(s.rows).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.inFlight.size).toBe(0);
    expect(s.lastClaim).toBeNull();
  });
});
