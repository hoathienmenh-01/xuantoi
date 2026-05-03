import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

/**
 * Phase 11.6.D — TribulationView test suite.
 *
 * Bao phủ:
 *  - Empty state: chưa có character / no_next_realm / low_tier (transition
 *    không có def).
 *  - Render upcoming tribulation card khi character at peak có def
 *    (kim_dan stage 9 → nguyen_anh).
 *  - Severity + type badges đúng class theo def.
 *  - Reward preview + penalty preview render đủ.
 *  - Button "Vượt kiếp" disable khi inFlight / not at peak / no def.
 *  - Click button → store.attempt called, toast fired theo branch.
 *  - Outcome banner success/fail render đúng.
 *  - Outcome dismiss button → clearLastOutcome.
 */

interface CharacterStub {
  realmKey: string;
  realmStage: number;
  tribulationCooldownAt?: string | null;
  taoMaUntil?: string | null;
}

interface TribulationStateStub {
  lastOutcome: unknown;
  inFlight: boolean;
  lastError: string | null;
  attempt: ReturnType<typeof vi.fn>;
  clearLastOutcome: ReturnType<typeof vi.fn>;
}

const replaceMock = vi.fn();
const attemptMock = vi.fn();
const clearLastOutcomeMock = vi.fn();
const fetchStateMock = vi.fn().mockResolvedValue(undefined);
const toastPushMock = vi.fn();

const tribulationState: TribulationStateStub = {
  lastOutcome: null,
  inFlight: false,
  lastError: null,
  attempt: attemptMock,
  clearLastOutcome: clearLastOutcomeMock,
};

const gameState: { character: CharacterStub | null; realmFullName: string } = {
  character: { realmKey: 'kim_dan', realmStage: 9 },
  realmFullName: 'Kim Đan Cửu Trọng',
};

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    hydrate: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: true,
  }),
}));
vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    fetchState: fetchStateMock,
    bindSocket: vi.fn(),
    get character() {
      return gameState.character;
    },
    get realmFullName() {
      return gameState.realmFullName;
    },
  }),
}));
vi.mock('@/stores/tribulation', () => ({
  useTribulationStore: () => tribulationState,
}));
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({
    push: toastPushMock,
  }),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

import TribulationView from '@/views/TribulationView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      tribulation: {
        title: 'Thiên Kiếp',
        subtitle: 'sub',
        currentRealm: 'Cảnh giới: {name}',
        notAtPeakHint: 'Cần đỉnh cảnh giới',
        severity: {
          minor: 'Tiểu',
          major: 'Đại',
          heavenly: 'Thiên',
          saint: 'Thánh',
        },
        type: {
          lei: 'Lôi',
          phong: 'Phong',
          bang: 'Băng',
          hoa: 'Hoả',
          tam: 'Tâm Ma',
        },
        field: {
          transition: 'Chuyển kiếp',
          waves: 'Số đợt',
          rewardPreview: 'Reward',
          penaltyPreview: 'Penalty',
          rewardLinhThach: 'Linh thạch',
          rewardExpBonus: 'EXP bonus',
          rewardTitle: 'Danh hiệu',
          penaltyExpLoss: 'Mất EXP',
          penaltyCooldown: 'Cooldown',
          penaltyTaoMa: 'Tâm Ma',
        },
        unit: { minutes: 'phút' },
        button: {
          attempt: 'Vượt kiếp',
          attempting: 'Đang vượt kiếp',
          unavailable: 'Chưa có kiếp',
          notAtPeak: 'Chưa đỉnh',
          cooldown: 'Chờ {remaining}',
        },
        cooldown: {
          title: 'Đang cooldown',
          remaining: 'Chờ {remaining}',
        },
        taoMa: {
          title: 'Tâm Ma',
          remaining: 'Tan trong {remaining}',
        },
        empty: {
          noCharacter: 'Chưa có nhân vật',
          noNextRealm: 'Đỉnh',
          lowTier: 'Không cần kiếp {from} {to}',
        },
        outcome: {
          successTitle: 'Vượt kiếp thành công',
          failTitle: 'Thất bại',
          dismiss: 'Đóng',
          transition: '{from} → {to}',
          wavesCompleted: 'Đợt {count}',
          totalDamage: 'Sát thương {dmg}',
          rewardLinhThach: 'Linh thạch {amount}',
          rewardExpBonus: 'EXP {amount}',
          rewardTitle: 'Title {key}',
          penaltyExpLoss: 'Mất {amount}',
          penaltyCooldown: 'Cooldown {ts}',
          penaltyTaoMa: 'Tâm Ma {ts}',
        },
        attempt: {
          successToast: 'Vượt thành công {to}',
          failToast: 'Vượt thất bại',
        },
        errors: {
          NOT_AT_PEAK: 'Chưa đỉnh',
          COOLDOWN_ACTIVE: 'Cooldown',
          UNKNOWN: 'Lỗi',
        },
      },
    },
  },
});

