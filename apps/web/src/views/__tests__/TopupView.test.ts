import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import type { TopupOrderView } from '@/api/topup';

/**
 * TopupView smoke tests (session 9j task B / K3): cover các nhánh onMounted
 * (chưa auth → /auth, có auth → fetchState + bindSocket + parallel fetch
 * getTopupCatalog + getMyTopups), render packages/history, buy flow
 * (success: toast + prepend order + lastOrder block; error: handleErr map
 * topup.errors.<code> hoặc fallback UNKNOWN), submitting guard.
 *
 * Pattern: mock @/api/topup, vue-router, 3 stores, AppShell stub. Giữ scope
 * nhỏ — không mock @/components/ui/MButton (real component render).
 */

const getTopupCatalogMock = vi.fn();
const getMyTopupsMock = vi.fn();
const createTopupOrderMock = vi.fn();

vi.mock('@/api/topup', async () => {
  const actual = await vi.importActual<typeof import('@/api/topup')>('@/api/topup');
  return {
    ...actual,
    getTopupCatalog: (...a: unknown[]) => getTopupCatalogMock(...a),
    getMyTopups: (...a: unknown[]) => getMyTopupsMock(...a),
    createTopupOrder: (...a: unknown[]) => createTopupOrderMock(...a),
  };
});

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
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

const gameState = {
  bindSocket: vi.fn(),
  fetchState: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/game', () => ({
  useGameStore: () => gameState,
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

import TopupView from '@/views/TopupView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      topup: {
        title: 'Nạp Tiên Ngọc',
        intro: 'Chuyển khoản ngân hàng để nạp Tiên Ngọc.',
        rule1: 'Ghi đúng mã chuyển khoản.',
        rule2: 'Admin sẽ duyệt trong ~15 phút.',
        packages: 'Gói nạp',
        tienNgoc: 'Tiên Ngọc',
        buy: 'Nạp',
        lastOrderTitle: 'Đơn nạp mới',
        transferCode: 'Mã chuyển khoản:',
        amount: '{price} → {ngoc} Tiên Ngọc',
        bankLine: '{bank} — {name} — {number}',
        history: 'Lịch sử nạp',
        noOrders: 'Chưa có đơn nạp nào.',
        orderCreatedToast: 'Đã tạo đơn {code}.',
        col: {
          code: 'Mã',
          package: 'Gói',
          price: 'Giá',
          tienNgoc: 'Tiên Ngọc',
          status: 'Trạng thái',
          createdAt: 'Thời gian',
          note: 'Ghi chú',
        },
        status: {
          PENDING: 'Chờ duyệt',
          APPROVED: 'Đã duyệt',
          REJECTED: 'Từ chối',
        },
        errors: {
          PACKAGE_NOT_FOUND: 'Gói nạp không tồn tại.',
          UNKNOWN: 'Có lỗi xảy ra.',
        },
      },
    },
  },
});

function makeOrder(over: Partial<TopupOrderView> = {}): TopupOrderView {
  return {
    id: 'o_1',
    packageKey: 'p_small',
    packageName: 'Gói Tiểu',
    tienNgocAmount: 100,
    priceVND: 20000,
    transferCode: 'XT-ABC',
    status: 'PENDING',
    note: '',
    createdAt: '2026-04-30T07:00:00.000Z',
    approvedAt: null,
    approvedByEmail: null,
    ...over,
  };
}

function mountView() {
  return mount(TopupView, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  getTopupCatalogMock.mockReset();
  getMyTopupsMock.mockReset();
  createTopupOrderMock.mockReset();
  routerReplaceMock.mockReset();
  toastPushMock.mockReset();
  authState.isAuthenticated = true;
  authState.hydrate.mockReset();
  authState.hydrate.mockResolvedValue(undefined);
  gameState.bindSocket.mockReset();
  gameState.fetchState.mockReset();
  gameState.fetchState.mockResolvedValue(undefined);
});

describe('TopupView — onMounted routing', () => {
  it('chưa auth → router.replace(/auth) + không gọi API', async () => {
    authState.isAuthenticated = false;
    mountView();
    await flushPromises();
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(getTopupCatalogMock).not.toHaveBeenCalled();
    expect(getMyTopupsMock).not.toHaveBeenCalled();
  });

  it('có auth → fetchState + bindSocket + gọi catalog + getMyTopups', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_small',
          name: 'Gói Tiểu',
          priceVND: 20000,
          tienNgoc: 100,
          bonus: 0,
          description: 'Gói nhỏ',
          hot: false,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'Xuân Tôi', accountNumber: '0123', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);

    mountView();
    await flushPromises();

    expect(gameState.fetchState).toHaveBeenCalled();
    expect(gameState.bindSocket).toHaveBeenCalled();
    expect(getTopupCatalogMock).toHaveBeenCalledTimes(1);
    expect(getMyTopupsMock).toHaveBeenCalledTimes(1);
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});

