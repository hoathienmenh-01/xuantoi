import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AchievementDef } from '@xuantoi/shared';

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (k: string) => k,
    },
  },
}));

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: getMock,
    post: postMock,
  },
}));

import { getAchievementsState, claimAchievement } from '@/api/achievements';

const STUB_DEF: AchievementDef = {
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
};

const STUB_ROW = {
  achievementKey: 'first_monster_kill',
  progress: 1,
  completedAt: '2026-01-01T00:00:00.000Z',
  claimedAt: null,
  def: STUB_DEF,
};

describe('api/achievements — Phase 11.10.E client', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('getAchievementsState: GET /character/achievements, parse envelope', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          achievements: [STUB_ROW],
        },
      },
    });
    const out = await getAchievementsState();
    expect(getMock).toHaveBeenCalledWith('/character/achievements');
    expect(out).toHaveLength(1);
    expect(out[0].achievementKey).toBe('first_monster_kill');
    expect(out[0].progress).toBe(1);
    expect(out[0].completedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(out[0].claimedAt).toBeNull();
    expect(out[0].def.tier).toBe('bronze');
  });

  it('getAchievementsState: server error envelope → throws error object preserving code', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'NO_CHARACTER', message: 'no char' },
      },
    });
    await expect(getAchievementsState()).rejects.toMatchObject({
      code: 'NO_CHARACTER',
    });
  });

  it('getAchievementsState: empty data → throws fallback error', async () => {
    getMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(getAchievementsState()).rejects.toBeInstanceOf(Error);
  });

  it('claimAchievement: POST /character/achievement/claim body { achievementKey }', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          claim: {
            achievementKey: 'first_monster_kill',
            claimedAt: '2026-01-02T00:00:00.000Z',
            granted: {
              linhThach: 100,
              tienNgoc: 0,
              exp: 50,
              titleKey: 'achievement_first_kill',
              items: [],
            },
          },
        },
      },
    });
    const out = await claimAchievement('first_monster_kill');
    expect(postMock).toHaveBeenCalledWith('/character/achievement/claim', {
      achievementKey: 'first_monster_kill',
    });
    expect(out.achievementKey).toBe('first_monster_kill');
    expect(out.claimedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(out.granted.linhThach).toBe(100);
    expect(out.granted.titleKey).toBe('achievement_first_kill');
  });

  it('claimAchievement: ok=false → throws error object preserving code', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'ALREADY_CLAIMED', message: 'already' },
      },
    });
    await expect(claimAchievement('first_monster_kill')).rejects.toMatchObject({
      code: 'ALREADY_CLAIMED',
    });
  });

  it('claimAchievement: empty data → throws fallback error', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(claimAchievement('first_monster_kill')).rejects.toBeInstanceOf(
      Error,
    );
  });
});