function mountView() {
  return mount(TribulationView, { global: { plugins: [i18n] } });
}

function resetState() {
  tribulationState.lastOutcome = null;
  tribulationState.inFlight = false;
  tribulationState.lastError = null;
  gameState.character = { realmKey: 'kim_dan', realmStage: 9 };
  gameState.realmFullName = 'Kim Đan Cửu Trọng';
  attemptMock.mockReset();
  clearLastOutcomeMock.mockReset();
  fetchStateMock.mockReset();
  fetchStateMock.mockResolvedValue(undefined);
  toastPushMock.mockClear();
  replaceMock.mockClear();
}

const STUB_SUCCESS_OUTCOME = {
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

const STUB_FAIL_OUTCOME = {
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
    taoMaActive: true,
    taoMaExpiresAt: '2026-05-02T08:00:00.000Z',
  },
  logId: 'log-2',
};

describe('TribulationView — empty state', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('hiển thị empty.noCharacter khi chưa có character', async () => {
    gameState.character = null;
    const w = mountView();
    await flushPromises();
    const empty = w.find('[data-testid="tribulation-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('Chưa có nhân vật');
  });

  it('hiển thị empty.noNextRealm khi đã ở cảnh giới đỉnh', async () => {
    gameState.character = { realmKey: 'hu_khong_chi_ton', realmStage: 1 };
    const w = mountView();
    await flushPromises();
    const empty = w.find('[data-testid="tribulation-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('Đỉnh');
  });

  it('hiển thị empty.lowTier khi transition không cần kiếp (truc_co → kim_dan)', async () => {
    gameState.character = { realmKey: 'truc_co', realmStage: 9 };
    const w = mountView();
    await flushPromises();
    const empty = w.find('[data-testid="tribulation-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('Không cần kiếp');
  });
});

describe('TribulationView — upcoming card render (kim_dan → nguyen_anh)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('hiển thị card với tên + severity + type badge khi có def', async () => {
    const w = mountView();
    await flushPromises();
    const card = w.find('[data-testid^="tribulation-card-"]');
    expect(card.exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-severity-badge"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-type-badge"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-empty"]').exists()).toBe(false);
  });

  it('hiển thị reward preview (linhThach + expBonus)', async () => {
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-reward-linhThach"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-reward-expBonus"]').exists()).toBe(true);
  });

  it('hiển thị penalty preview (expLoss + cooldown + taoMa)', async () => {
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-penalty-expLoss"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-penalty-cooldown"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-penalty-taoMa"]').exists()).toBe(true);
  });

  it('button enable khi at peak + có def', async () => {
    const w = mountView();
    await flushPromises();
    const btn = w.find('[data-testid="tribulation-attempt-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('disabled')).toBeUndefined();
  });

  it('button disable + hint khi không at peak (stage < 9)', async () => {
    gameState.character = { realmKey: 'kim_dan', realmStage: 5 };
    const w = mountView();
    await flushPromises();
    const btn = w.find('[data-testid="tribulation-attempt-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('disabled')).toBeDefined();
    expect(w.find('[data-testid="tribulation-not-at-peak-hint"]').exists()).toBe(true);
  });

  it('button disable khi inFlight', async () => {
    tribulationState.inFlight = true;
    const w = mountView();
    await flushPromises();
    const btn = w.find('[data-testid="tribulation-attempt-button"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });
});

describe('TribulationView — attempt action', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('click button → attempt called', async () => {
    attemptMock.mockResolvedValueOnce(null);
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-attempt-button"]').trigger('click');
    await flushPromises();
    expect(attemptMock).toHaveBeenCalled();
  });

  it('attempt success outcome → toast.success + fetchState', async () => {
    attemptMock.mockImplementationOnce(async () => {
      tribulationState.lastOutcome = STUB_SUCCESS_OUTCOME;
      return null;
    });
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-attempt-button"]').trigger('click');
    await flushPromises();
    expect(
      toastPushMock.mock.calls.some(([arg]) => (arg as { type: string }).type === 'success'),
    ).toBe(true);
    expect(fetchStateMock).toHaveBeenCalled();
  });

  it('attempt fail outcome (server accepted, simulate fail) → toast.warning + fetchState', async () => {
    attemptMock.mockImplementationOnce(async () => {
      tribulationState.lastOutcome = STUB_FAIL_OUTCOME;
      return null;
    });
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-attempt-button"]').trigger('click');
    await flushPromises();
    expect(
      toastPushMock.mock.calls.some(([arg]) => (arg as { type: string }).type === 'warning'),
    ).toBe(true);
    expect(fetchStateMock).toHaveBeenCalled();
  });

  it('attempt server reject (NOT_AT_PEAK) → toast.error', async () => {
    attemptMock.mockResolvedValueOnce('NOT_AT_PEAK');
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-attempt-button"]').trigger('click');
    await flushPromises();
    expect(
      toastPushMock.mock.calls.some(([arg]) => (arg as { type: string }).type === 'error'),
    ).toBe(true);
  });

  it('attempt unknown error code → fallback UNKNOWN toast', async () => {
    attemptMock.mockResolvedValueOnce('SOME_UNMAPPED_CODE');
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-attempt-button"]').trigger('click');
    await flushPromises();
    const errorToasts = toastPushMock.mock.calls.filter(
      ([arg]) => (arg as { type: string }).type === 'error',
    );
    expect(errorToasts.length).toBeGreaterThan(0);
    expect((errorToasts[0]?.[0] as { text: string }).text).toBe('Lỗi');
  });
});

describe('TribulationView — last outcome banner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('render success banner với reward detail khi lastOutcome.success=true', async () => {
    tribulationState.lastOutcome = STUB_SUCCESS_OUTCOME;
    const w = mountView();
    await flushPromises();
    const banner = w.find('[data-testid="tribulation-last-outcome"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Vượt kiếp thành công');
    expect(w.find('[data-testid="tribulation-outcome-reward"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-outcome-penalty"]').exists()).toBe(false);
  });

  it('render fail banner với penalty detail khi lastOutcome.success=false', async () => {
    tribulationState.lastOutcome = STUB_FAIL_OUTCOME;
    const w = mountView();
    await flushPromises();
    const banner = w.find('[data-testid="tribulation-last-outcome"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Thất bại');
    expect(w.find('[data-testid="tribulation-outcome-penalty"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-outcome-reward"]').exists()).toBe(false);
  });

  it('click dismiss button → clearLastOutcome called', async () => {
    tribulationState.lastOutcome = STUB_SUCCESS_OUTCOME;
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="tribulation-outcome-dismiss"]').trigger('click');
    expect(clearLastOutcomeMock).toHaveBeenCalled();
  });
});

