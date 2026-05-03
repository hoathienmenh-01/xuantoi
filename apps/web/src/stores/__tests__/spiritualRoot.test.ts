import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/spiritualRoot', () => ({
  getSpiritualRootState: vi.fn(),
  rerollSpiritualRoot: vi.fn(),
}));

import * as api from '@/api/spiritualRoot';
import { useSpiritualRootStore } from '@/stores/spiritualRoot';

const mockedGet = vi.mocked(api.getSpiritualRootState);
const mockedReroll = vi.mocked(api.rerollSpiritualRoot);

const STUB_STATE: api.SpiritualRootState = {
  grade: 'linh',
  primaryElement: 'kim',
  secondaryElements: ['moc'],
  purity: 88,
  rerollCount: 0,
};

const STUB_REROLLED: api.SpiritualRootState = {
  grade: 'huyen',
  primaryElement: 'thuy',
  secondaryElements: ['kim', 'moc'],
  purity: 95,
  rerollCount: 1,
};

describe('useSpiritualRootStore — Phase 11.3.D', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: state null, not loaded, not rerolling', () => {
    const s = useSpiritualRootStore();
    expect(s.state).toBeNull();
    expect(s.loaded).toBe(false);
    expect(s.rerolling).toBe(false);
  });

  it('fetchState: hydrate state + loaded=true', async () => {
    mockedGet.mockResolvedValueOnce(STUB_STATE);
    const s = useSpiritualRootStore();
    await s.fetchState();
    expect(s.state).toEqual(STUB_STATE);
    expect(s.loaded).toBe(true);
  });

  it('reroll success: cập nhật state + return null', async () => {
    const s = useSpiritualRootStore();
    s.state = STUB_STATE;
    s.loaded = true;
    mockedReroll.mockResolvedValueOnce(STUB_REROLLED);
    const err = await s.reroll();
    expect(err).toBeNull();
    expect(s.state).toEqual(STUB_REROLLED);
    expect(s.rerolling).toBe(false);
  });

  it('reroll server error code: return code, state không đổi', async () => {
    const s = useSpiritualRootStore();
    s.state = STUB_STATE;
    s.loaded = true;
    mockedReroll.mockRejectedValueOnce({ code: 'LINH_CAN_DAN_INSUFFICIENT' });
    const err = await s.reroll();
    expect(err).toBe('LINH_CAN_DAN_INSUFFICIENT');
    expect(s.state).toEqual(STUB_STATE);
    expect(s.rerolling).toBe(false);
  });

  it('reroll nested error.code (axios envelope): extract đúng', async () => {
    const s = useSpiritualRootStore();
    mockedReroll.mockRejectedValueOnce({
      error: { code: 'NOT_INITIALIZED', message: 'no state' },
    });
    const err = await s.reroll();
    expect(err).toBe('NOT_INITIALIZED');
  });

  it('reroll unknown error: return "UNKNOWN"', async () => {
    const s = useSpiritualRootStore();
    mockedReroll.mockRejectedValueOnce(new Error('boom'));
    const err = await s.reroll();
    expect(err).toBe('UNKNOWN');
  });

  it('reroll double-call: second returns IN_FLIGHT (race protect)', async () => {
    const s = useSpiritualRootStore();
    s.state = STUB_STATE;
    s.loaded = true;
    let resolveFn!: (v: api.SpiritualRootState) => void;
    mockedReroll.mockImplementationOnce(
      () =>
        new Promise<api.SpiritualRootState>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const p1 = s.reroll();
    const r2 = await s.reroll();
    expect(r2).toBe('IN_FLIGHT');
    resolveFn(STUB_REROLLED);
    await p1;
    expect(s.state).toEqual(STUB_REROLLED);
    expect(s.rerolling).toBe(false);
  });

  it('reset: clear state + loaded + rerolling', async () => {
    const s = useSpiritualRootStore();
    s.state = STUB_STATE;
    s.loaded = true;
    s.rerolling = true;
    s.reset();
    expect(s.state).toBeNull();
    expect(s.loaded).toBe(false);
    expect(s.rerolling).toBe(false);
  });
});
