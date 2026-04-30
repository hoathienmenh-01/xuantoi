import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import type { EncounterView } from '@/api/combat';

/**
 * DungeonView smoke tests (session 9j task H / K3.6): cover auth/unauth
 * routing, dungeon list render, start encounter flow (success + error map +
 * submitting guard), action flow (WON reward toast + LOST warning toast +
 * error submitting guard), abandon flow (success toast + error map), unknown
 * error fallback UNKNOWN.
 *
 * DungeonView đụng **currency reward** (exp + linhThach) qua `performAction`
 * status=WON — regression có thể làm mất reward của người chơi. Thêm test
 * để lock flow xuống.
 */

const listDungeonsMock = vi.fn();
const getActiveEncounterMock = vi.fn();
const startEncounterMock = vi.fn();
const performActionMock = vi.fn();
const abandonEncounterMock = vi.fn();

vi.mock('@/api/combat', async () => {
  const actual = await vi.importActual<typeof import('@/api/combat')>('@/api/combat');
  return {
    ...actual,
    listDungeons: (...a: unknown[]) => listDungeonsMock(...a),
    getActiveEncounter: (...a: unknown[]) => getActiveEncounterMock(...a),
    startEncounter: (...a: unknown[]) => startEncounterMock(...a),
    performAction: (...a: unknown[]) => performActionMock(...a),
    abandonEncounter: (...a: unknown[]) => abandonEncounterMock(...a),
  };
});

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  RouterLink: {
    name: 'RouterLinkStub',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

const authState = {
  isAuthenticated: true,
  hydrate: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}));

const gameState: { character: { sectKey: string; stamina: number } | null } = {
  character: { sectKey: 'thanh_van', stamina: 100 },
};
vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    get character() {
      return gameState.character;
    },
    fetchState: vi.fn().mockResolvedValue(undefined),
    bindSocket: vi.fn(),
  }),
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: { name: 'AppShell', template: '<div><slot /></div>' },
}));

import DungeonViewComponent from '@/views/DungeonView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: { reload: 'Tải lại' },
      dungeon: {
        title: 'Bí cảnh',
        enter: 'Vào',
        inFight: 'Đang chiến',
        monsterCount: '{n} quái',
        staminaEntry: 'Thể lực {stam}',
        startToast: 'Vào {name}',
        rewardToast: 'Thắng: +{exp} EXP, +{linh} linh thạch',
        lostToast: 'Đã bại trận',
        abandonToast: 'Bỏ chạy thành công',
        retreat: 'Bỏ chạy',
        ended: 'Trận đã kết thúc',
        noFight: 'Chưa có trận',
        counter: '{cur} / {total}',
        errors: {
          NO_STAMINA: 'Không đủ thể lực',
          IN_FIGHT: 'Đang trong trận',
          UNKNOWN: 'Lỗi không rõ',
        },
      },
    },
  },
});

function makeDungeon(overrides: Partial<{ key: string; name: string; staminaEntry: number }> = {}) {
  return {
    key: overrides.key ?? 'linh_nguyen',
    name: overrides.name ?? 'Linh Nguyên Đạo Tràng',
    description: 'Nơi tu luyện của tân thủ',
    recommendedRealm: 'luyen_khi_1',
    monsters: [
      { key: 'yeu_thu', name: 'Yêu Thú', hp: 100, atk: 10, def: 5 },
      { key: 'yeu_thu_2', name: 'Yêu Thú 2', hp: 120, atk: 12, def: 6 },
    ],
    staminaEntry: overrides.staminaEntry ?? 10,
  };
}

function makeEncounter(overrides: Partial<EncounterView> = {}): EncounterView {
  const base: EncounterView = {
    id: 'enc1',
    dungeon: makeDungeon() as unknown as EncounterView['dungeon'],
    status: 'ACTIVE',
    monster: {
      key: 'yeu_thu',
      name: 'Yêu Thú',
      hp: 100,
      atk: 10,
      def: 5,
    } as unknown as EncounterView['monster'],
    monsterHp: 100,
    monsterIndex: 0,
    log: [],
    reward: null,
  };
  return { ...base, ...overrides } as EncounterView;
}

