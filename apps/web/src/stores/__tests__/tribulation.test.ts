import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/tribulation', () => ({
  attemptTribulation: vi.fn(),
  fetchAttemptLog: vi.fn(),
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

const mockedFetchLog = vi.mocked(api.fetchAttemptLog);

const STUB_LOG_ROW: api.TribulationAttemptLogView = {
  id: 'log-x-1',
  tribulationKey: 'kim_dan_to_nguyen_anh',
  fromRealmKey: 'kim_dan',
  toRealmKey: 'nguyen_anh',
  severity: 'major',
  type: 'lei',
  success: true,
  wavesCompleted: 5,
  totalDamage: 1234,
  finalHp: 567,
  hpInitial: 1000,
  expBefore: '100000',
  expAfter: '150000',
  expLoss: '0',
  taoMaActive: false,
  taoMaExpiresAt: null,
  cooldownAt: null,
  linhThachReward: 1000,
  expBonusReward: '50000',
  titleKeyReward: 'do_kiep_thanh_cong',
  attemptIndex: 1,
  taoMaRoll: 0.5,
  createdAt: '2026-05-02T01:00:00.000Z',
};

describe('useTribulationStore — Phase 11.6.G fetchHistory', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: history null, historyLoading false, historyError null', () => {
    const s = useTribulationStore();
    expect(s.history).toBeNull();
    expect(s.historyLoading).toBe(false);
    expect(s.historyError).toBeNull();
  });

  it('fetchHistory success → history populated với rows, return null', async () => {
    mockedFetchLog.mockResolvedValueOnce({ rows: [STUB_LOG_ROW], limit: 20 });
    const s = useTribulationStore();
    const err = await s.fetchHistory();
    expect(err).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history?.[0]?.id).toBe('log-x-1');
    expect(s.historyLoading).toBe(false);
    expect(s.historyError).toBeNull();
  });

  it('fetchHistory empty server → history=[]', async () => {
    mockedFetchLog.mockResolvedValueOnce({ rows: [], limit: 20 });
    const s = useTribulationStore();
    await s.fetchHistory();
    expect(s.history).toEqual([]);
  });

  it('fetchHistory(limit=10) → forward limit qua api', async () => {
    mockedFetchLog.mockResolvedValueOnce({ rows: [], limit: 10 });
    const s = useTribulationStore();
    await s.fetchHistory(10);
    expect(mockedFetchLog).toHaveBeenCalledWith(10);
  });

  it('fetchHistory server reject UNAUTHENTICATED → historyError set, return code', async () => {
    mockedFetchLog.mockRejectedValueOnce({ code: 'UNAUTHENTICATED' });
    const s = useTribulationStore();
    const err = await s.fetchHistory();
    expect(err).toBe('UNAUTHENTICATED');
    expect(s.historyError).toBe('UNAUTHENTICATED');
    expect(s.history).toBeNull();
  });

  it('fetchHistory unknown error → trả "UNKNOWN"', async () => {
    mockedFetchLog.mockRejectedValueOnce(new Error('network'));
    const s = useTribulationStore();
    const err = await s.fetchHistory();
    expect(err).toBe('UNKNOWN');
    expect(s.historyError).toBe('UNKNOWN');
  });

  it('fetchHistory double-call → second returns IN_FLIGHT (race protect)', async () => {
    let resolveFn!: (v: {
      rows: api.TribulationAttemptLogView[];
      limit: number;
    }) => void;
    mockedFetchLog.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const s = useTribulationStore();
    const p1 = s.fetchHistory();
    expect(s.historyLoading).toBe(true);
    const r2 = await s.fetchHistory();
    expect(r2).toBe('IN_FLIGHT');
    expect(mockedFetchLog).toHaveBeenCalledTimes(1);
    resolveFn({ rows: [], limit: 20 });
    await p1;
    expect(s.historyLoading).toBe(false);
  });

  it('fetchHistory clear historyError trên start', async () => {
    const s = useTribulationStore();
    s.historyError = 'OLD';
    mockedFetchLog.mockResolvedValueOnce({ rows: [], limit: 20 });
    await s.fetchHistory();
    expect(s.historyError).toBeNull();
  });

  it('reset clear history + historyLoading + historyError', () => {
    const s = useTribulationStore();
    s.history = [STUB_LOG_ROW];
    s.historyLoading = true;
    s.historyError = 'X';
    s.reset();
    expect(s.history).toBeNull();
    expect(s.historyLoading).toBe(false);
    expect(s.historyError).toBeNull();
  });
});
