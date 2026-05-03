import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

/**
 * Phase 11.11.D — AlchemyView test suite.
 *
 * Bao phủ:
 *  - Loading state khi store chưa loaded.
 *  - Render đầy đủ recipes từ store sau khi loaded.
 *  - Filter theo quality (PHAM/LINH/HUYEN/TIEN/THAN).
 *  - Empty state khi filter không khớp.
 *  - Furnace level header text reflect store.furnaceLevel.
 *  - Click craft → store.craft called.
 *  - Toast success khi outcome.success=true.
 *  - Toast warning khi outcome.success=false (fail outcome).
 *  - Toast error khi server reject (errCode).
 *  - Craft button disabled khi inFlight.
 */

const replaceMock = vi.fn();
const craftMock = vi.fn();
const fetchStateMock = vi.fn().mockResolvedValue(undefined);
const toastPushMock = vi.fn();

interface AlchemyOutcomeStub {
  recipeKey: string;
  success: boolean;
  rollValue: number;
  outputItem: string | null;
  outputQty: number;
  linhThachConsumed: number;
  inputsConsumed: { itemKey: string; qty: number }[];
}

interface AlchemyRecipeStub {
  key: string;
  name: string;
  description: string;
  outputItem: string;
  outputQty: number;
  outputQuality: 'PHAM' | 'LINH' | 'HUYEN' | 'TIEN' | 'THAN';
  inputs: { itemKey: string; qty: number }[];
  furnaceLevel: number;
  realmRequirement: string | null;
  linhThachCost: number;
  successRate: number;
}

const STUB_RECIPES: AlchemyRecipeStub[] = [
  {
    key: 'recipe_tieu_phuc_dan',
    name: 'Tiểu Phục Đan',
    description: 'Đan dược nhập môn',
    outputItem: 'tieu_phuc_dan',
    outputQty: 1,
    outputQuality: 'PHAM',
    inputs: [{ itemKey: 'linh_thao_pham', qty: 3 }],
    furnaceLevel: 1,
    realmRequirement: null,
    linhThachCost: 50,
    successRate: 0.8,
  },
  {
    key: 'recipe_linh_dan',
    name: 'Linh Đan',
    description: 'Linh phẩm trung cấp',
    outputItem: 'linh_dan',
    outputQty: 1,
    outputQuality: 'LINH',
    inputs: [{ itemKey: 'linh_thao_linh', qty: 5 }],
    furnaceLevel: 2,
    realmRequirement: 'truc_co',
    linhThachCost: 200,
    successRate: 0.6,
  },
];

interface AlchemyStoreStub {
  furnaceLevel: number;
  recipes: AlchemyRecipeStub[];
  loaded: boolean;
  inFlight: Set<string>;
  lastOutcome: AlchemyOutcomeStub | null;
  fetchState: typeof fetchStateMock;
  craft: typeof craftMock;
  isCrafting: (k: string) => boolean;
  reset: () => void;
}

const alchemyState: AlchemyStoreStub = {
  furnaceLevel: 1,
  recipes: STUB_RECIPES,
  loaded: true,
  inFlight: new Set<string>(),
  lastOutcome: null,
  fetchState: fetchStateMock,
  craft: craftMock,
  isCrafting: (k: string) => alchemyState.inFlight.has(k),
  reset: vi.fn(),
};

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
    character: { realmKey: 'truc_co' },
  }),
}));
vi.mock('@/stores/alchemy', () => ({
  useAlchemyStore: () => alchemyState,
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

import AlchemyView from '@/views/AlchemyView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      alchemy: {
        title: 'Luyện Đan',
        subtitle: 'sub',
        loading: 'Đang tải',
        empty: 'Trống',
        furnaceLevel: 'Lò cấp {level}',
        furnaceReq: 'Cần lò {level}',
        filter: {
          quality: 'Phẩm',
          all: 'Tất cả',
          shown: 'Hiển thị {shown}/{total}',
        },
        quality: {
          PHAM: 'Phàm',
          LINH: 'Linh',
          HUYEN: 'Huyền',
          TIEN: 'Tiên',
          THAN: 'Thần',
        },
        field: {
          output: 'Output',
          inputs: 'Inputs',
          cost: 'Cost',
          linhThach: 'LT',
          successRate: 'Rate',
        },
        button: {
          craft: 'Luyện',
          crafting: 'Đang luyện',
        },
        craft: {
          success: 'Luyện {name} × {qty}',
          fail: 'Thất bại {name}',
          errors: {
            INSUFFICIENT_INGREDIENTS: 'Thiếu nguyên liệu',
            FURNACE_LEVEL_TOO_LOW: 'Lò thấp',
            UNKNOWN: 'Lỗi',
          },
        },
      },
    },
  },
});

function mountView() {
  return mount(AlchemyView, { global: { plugins: [i18n] } });
}

function resetState() {
  alchemyState.furnaceLevel = 1;
  alchemyState.recipes = STUB_RECIPES;
  alchemyState.loaded = true;
  alchemyState.inFlight = new Set();
  alchemyState.lastOutcome = null;
  craftMock.mockReset();
  fetchStateMock.mockReset();
  fetchStateMock.mockResolvedValue(undefined);
  toastPushMock.mockClear();
}

