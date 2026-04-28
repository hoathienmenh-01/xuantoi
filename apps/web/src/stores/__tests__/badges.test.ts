import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const getNextActionsMock = vi.fn();

vi.mock('@/api/nextAction', () => ({
  getNextActions: (...args: unknown[]) => getNextActionsMock(...args),
}));

import { useBadgesStore } from '@/stores/badges';
import type { NextAction } from '@/api/nextAction';

const ACTION_BREAKTHROUGH: NextAction = {
  key: 'BREAKTHROUGH_READY',
  priority: 100,
  params: {},
  route: '/cultivate',
};

const actionMission = (count: number | string): NextAction => ({
  key: 'MISSION_CLAIMABLE',
  priority: 90,
  params: { count },
  route: '/missions',
});

const actionMail = (count: number | string): NextAction => ({
  key: 'MAIL_UNCLAIMED',
  priority: 80,
  params: { count },
  route: '/mail',
});

const ACTION_BOSS: NextAction = {
  key: 'BOSS_ACTIVE',
  priority: 70,
  params: {},
  route: '/boss',
};

const ACTION_TOPUP: NextAction = {
  key: 'TOPUP_PENDING',
  priority: 60,
  params: {},
  route: '/topup',
};

describe('useBadgesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    getNextActionsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default state — no actions, all counters 0/false', () => {
    const b = useBadgesStore();
    expect(b.actions).toEqual([]);
    expect(b.lastFetchAt).toBeNull();
    expect(b.missionClaimable).toBe(0);
    expect(b.mailUnclaimed).toBe(0);
    expect(b.bossActive).toBe(false);
    expect(b.topupPending).toBe(false);
    expect(b.breakthroughReady).toBe(false);
  });

  it('refresh() populates actions + computed counters from API', async () => {
    getNextActionsMock.mockResolvedValueOnce([
      actionMission(3),
      actionMail(7),
      ACTION_BOSS,
      ACTION_TOPUP,
      ACTION_BREAKTHROUGH,
    ]);
    const b = useBadgesStore();
    await b.refresh();
    expect(b.actions).toHaveLength(5);
    expect(b.lastFetchAt).toBeTypeOf('number');
    expect(b.missionClaimable).toBe(3);
    expect(b.mailUnclaimed).toBe(7);
    expect(b.bossActive).toBe(true);
    expect(b.topupPending).toBe(true);
    expect(b.breakthroughReady).toBe(true);
  });

  it('coerces string count to number', async () => {
    getNextActionsMock.mockResolvedValueOnce([actionMission('5'), actionMail('12')]);
    const b = useBadgesStore();
    await b.refresh();
    expect(b.missionClaimable).toBe(5);
    expect(b.mailUnclaimed).toBe(12);
  });

  it('treats missing/NaN params.count as 0', async () => {
    getNextActionsMock.mockResolvedValueOnce([
      { key: 'MISSION_CLAIMABLE', priority: 90, params: {}, route: '/missions' },
      { key: 'MAIL_UNCLAIMED', priority: 80, params: { count: 'abc' }, route: '/mail' },
    ]);
    const b = useBadgesStore();
    await b.refresh();
    expect(b.missionClaimable).toBe(0);
    expect(b.mailUnclaimed).toBe(0);
  });

  it('refresh() silently swallows API errors and keeps prior state', async () => {
    const b = useBadgesStore();
    getNextActionsMock.mockResolvedValueOnce([actionMission(2)]);
    await b.refresh();
    expect(b.missionClaimable).toBe(2);
    const lastAt = b.lastFetchAt;

    getNextActionsMock.mockRejectedValueOnce(new Error('network down'));
    await expect(b.refresh()).resolves.toBeUndefined();
    expect(b.missionClaimable).toBe(2);
    expect(b.lastFetchAt).toBe(lastAt);
  });

  it('start() triggers immediate refresh + polls every 60s', async () => {
    getNextActionsMock.mockResolvedValue([actionMission(1)]);
    const b = useBadgesStore();
    b.start();
    expect(getNextActionsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getNextActionsMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getNextActionsMock).toHaveBeenCalledTimes(3);

    b.stop();
  });

  it('start() is idempotent — calling twice does not double-poll', async () => {
    getNextActionsMock.mockResolvedValue([]);
    const b = useBadgesStore();
    b.start();
    b.start();
    expect(getNextActionsMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getNextActionsMock).toHaveBeenCalledTimes(2);
    b.stop();
  });

  it('stop() halts polling immediately', async () => {
    getNextActionsMock.mockResolvedValue([]);
    const b = useBadgesStore();
    b.start();
    expect(getNextActionsMock).toHaveBeenCalledTimes(1);
    b.stop();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(getNextActionsMock).toHaveBeenCalledTimes(1);
  });

  it('stop() before start() is a no-op', () => {
    const b = useBadgesStore();
    expect(() => b.stop()).not.toThrow();
  });
});
