import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const fetchMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('@/api/logs', () => ({
  fetchLogsMe: (...a: unknown[]) => fetchMock(...a),
}));

// Stub stores: auth.hydrate / isAuthenticated; game.fetchState / bindSocket.
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    hydrate: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: true,
  }),
}));
vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    fetchState: vi.fn().mockResolvedValue(undefined),
    bindSocket: vi.fn(),
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

import ActivityView from '@/views/ActivityView.vue';
import type {
  LogEntry,
  LogEntryCurrency,
  LogEntryItem,
  LogsListResult,
} from '@/api/logs';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: {
    vi: {
      common: { loading: 'Đang tải…' },
      activity: {
        title: 'Sổ Hoạt Động',
        subtitle: 'Lịch sử…',
        tabs: { currency: 'Linh Thạch / Tiên Ngọc', item: 'Linh Bảo' },
        loading: 'Đang tra cứu…',
        loadMore: 'Xem thêm',
        loadingMore: 'Đang tải thêm…',
        empty: 'Chưa có giao dịch nào trong sổ.',
        noCharacter: 'Chưa nhập đạo.',
        errors: {
          UNAUTHENTICATED: 'Phiên hết hạn',
          NO_CHARACTER: 'Chưa có nhân vật',
          INVALID_CURSOR: 'Cursor lỗi',
          UNKNOWN: 'Không truy vấn được sổ.',
        },
        currencyLabel: { LINH_THACH: 'Linh Thạch', TIEN_NGOC: 'Tiên Ngọc' },
        reasons: {
          MISSION_REWARD: 'Nhận thưởng nhiệm vụ',
          ADMIN_GRANT: 'Admin tặng',
          MARKET_BUY: 'Mua phường thị',
        },
      },
    },
  },
});

function curr(overrides: Partial<LogEntryCurrency> = {}): LogEntryCurrency {
  return {
    kind: 'CURRENCY',
    id: 'c1',
    createdAt: '2025-04-01T10:00:00.000Z',
    reason: 'MISSION_REWARD',
    refType: null,
    refId: null,
    actorUserId: null,
    currency: 'LINH_THACH',
    delta: '100',
    ...overrides,
  };
}

function item(overrides: Partial<LogEntryItem> = {}): LogEntryItem {
  return {
    kind: 'ITEM',
    id: 'i1',
    createdAt: '2025-04-01T11:00:00.000Z',
    reason: 'ADMIN_GRANT',
    refType: null,
    refId: null,
    actorUserId: null,
    itemKey: 'sword_iron',
    qtyDelta: 1,
    ...overrides,
  };
}

function listResult(
  entries: LogEntry[],
  nextCursor: string | null = null,
): LogsListResult {
  return { entries, nextCursor };
}

function mountView() {
  return mount(ActivityView, { global: { plugins: [i18n] } });
}