describe('AlchemyView — render & loading', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('hiển thị loading khi store.loaded=false', async () => {
    alchemyState.loaded = false;
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="alchemy-loading"]').exists()).toBe(true);
    expect(w.find('[data-testid="alchemy-list"]').exists()).toBe(false);
  });

  it('render đủ recipes sau khi loaded', async () => {
    const w = mountView();
    await flushPromises();
    const cards = w.findAll('[data-testid^="alchemy-card-"]');
    expect(cards).toHaveLength(STUB_RECIPES.length);
  });

  it('hiển thị furnace level từ store', async () => {
    alchemyState.furnaceLevel = 3;
    const w = mountView();
    await flushPromises();
    const txt = w.find('[data-testid="alchemy-furnace-level"]').text();
    expect(txt).toContain('3');
  });

  it('result count text reflect filtered/total', async () => {
    const w = mountView();
    await flushPromises();
    const txt = w.find('[data-testid="alchemy-result-count"]').text();
    expect(txt).toContain(`${STUB_RECIPES.length}/${STUB_RECIPES.length}`);
  });
});

describe('AlchemyView — filter quality', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('filter quality=PHAM → chỉ render recipe PHAM', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="alchemy-filter-quality"]').setValue('PHAM');
    await flushPromises();
    const cards = w.findAll('[data-testid^="alchemy-card-"]');
    const phamCount = STUB_RECIPES.filter((r) => r.outputQuality === 'PHAM')
      .length;
    expect(cards).toHaveLength(phamCount);
    expect(w.find('[data-testid="alchemy-card-recipe_tieu_phuc_dan"]').exists())
      .toBe(true);
    expect(w.find('[data-testid="alchemy-card-recipe_linh_dan"]').exists())
      .toBe(false);
  });

  it('filter quality=THAN với store stub không có THAN → empty state', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="alchemy-filter-quality"]').setValue('THAN');
    await flushPromises();
    expect(w.find('[data-testid="alchemy-empty"]').exists()).toBe(true);
    expect(w.find('[data-testid="alchemy-list"]').exists()).toBe(false);
  });

  it('filter quality=all → render đủ', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="alchemy-filter-quality"]').setValue('PHAM');
    await flushPromises();
    await w.find('[data-testid="alchemy-filter-quality"]').setValue('all');
    await flushPromises();
    const cards = w.findAll('[data-testid^="alchemy-card-"]');
    expect(cards).toHaveLength(STUB_RECIPES.length);
  });
});

describe('AlchemyView — recipe card content', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('hiển thị output item + qty', async () => {
    const w = mountView();
    await flushPromises();
    const out = w.find('[data-testid="alchemy-output-recipe_tieu_phuc_dan"]')
      .text();
    expect(out).toContain('tieu_phuc_dan');
    expect(out).toContain('1');
  });

  it('hiển thị inputs list', async () => {
    const w = mountView();
    await flushPromises();
    const ins = w.find('[data-testid="alchemy-inputs-recipe_tieu_phuc_dan"]')
      .text();
    expect(ins).toContain('linh_thao_pham');
    expect(ins).toContain('3');
  });

  it('hiển thị cost (linh thạch) + success rate %', async () => {
    const w = mountView();
    await flushPromises();
    const cost = w
      .find('[data-testid="alchemy-cost-recipe_tieu_phuc_dan"]')
      .text();
    expect(cost).toContain('50');
    const rate = w
      .find('[data-testid="alchemy-rate-recipe_tieu_phuc_dan"]')
      .text();
    expect(rate).toContain('80');
  });

  it('hiển thị furnace requirement badge', async () => {
    const w = mountView();
    await flushPromises();
    const badge = w
      .find('[data-testid="alchemy-furnace-recipe_linh_dan"]')
      .text();
    expect(badge).toContain('2');
  });
});

describe('AlchemyView — craft button & toast', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetState();
  });

  it('click Luyện → gọi store.craft', async () => {
    craftMock.mockImplementationOnce(async () => {
      alchemyState.lastOutcome = {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.4,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      };
      return null;
    });
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]')
      .trigger('click');
    await flushPromises();
    expect(craftMock).toHaveBeenCalledWith('recipe_tieu_phuc_dan');
  });

  it('craft success outcome → toast success', async () => {
    craftMock.mockImplementationOnce(async () => {
      alchemyState.lastOutcome = {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.4,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      };
      return null;
    });
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]')
      .trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text: expect.stringContaining('Tiểu Phục Đan'),
      }),
    );
  });

  it('craft fail outcome (RNG fail) → toast warning', async () => {
    craftMock.mockImplementationOnce(async () => {
      alchemyState.lastOutcome = {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: false,
        rollValue: 0.95,
        outputItem: null,
        outputQty: 0,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      };
      return null;
    });
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]')
      .trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        text: expect.stringContaining('Thất bại'),
      }),
    );
  });

  it('craft server error → toast error với i18n key đúng', async () => {
    craftMock.mockResolvedValueOnce('INSUFFICIENT_INGREDIENTS');
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]')
      .trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Thiếu nguyên liệu',
      }),
    );
  });

  it('craft unknown error code → toast error fallback UNKNOWN', async () => {
    craftMock.mockResolvedValueOnce('SOME_NEW_CODE');
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]')
      .trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Lỗi',
      }),
    );
  });

  it('craft button disabled khi inFlight', async () => {
    alchemyState.inFlight = new Set(['recipe_tieu_phuc_dan']);
    const w = mountView();
    await flushPromises();
    const btn = w.find('[data-testid="alchemy-craft-recipe_tieu_phuc_dan"]');
    expect(btn.attributes('disabled')).toBeDefined();
    expect(btn.text()).toBe('Đang luyện');
  });
});
