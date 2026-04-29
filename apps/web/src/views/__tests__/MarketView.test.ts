import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const listMarketMock = vi.fn();
const listMineMock = vi.fn();
const listInventoryMock = vi.fn();

vi.mock('@/api/market', () => ({
  listMarket: (...a: unknown[]) => listMarketMock(...a),
  listMine: (...a: unknown[]) => listMineMock(...a),
  buyListing: vi.fn(),
  cancelListing: vi.fn(),
  postListing: vi.fn(),
}));

vi.mock('@/api/inventory', () => ({
  listInventory: (...a: unknown[]) => listInventoryMock(...a),
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    hydrate: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    fetchState: vi.fn().mockResolvedValue(undefined),
    bindSocket: vi.fn(),
  }),
}));

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: vi.fn() }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import MarketView from '@/views/MarketView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: { all: 'Tất cả' },
      itemKind: {
        WEAPON: 'Vũ Khí',
        ARMOR: 'Giáp',
        PILL_HP: 'Đan HP',
        PILL_MP: 'Đan MP',
        PILL_EXP: 'Đan EXP',
        ORE: 'Khoáng',
        MISC: 'Khác',
      },
      market: {
        title: 'Phường Thị',
        feeNote: 'Phí {pct}%',
        tab: { buy: 'Mua', sell: 'Bán' },
        filter: 'Lọc',
        noListings: 'Chưa có tin đăng.',
        noMine: 'Chưa đăng tin.',
        myListings: 'Tin của tôi',
        newListingTitle: 'Đăng bán',
        item: 'Vật phẩm',
        chooseItem: 'Chọn vật phẩm',
        qty: 'Số lượng',
        price: 'Giá',
        post: 'Đăng',
        sellerPosted: '{name}',
        perUnit: '{price}/đơn vị',
        buy: 'Mua',
        yours: 'Của bạn',
        takeDown: 'Hạ tin',
        totalLine: 'Tổng {total} {fee}',
        fee: 'phí {fee} → còn {net}',
      },
      quality: {},
      listingStatus: { ACTIVE: 'Đang bán', SOLD: 'Đã bán', CANCELLED: 'Huỷ' },
    },
  },
});

function mountView() {
  return mount(MarketView, {
    global: { plugins: [i18n] },
  });
}

describe('MarketView — skeleton loaders (L5 cont)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listMarketMock.mockReset();
    listMineMock.mockReset();
    listInventoryMock.mockReset();
  });

  it('render market-buy-skeleton khi đang fetch tab Mua', async () => {
    let resolveMarket: (v: { listings: unknown[]; feePct: number }) => void = () => {};
    listMarketMock.mockReturnValue(
      new Promise((r) => {
        resolveMarket = r;
      }),
    );
    listMineMock.mockResolvedValue([]);
    listInventoryMock.mockResolvedValue([]);

    const w = mountView();
    await w.vm.$nextTick();

    expect(w.find('[data-testid="market-buy-skeleton"]').exists()).toBe(true);
    resolveMarket({ listings: [], feePct: 0.05 });
    await flushPromises();
    expect(w.find('[data-testid="market-buy-skeleton"]').exists()).toBe(false);
  });

  it('render market-mine-skeleton khi đang fetch tab Bán', async () => {
    let resolveMine: (v: unknown[]) => void = () => {};
    listMarketMock.mockResolvedValue({ listings: [], feePct: 0.05 });
    listMineMock.mockReturnValue(
      new Promise<unknown[]>((r) => {
        resolveMine = r;
      }),
    );
    listInventoryMock.mockResolvedValue([]);

    const w = mountView();
    await w.vm.$nextTick();

    // Switch to sell tab — skeleton rendered.
    await w.findAll('button').filter((b) => b.text().includes('Bán'))[0].trigger('click');
    await w.vm.$nextTick();
    expect(w.find('[data-testid="market-mine-skeleton"]').exists()).toBe(true);

    resolveMine([]);
    await flushPromises();
    expect(w.find('[data-testid="market-mine-skeleton"]').exists()).toBe(false);
  });

  it('hide skeleton + show empty state khi không có listing', async () => {
    listMarketMock.mockResolvedValue({ listings: [], feePct: 0.05 });
    listMineMock.mockResolvedValue([]);
    listInventoryMock.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(w.find('[data-testid="market-buy-skeleton"]').exists()).toBe(false);
    expect(w.text()).toContain('Chưa có tin đăng');
  });
});