describe('TopupView — packages + history render', () => {
  it('render tên + giá + HOT badge cho package hot', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_hot',
          name: 'Gói Hot',
          priceVND: 100000,
          tienNgoc: 500,
          bonus: 50,
          description: 'Hot deal',
          hot: true,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain('Gói Hot');
    expect(w.text()).toContain('100.000 ₫');
    expect(w.text()).toContain('HOT');
  });

  it('render empty state khi chưa có đơn nạp', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain('Chưa có đơn nạp nào.');
  });

  it('render lịch sử với status pill (PENDING/APPROVED/REJECTED)', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([
      makeOrder({ id: 'o_pend', transferCode: 'P-1', status: 'PENDING' }),
      makeOrder({ id: 'o_appr', transferCode: 'P-2', status: 'APPROVED' }),
      makeOrder({ id: 'o_rej', transferCode: 'P-3', status: 'REJECTED' }),
    ]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain('Chờ duyệt');
    expect(w.text()).toContain('Đã duyệt');
    expect(w.text()).toContain('Từ chối');
    expect(w.text()).toContain('P-1');
    expect(w.text()).toContain('P-2');
    expect(w.text()).toContain('P-3');
  });
});

describe('TopupView — buy flow', () => {
  it('click Nạp → createTopupOrder + toast success + prepend order + lastOrder section', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_small',
          name: 'Gói Tiểu',
          priceVND: 20000,
          tienNgoc: 100,
          bonus: 0,
          description: '',
          hot: false,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);
    const newOrder = makeOrder({ id: 'o_new', transferCode: 'XT-NEW', status: 'PENDING' });
    createTopupOrderMock.mockResolvedValue(newOrder);

    const w = mountView();
    await flushPromises();

    const buyBtn = w.findAll('button').find((b) => b.text().includes('Nạp'));
    expect(buyBtn).toBeDefined();
    await buyBtn!.trigger('click');
    await flushPromises();

    expect(createTopupOrderMock).toHaveBeenCalledWith('p_small');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã tạo đơn XT-NEW.',
    });
    // History cập nhật: mã mới xuất hiện trong bảng.
    expect(w.text()).toContain('XT-NEW');
    // lastOrder section visible
    expect(w.text()).toContain('Đơn nạp mới');
  });

  it('buy error → handleErr map topup.errors.<code> (PACKAGE_NOT_FOUND)', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_small',
          name: 'Gói Tiểu',
          priceVND: 20000,
          tienNgoc: 100,
          bonus: 0,
          description: '',
          hot: false,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);
    createTopupOrderMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'PACKAGE_NOT_FOUND' }),
    );

    const w = mountView();
    await flushPromises();
    const buyBtn = w.findAll('button').find((b) => b.text().includes('Nạp'));
    await buyBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Gói nạp không tồn tại.',
    });
  });

  it('buy error code lạ → fallback topup.errors.UNKNOWN', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_small',
          name: 'Gói Tiểu',
          priceVND: 20000,
          tienNgoc: 100,
          bonus: 0,
          description: '',
          hot: false,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);
    createTopupOrderMock.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'SOME_UNKNOWN_CODE' }),
    );

    const w = mountView();
    await flushPromises();
    const buyBtn = w.findAll('button').find((b) => b.text().includes('Nạp'));
    await buyBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
  });

  it('submitting guard: trong khi chờ pending, click lần 2 không trigger thêm call', async () => {
    getTopupCatalogMock.mockResolvedValue({
      packages: [
        {
          key: 'p_small',
          name: 'Gói Tiểu',
          priceVND: 20000,
          tienNgoc: 100,
          bonus: 0,
          description: '',
          hot: false,
        },
      ],
      bank: { bankName: 'VCB', accountName: 'X', accountNumber: '1', noteHint: '' },
    });
    getMyTopupsMock.mockResolvedValue([]);
    const resolveHolder: { current: ((v: TopupOrderView) => void) | null } = { current: null };
    createTopupOrderMock.mockImplementation(
      () =>
        new Promise<TopupOrderView>((resolve) => {
          resolveHolder.current = resolve;
        }),
    );

    const w = mountView();
    await flushPromises();
    const buyBtn = w.findAll('button').find((b) => b.text().includes('Nạp'));
    await buyBtn!.trigger('click');
    await flushPromises();
    await buyBtn!.trigger('click');
    await flushPromises();

    expect(createTopupOrderMock).toHaveBeenCalledTimes(1);

    resolveHolder.current?.(makeOrder({ id: 'o_x', transferCode: 'XT-X' }));
    await flushPromises();
  });
});

describe('TopupView — catalog load error', () => {
  it('catalog fetch fail → handleErr (toast UNKNOWN), không crash render', async () => {
    getTopupCatalogMock.mockRejectedValue(
      Object.assign(new Error('fail'), { code: 'BOOM' }),
    );
    getMyTopupsMock.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
    // View vẫn render header.
    expect(w.text()).toContain('Nạp Tiên Ngọc');
  });
});