describe('ActivityView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    replaceMock.mockReset();
  });

  it('skeleton trong khi fetch tab currency mặc định', async () => {
    let resolveFetch: (r: LogsListResult) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<LogsListResult>((r) => {
        resolveFetch = r;
      }),
    );
    const w = mountView();
    // Đợi auth.hydrate + game.fetchState + load() bắt đầu (set loading=true).
    // fetchMock chưa resolve → skeleton vẫn hiện.
    for (let i = 0; i < 5; i++) await w.vm.$nextTick();
    expect(w.find('[data-testid="activity-skeleton"]').exists()).toBe(true);
    expect(w.find('[data-testid="activity-list"]').exists()).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith({
      type: 'currency',
      limit: 20,
      cursor: null,
    });
    resolveFetch(listResult([]));
    await flushPromises();
    expect(w.find('[data-testid="activity-skeleton"]').exists()).toBe(false);
  });

  it('empty state khi không có entry', async () => {
    fetchMock.mockResolvedValue(listResult([]));
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="activity-empty"]').exists()).toBe(true);
    expect(w.text()).toContain('Chưa có giao dịch nào trong sổ.');
  });

  it('render currency entry với delta dương formatted +N (xanh)', async () => {
    fetchMock.mockResolvedValue(
      listResult([curr({ id: 'c1', delta: '100', reason: 'MISSION_REWARD' })]),
    );
    const w = mountView();
    await flushPromises();
    const delta = w.find('[data-testid="activity-delta-c1"]');
    expect(delta.exists()).toBe(true);
    expect(delta.text()).toBe('+100');
    expect(delta.classes()).toContain('text-emerald-300');
    expect(w.text()).toContain('Nhận thưởng nhiệm vụ');
    expect(w.text()).toContain('Linh Thạch');
  });

  it('render currency entry với delta âm hiển thị nguyên dấu (đỏ)', async () => {
    fetchMock.mockResolvedValue(
      listResult([
        curr({
          id: 'c2',
          delta: '-500',
          reason: 'MARKET_BUY',
          currency: 'TIEN_NGOC',
        }),
      ]),
    );
    const w = mountView();
    await flushPromises();
    const delta = w.find('[data-testid="activity-delta-c2"]');
    expect(delta.text()).toBe('-500');
    expect(delta.classes()).toContain('text-rose-300');
    expect(w.text()).toContain('Tiên Ngọc');
    expect(w.text()).toContain('Mua phường thị');
  });

  it('switch tab item gọi fetchLogsMe với type=item, reset entries', async () => {
    fetchMock
      .mockResolvedValueOnce(listResult([curr({ id: 'c1', delta: '100' })]))
      .mockResolvedValueOnce(
        listResult([item({ id: 'i1', qtyDelta: 1, itemKey: 'sword_iron' })]),
      );
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="activity-row-c1"]').exists()).toBe(true);
    await w.find('[data-testid="activity-tab-item"]').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenLastCalledWith({
      type: 'item',
      limit: 20,
      cursor: null,
    });
    expect(w.find('[data-testid="activity-row-c1"]').exists()).toBe(false);
    expect(w.find('[data-testid="activity-row-i1"]').exists()).toBe(true);
    const delta = w.find('[data-testid="activity-delta-i1"]');
    expect(delta.text()).toBe('+1');
    expect(delta.classes()).toContain('text-emerald-300');
  });

  it('item entry với qtyDelta âm: hiện -N (đỏ) + tên item từ catalog', async () => {
    fetchMock.mockResolvedValue(
      listResult([
        item({
          id: 'i2',
          qtyDelta: -3,
          itemKey: 'sword_iron',
          reason: 'MARKET_BUY',
        }),
      ]),
    );
    const w = mountView();
    await w.find('[data-testid="activity-tab-item"]').trigger('click');
    await flushPromises();
    const delta = w.find('[data-testid="activity-delta-i2"]');
    expect(delta.text()).toBe('-3');
    expect(delta.classes()).toContain('text-rose-300');
  });

  it('load more visible khi có nextCursor; click gọi fetch với cursor và append', async () => {
    fetchMock
      .mockResolvedValueOnce(
        listResult([curr({ id: 'c1', delta: '100' })], 'cursor-page-2'),
      )
      .mockResolvedValueOnce(
        listResult([curr({ id: 'c2', delta: '200' })], null),
      );
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="activity-load-more"]').exists()).toBe(true);
    await w.find('[data-testid="activity-load-more"]').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenNthCalledWith(2, {
      type: 'currency',
      limit: 20,
      cursor: 'cursor-page-2',
    });
    // Both entries present (append, not reset).
    expect(w.find('[data-testid="activity-row-c1"]').exists()).toBe(true);
    expect(w.find('[data-testid="activity-row-c2"]').exists()).toBe(true);
    // No more cursor → load more hidden.
    expect(w.find('[data-testid="activity-load-more"]').exists()).toBe(false);
  });

  it('fetch error code map qua i18n; UNKNOWN fallback', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('NO_CHARACTER'), { code: 'NO_CHARACTER' }),
    );
    const w = mountView();
    await flushPromises();
    const err = w.find('[data-testid="activity-error"]');
    expect(err.exists()).toBe(true);
    expect(err.text()).toContain('Chưa có nhân vật');
  });

  it('error code ngoài bảng map → fallback UNKNOWN', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('SOMETHING'), { code: 'SOMETHING' }),
    );
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="activity-error"]').text()).toContain(
      'Không truy vấn được sổ.',
    );
  });

  it('reason không có trong i18n catalog → fallback raw key (no crash)', async () => {
    fetchMock.mockResolvedValue(
      listResult([curr({ id: 'c9', reason: 'CUSTOM_REASON', delta: '50' })]),
    );
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('CUSTOM_REASON');
  });
});