function mountView() {
  return mount(DungeonViewComponent, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  listDungeonsMock.mockReset();
  getActiveEncounterMock.mockReset();
  startEncounterMock.mockReset();
  performActionMock.mockReset();
  abandonEncounterMock.mockReset();
  routerReplaceMock.mockReset();
  toastPushMock.mockReset();
  gameState.character = { sectKey: 'thanh_van', stamina: 100 };
  authState.isAuthenticated = true;
  authState.hydrate.mockReset();
  authState.hydrate.mockResolvedValue(undefined);
});

describe('DungeonView — onMounted routing', () => {
  it('unauth → replace /auth + không gọi listDungeons', async () => {
    authState.isAuthenticated = false;
    mountView();
    await flushPromises();
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(listDungeonsMock).not.toHaveBeenCalled();
  });

  it('auth → listDungeons + getActiveEncounter được gọi', async () => {
    listDungeonsMock.mockResolvedValue([makeDungeon()]);
    getActiveEncounterMock.mockResolvedValue(null);
    mountView();
    await flushPromises();
    expect(listDungeonsMock).toHaveBeenCalled();
    expect(getActiveEncounterMock).toHaveBeenCalled();
  });

  it('render dungeon list: hiện name + stamina cost', async () => {
    listDungeonsMock.mockResolvedValue([makeDungeon({ name: 'Test Dungeon', staminaEntry: 15 })]);
    getActiveEncounterMock.mockResolvedValue(null);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Test Dungeon');
    expect(w.text()).toContain('Thể lực 15');
  });
});

describe('DungeonView — start encounter flow', () => {
  beforeEach(() => {
    listDungeonsMock.mockResolvedValue([makeDungeon()]);
    getActiveEncounterMock.mockResolvedValue(null);
  });

  it('success: startEncounter(key) + toast success', async () => {
    startEncounterMock.mockResolvedValue(makeEncounter());
    const w = mountView();
    await flushPromises();
    const enterBtn = w.findAll('button').find((b) => b.text() === 'Vào')!;
    await enterBtn.trigger('click');
    await flushPromises();

    expect(startEncounterMock).toHaveBeenCalledWith('linh_nguyen');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Vào Linh Nguyên Đạo Tràng',
    });
  });

  it('stamina thấp < staminaEntry → button disabled', async () => {
    gameState.character = { sectKey: 'thanh_van', stamina: 5 };
    const w = mountView();
    await flushPromises();
    const enterBtn = w.findAll('button').find((b) => b.text() === 'Vào')!;
    expect(enterBtn.attributes('disabled')).toBeDefined();
  });

  it('error NO_STAMINA → toast dungeon.errors.NO_STAMINA', async () => {
    startEncounterMock.mockRejectedValue(
      Object.assign(new Error('no stamina'), { code: 'NO_STAMINA' }),
    );
    const w = mountView();
    await flushPromises();
    await (w.findAll('button').find((b) => b.text() === 'Vào')!).trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Không đủ thể lực',
    });
  });

  it('error code lạ → fallback dungeon.errors.UNKNOWN', async () => {
    startEncounterMock.mockRejectedValue(
      Object.assign(new Error('weird'), { code: 'MONSTER_RAGE' }),
    );
    const w = mountView();
    await flushPromises();
    await (w.findAll('button').find((b) => b.text() === 'Vào')!).trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Lỗi không rõ',
    });
  });

  it('submitting guard: click lần 2 trong khi pending → chỉ 1 call', async () => {
    const resolveHolder: {
      current: ((v: EncounterView) => void) | null;
    } = { current: null };
    startEncounterMock.mockImplementation(
      () =>
        new Promise<EncounterView>((resolve) => {
          resolveHolder.current = resolve;
        }),
    );
    const w = mountView();
    await flushPromises();
    const enterBtn = w.findAll('button').find((b) => b.text() === 'Vào')!;
    await enterBtn.trigger('click');
    await flushPromises();
    await enterBtn.trigger('click');
    await flushPromises();

    expect(startEncounterMock).toHaveBeenCalledTimes(1);
    resolveHolder.current?.(makeEncounter());
  });
});