describe('TribulationView — Phase 11.6.E cooldown + Tâm Ma', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('cooldown banner KHÔNG render khi tribulationCooldownAt=null', async () => {
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: null,
      taoMaUntil: null,
    };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-cooldown-banner"]').exists()).toBe(false);
    expect(w.find('[data-testid="tribulation-taoma-banner"]').exists()).toBe(false);
  });

  it('cooldown banner KHÔNG render khi cooldown đã hết hạn (timestamp quá khứ)', async () => {
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: '2000-01-01T00:00:00.000Z',
    };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-cooldown-banner"]').exists()).toBe(false);
  });

  it('cooldown banner render với countdown khi cooldown còn hiệu lực', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: future,
    };
    const w = mountView();
    await flushPromises();
    const banner = w.find('[data-testid="tribulation-cooldown-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('cooldown');
    const remaining = w.find('[data-testid="tribulation-cooldown-remaining"]');
    expect(remaining.exists()).toBe(true);
    expect(remaining.text()).toMatch(/\d+:\d{2}/);
  });

  it('attempt button DISABLE + label countdown khi cooldown active', async () => {
    const future = new Date(Date.now() + 90_000).toISOString();
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: future,
    };
    const w = mountView();
    await flushPromises();
    const btn = w.find('[data-testid="tribulation-attempt-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('disabled')).toBeDefined();
    // Label hiển thị remaining countdown chứ không phải "Vượt kiếp"
    expect(btn.text()).toMatch(/Chờ\s+\d+:\d{2}/);
  });

  it('Tâm Ma banner render khi taoMaUntil còn hiệu lực', async () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      taoMaUntil: future,
    };
    const w = mountView();
    await flushPromises();
    const banner = w.find('[data-testid="tribulation-taoma-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Tâm Ma');
    const remaining = w.find('[data-testid="tribulation-taoma-remaining"]');
    expect(remaining.exists()).toBe(true);
    expect(remaining.text()).toMatch(/\d+:\d{2}/);
  });

  it('Tâm Ma banner KHÔNG render khi taoMaUntil đã hết hạn', async () => {
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      taoMaUntil: '2000-01-01T00:00:00.000Z',
    };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-taoma-banner"]').exists()).toBe(false);
  });

  it('Tâm Ma có thể active song song với cooldown', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: future,
      taoMaUntil: future,
    };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="tribulation-cooldown-banner"]').exists()).toBe(true);
    expect(w.find('[data-testid="tribulation-taoma-banner"]').exists()).toBe(true);
  });

  it('cooldown countdown format >1h dùng h:mm:ss', async () => {
    const future = new Date(Date.now() + (3600 + 65) * 1000).toISOString();
    gameState.character = {
      realmKey: 'kim_dan',
      realmStage: 9,
      tribulationCooldownAt: future,
    };
    const w = mountView();
    await flushPromises();
    const remaining = w.find('[data-testid="tribulation-cooldown-remaining"]');
    expect(remaining.text()).toMatch(/\d+:\d{2}:\d{2}/);
  });
});
