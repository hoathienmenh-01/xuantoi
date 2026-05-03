import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/tribulation', () => ({
  attemptTribulation: vi.fn(),
}));

import * as api from '@/api/tribulation';
import { useTribulationStore } from '@/stores/tribulation';

const mockedAttempt = vi.mocked(api.attemptTribulation);

const STUB_SUCCESS: api.TribulationOutcomeView = {
  success: true,
  tribulationKey: 'kim_dan_to_nguyen_anh',
  fromRealmKey: 'kim_dan',
  toRealmKey: 'nguyen_anh',
  severity: 'major',
  type: 'lei',
  wavesCompleted: 5,
  totalDamage: 1234,
  finalHp: 567,
  attemptIndex: 1,
  reward: {
    linhThach: 1000,
    expBonus: '50000',
    titleKey: 'do_kiep_thanh_cong',
  },
  penalty: null,
  logId: 'log-1',
};

const STUB_FAIL: api.TribulationOutcomeView = {
  success: false,
  tribulationKey: 'kim_dan_to_nguyen_anh',
  fromRealmKey: 'kim_dan',
  toRealmKey: 'nguyen_anh',
  severity: 'major',
  type: 'lei',
  wavesCompleted: 2,
  totalDamage: 999,
  finalHp: 0,
  attemptIndex: 1,
  reward: null,
  penalty: {
    expBefore: '100000',
    expAfter: '50000',
    expLoss: '50000',
    cooldownAt: '2026-05-02T07:00:00.000Z',
    taoMaActive: false,
    taoMaExpiresAt: null,
  },
  logId: 'log-2',
};

describe('useTribulationStore — Phase 11.6.D', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: lastOutcome null, inFlight false, lastError null', () => {
    const s = useTribulationStore();
    expect(s.lastOutcome).toBeNull();
    expect(s.inFlight).toBe(false);
    expect(s.lastError).toBeNull();
  });

  it('attempt success outcome: lastOutcome populated, success branch, return null', async () => {
    mockedAttempt.mockResolvedValueOnce(STUB_SUCCESS);
    const s = useTribulationStore();
    const err = await s.attempt();
    expect(err).toBeNull();
    expect(s.lastOutcome).not.toBeNull();
    expect(s.lastOutcome?.success).toBe(true);
    expect(s.lastOutcome?.toRealmKey).toBe('nguyen_anh');
    expect(s.lastOutcome?.reward?.linhThach).toBe(1000);
    expect(s.inFlight).toBe(false);
    expect(s.lastError).toBeNull();
  });

  it('attempt fail simulation outcome: lastOutcome populated, fail branch, return null', async () => {
    mockedAttempt.mockResolvedValueOnce(STUB_FAIL);
    const s = useTribulationStore();
    const err = await s.attempt();
    expect(err).toBeNull();
    expect(s.lastOutcome?.success).toBe(false);
    expect(s.lastOutcome?.penalty?.expLoss).toBe('50000');
    expect(s.lastError).toBeNull();
  });

  it('attempt server reject COOLDOWN_ACTIVE: lastError set, return code, lastOutcome unchanged', async () => {
    const s = useTribulationStore();
    s.lastOutcome = STUB_SUCCESS;
    mockedAttempt.mockRejectedValueOnce({ code: 'COOLDOWN_ACTIVE' });
    const err = await s.attempt();
    expect(err).toBe('COOLDOWN_ACTIVE');
    expect(s.lastError).toBe('COOLDOWN_ACTIVE');
    // Previous outcome preserved (not cleared by reject)
    expect(s.lastOutcome).toStrictEqual(STUB_SUCCESS);
  });

  it('attempt nested error.code: extract đúng (axios envelope shape)', async () => {
    mockedAttempt.mockRejectedValueOnce({
      error: { code: 'NOT_AT_PEAK', message: 'not at peak' },
    });
    const s = useTribulationStore();
    const err = await s.attempt();
    expect(err).toBe('NOT_AT_PEAK');
    expect(s.lastError).toBe('NOT_AT_PEAK');
  });

  it('attempt unknown error: trả "UNKNOWN"', async () => {
    mockedAttempt.mockRejectedValueOnce(new Error('boom'));
    const s = useTribulationStore();
    const err = await s.attempt();
    expect(err).toBe('UNKNOWN');
    expect(s.lastError).toBe('UNKNOWN');
  });

  it('attempt double-call → second returns IN_FLIGHT (race protect)', async () => {
    let resolveFn!: (v: api.TribulationOutcomeView) => void;
    mockedAttempt.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const s = useTribulationStore();
    const p1 = s.attempt();
    expect(s.inFlight).toBe(true);
    const r2 = await s.attempt();
    expect(r2).toBe('IN_FLIGHT');
    expect(mockedAttempt).toHaveBeenCalledTimes(1);
    resolveFn(STUB_SUCCESS);
    await p1;
    expect(s.inFlight).toBe(false);
  });

  it('clearLastOutcome: reset lastOutcome về null, không động inFlight/lastError', () => {
    const s = useTribulationStore();
    s.lastOutcome = STUB_SUCCESS;
    s.lastError = 'X';
    s.clearLastOutcome();
    expect(s.lastOutcome).toBeNull();
    expect(s.lastError).toBe('X');
  });

  it('reset: clear toàn bộ state', () => {
    const s = useTribulationStore();
    s.lastOutcome = STUB_SUCCESS;
    s.lastError = 'X';
    s.inFlight = true;
    s.reset();
    expect(s.lastOutcome).toBeNull();
    expect(s.lastError).toBeNull();
    expect(s.inFlight).toBe(false);
  });

  it('attempt clear lastError trên start (không inherit error cũ)', async () => {
    const s = useTribulationStore();
    s.lastError = 'OLD_CODE';
    mockedAttempt.mockResolvedValueOnce(STUB_SUCCESS);
    await s.attempt();
    expect(s.lastError).toBeNull();
  });
});