describe('DungeonView — action flow (reward safety)', () => {
  beforeEach(() => {
    listDungeonsMock.mockResolvedValue([makeDungeon()]);
    getActiveEncounterMock.mockResolvedValue(makeEncounter({ status: 'ACTIVE' }));
  });

  it('WON → toast system với exp + linhThach (reward safety)', async () => {
    performActionMock.mockResolvedValue(
      makeEncounter({
        status: 'WON',
        reward: { exp: '100', linhThach: '50' },
      }),
    );
    const w = mountView();
    await flushPromises();
    // Click basic attack (first skill button in encounter panel)
    const skillBtns = w.findAll('button').filter((b) =>
      b.text() !== 'Vào' &&
      b.text() !== 'Đang chiến' &&
      b.text() !== 'Tải lại' &&
      b.attributes('disabled') === undefined,
    );
    // Find a skill button (not start/reload button)
    const skillBtn = skillBtns.find((b) => b.text().length > 0 && !b.text().includes('Đang chiến'));
    expect(skillBtn).toBeDefined();
    await skillBtn!.trigger('click');
    await flushPromises();

    expect(performActionMock).toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'system',
      text: 'Thắng: +100 EXP, +50 linh thạch',
    });
  });

  it('LOST → toast warning', async () => {
    performActionMock.mockResolvedValue(
      makeEncounter({ status: 'LOST', reward: null }),
    );
    const w = mountView();
    await flushPromises();
    const skillBtns = w.findAll('button').filter((b) =>
      b.text() !== 'Vào' &&
      b.text() !== 'Đang chiến' &&
      b.text() !== 'Tải lại' &&
      b.attributes('disabled') === undefined,
    );
    const skillBtn = skillBtns.find((b) => b.text().length > 0);
    await skillBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'warning',
      text: 'Đã bại trận',
    });
  });

  it('action error → toast error map', async () => {
    performActionMock.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'IN_FIGHT' }),
    );
    const w = mountView();
    await flushPromises();
    const skillBtns = w.findAll('button').filter((b) =>
      b.text() !== 'Vào' &&
      b.text() !== 'Đang chiến' &&
      b.text() !== 'Tải lại' &&
      b.attributes('disabled') === undefined,
    );
    const skillBtn = skillBtns.find((b) => b.text().length > 0);
    await skillBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Đang trong trận',
    });
  });
});

describe('DungeonView — abandon flow', () => {
  beforeEach(() => {
    listDungeonsMock.mockResolvedValue([makeDungeon()]);
    getActiveEncounterMock.mockResolvedValue(makeEncounter({ status: 'ACTIVE' }));
  });

  it('success: abandonEncounter + toast warning', async () => {
    abandonEncounterMock.mockResolvedValue(
      makeEncounter({ status: 'ABANDONED' }),
    );
    const w = mountView();
    await flushPromises();
    const retreatBtn = w.findAll('button').find((b) => b.text() === 'Bỏ chạy')!;
    expect(retreatBtn).toBeDefined();
    await retreatBtn.trigger('click');
    await flushPromises();

    expect(abandonEncounterMock).toHaveBeenCalledWith('enc1');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'warning',
      text: 'Bỏ chạy thành công',
    });
  });

  it('error → toast error map (abandon flow)', async () => {
    abandonEncounterMock.mockRejectedValue(
      Object.assign(new Error('cant'), { code: 'UNKNOWN' }),
    );
    const w = mountView();
    await flushPromises();
    const retreatBtn = w.findAll('button').find((b) => b.text() === 'Bỏ chạy')!;
    await retreatBtn.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Lỗi không rõ',
    });
  });
});
