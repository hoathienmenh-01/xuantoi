import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import type { InventoryView } from '@/api/inventory';
import type { ItemDef } from '@xuantoi/shared';

/**
 * InventoryView smoke tests (session 9j task C / K3.2): cover onMounted
 * routing, render gear + unequipped list, equip/unequip/use flow (success
 * + toast + cập nhật list từ response; error map inventory.errors.<code>
 * / fallback UNKNOWN; submitting guard chống double-click gọi duplicate
 * API — quan trọng vì equip/use đụng ItemLedger economy safety).
 */

const listInventoryMock = vi.fn();
const equipItemMock = vi.fn();
const unequipItemMock = vi.fn();
const useItemMock = vi.fn();

vi.mock('@/api/inventory', async () => {
  const actual = await vi.importActual<typeof import('@/api/inventory')>(
    '@/api/inventory',
  );
  return {
    ...actual,
    listInventory: (...a: unknown[]) => listInventoryMock(...a),
    equipItem: (...a: unknown[]) => equipItemMock(...a),
    unequipItem: (...a: unknown[]) => unequipItemMock(...a),
    useItem: (...a: unknown[]) => useItemMock(...a),
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

import InventoryViewComponent from '@/views/InventoryView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      inventory: {
        title: 'Túi Đồ',
        gearTitle: 'Trang Bị',
        empty: 'Trống',
        emptyAll: 'Túi đồ trống.',
        equip: 'Trang bị',
        takeOff: 'Tháo',
        use: 'Dùng',
        loadFailToast: 'Không tải được túi đồ.',
        equipToast: 'Đã trang bị {name}.',
        unequipToast: 'Đã tháo {slot}.',
        useToast: 'Đã dùng {name}.',
        bonus: {
          atk: 'ATK +{v}',
          def: 'DEF +{v}',
          hpMax: 'HP Max +{v}',
          mpMax: 'MP Max +{v}',
          spirit: 'Thần +{v}',
        },
        errors: {
          NOT_OWNER: 'Không sở hữu vật phẩm.',
          UNKNOWN: 'Có lỗi xảy ra.',
        },
      },
      equipSlot: {
        WEAPON: 'Vũ Khí',
        ARMOR: 'Áo Giáp',
        HELMET: 'Nón',
        BOOTS: 'Giày',
        RING: 'Nhẫn',
        AMULET: 'Bùa',
        ARTIFACT_1: 'Pháp Bảo 1',
        ARTIFACT_2: 'Pháp Bảo 2',
        ARTIFACT_3: 'Pháp Bảo 3',
      },
      quality: {
        PHAM: 'Phàm',
        LINH: 'Linh',
        HUYEN: 'Huyền',
        TIEN: 'Tiên',
        THANH: 'Thánh',
      },
    },
  },
});

function makeItemDef(over: Partial<ItemDef> = {}): ItemDef {
  return {
    key: 'so_kiem',
    name: 'Sơ Kiếm',
    description: 'Một thanh kiếm thô sơ.',
    kind: 'WEAPON',
    quality: 'PHAM',
    stackable: false,
    slot: 'WEAPON',
    bonuses: { atk: 5 },
    price: 10,
    ...over,
  };
}

function makeInv(over: Partial<InventoryView> = {}): InventoryView {
  return {
    id: 'i_1',
    itemKey: 'so_kiem',
    qty: 1,
    equippedSlot: null,
    item: makeItemDef(),
    ...over,
  };
}

function mountView() {
  return mount(InventoryViewComponent, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  listInventoryMock.mockReset();
  equipItemMock.mockReset();
  unequipItemMock.mockReset();
  useItemMock.mockReset();
  routerReplaceMock.mockReset();
  toastPushMock.mockReset();
  authState.isAuthenticated = true;
  authState.hydrate.mockReset();
  authState.hydrate.mockResolvedValue(undefined);
  gameState.bindSocket.mockReset();
  gameState.fetchState.mockReset();
  gameState.fetchState.mockResolvedValue(undefined);
});

describe('InventoryView — onMounted routing', () => {
  it('chưa auth → router.replace(/auth) + không gọi listInventory', async () => {
    authState.isAuthenticated = false;
    mountView();
    await flushPromises();
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(listInventoryMock).not.toHaveBeenCalled();
  });

  it('có auth → fetchState + bindSocket + listInventory', async () => {
    listInventoryMock.mockResolvedValue([]);
    mountView();
    await flushPromises();
    expect(gameState.fetchState).toHaveBeenCalled();
    expect(gameState.bindSocket).toHaveBeenCalled();
    expect(listInventoryMock).toHaveBeenCalledTimes(1);
  });

  it('listInventory fail → toast inventory.loadFailToast', async () => {
    listInventoryMock.mockRejectedValue(new Error('net'));
    const w = mountView();
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Không tải được túi đồ.',
    });
    expect(w.text()).toContain('Túi Đồ');
  });
});

describe('InventoryView — render gear + unequipped', () => {
  it('render slot empty label khi chưa trang bị', async () => {
    listInventoryMock.mockResolvedValue([]);
    const w = mountView();
    await flushPromises();
    // Tất cả slot đều empty.
    const emptyCount = w.text().match(/Trống/g)?.length ?? 0;
    expect(emptyCount).toBeGreaterThanOrEqual(9); // 9 slot
    expect(w.text()).toContain('Túi đồ trống.');
  });

  it('render trang bị đã equipped + nút Tháo', async () => {
    listInventoryMock.mockResolvedValue([
      makeInv({ id: 'i_weapon', equippedSlot: 'WEAPON' }),
    ]);
    const w = mountView();
    await flushPromises();
    // Tên vũ khí hiển thị.
    expect(w.text()).toContain('Sơ Kiếm');
    // Nút Tháo có.
    const takeOffBtn = w.findAll('button').find((b) => b.text().includes('Tháo'));
    expect(takeOffBtn).toBeDefined();
  });

  it('render item chưa đeo với nút Trang bị (vì có slot) + bonus text', async () => {
    listInventoryMock.mockResolvedValue([
      makeInv({
        id: 'i_bag',
        equippedSlot: null,
        item: makeItemDef({ bonuses: { atk: 10, def: 3 } }),
      }),
    ]);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('ATK +10');
    expect(w.text()).toContain('DEF +3');
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    expect(equipBtn).toBeDefined();
  });

  it('render item effect (đan dược) với nút Dùng', async () => {
    listInventoryMock.mockResolvedValue([
      makeInv({
        id: 'i_pill',
        itemKey: 'pill_hp',
        equippedSlot: null,
        item: makeItemDef({
          key: 'pill_hp',
          name: 'Hồi HP Đan',
          kind: 'PILL_HP',
          slot: undefined,
          bonuses: undefined,
          effect: { hp: 50 },
        }),
      }),
    ]);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Hồi HP Đan');
    expect(w.text()).toContain('+50 HP');
    const useBtn = w.findAll('button').find((b) => b.text().includes('Dùng'));
    expect(useBtn).toBeDefined();
    // Không có nút Trang bị vì không có slot.
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    expect(equipBtn).toBeUndefined();
  });
});

describe('InventoryView — equip flow', () => {
  it('click Trang bị → equipItem + toast success + list cập nhật', async () => {
    const before = makeInv({ id: 'i_w', equippedSlot: null });
    const after = { ...before, equippedSlot: 'WEAPON' as const };
    listInventoryMock.mockResolvedValue([before]);
    equipItemMock.mockResolvedValue([after]);

    const w = mountView();
    await flushPromises();

    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    await equipBtn!.trigger('click');
    await flushPromises();

    expect(equipItemMock).toHaveBeenCalledWith('i_w');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã trang bị Sơ Kiếm.',
    });
    // Sau equip: item chuyển sang gear slot, nút Tháo xuất hiện.
    const takeOffBtn = w.findAll('button').find((b) => b.text().includes('Tháo'));
    expect(takeOffBtn).toBeDefined();
  });

  it('equip error NOT_OWNER → map inventory.errors.NOT_OWNER', async () => {
    listInventoryMock.mockResolvedValue([makeInv({ id: 'i_w' })]);
    equipItemMock.mockRejectedValue(
      Object.assign(new Error('no'), { code: 'NOT_OWNER' }),
    );

    const w = mountView();
    await flushPromises();
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    await equipBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Không sở hữu vật phẩm.',
    });
  });

  it('equip error code lạ → fallback inventory.errors.UNKNOWN', async () => {
    listInventoryMock.mockResolvedValue([makeInv({ id: 'i_w' })]);
    equipItemMock.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'WEIRD' }),
    );

    const w = mountView();
    await flushPromises();
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    await equipBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
  });

  it('submitting guard: click lần 2 trong khi equip pending → chỉ gọi 1 lần', async () => {
    listInventoryMock.mockResolvedValue([makeInv({ id: 'i_w' })]);
    const resolveHolder: {
      current: ((v: InventoryView[]) => void) | null;
    } = { current: null };
    equipItemMock.mockImplementation(
      () =>
        new Promise<InventoryView[]>((resolve) => {
          resolveHolder.current = resolve;
        }),
    );

    const w = mountView();
    await flushPromises();
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    await equipBtn!.trigger('click');
    await flushPromises();
    await equipBtn!.trigger('click');
    await flushPromises();

    expect(equipItemMock).toHaveBeenCalledTimes(1);

    resolveHolder.current?.([
      { ...makeInv({ id: 'i_w' }), equippedSlot: 'WEAPON' },
    ]);
    await flushPromises();
  });
});

describe('InventoryView — unequip flow', () => {
  it('click Tháo → unequipItem(slot) + toast unequip + list cập nhật', async () => {
    listInventoryMock.mockResolvedValue([
      makeInv({ id: 'i_w', equippedSlot: 'WEAPON' }),
    ]);
    unequipItemMock.mockResolvedValue([makeInv({ id: 'i_w', equippedSlot: null })]);

    const w = mountView();
    await flushPromises();
    const takeOffBtn = w.findAll('button').find((b) => b.text().includes('Tháo'));
    await takeOffBtn!.trigger('click');
    await flushPromises();

    expect(unequipItemMock).toHaveBeenCalledWith('WEAPON');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'system',
      text: 'Đã tháo Vũ Khí.',
    });
    // Sau unequip: nút Trang bị xuất hiện.
    const equipBtn = w.findAll('button').find((b) => b.text().includes('Trang bị'));
    expect(equipBtn).toBeDefined();
  });

  it('unequip error → toast fallback UNKNOWN', async () => {
    listInventoryMock.mockResolvedValue([
      makeInv({ id: 'i_w', equippedSlot: 'WEAPON' }),
    ]);
    unequipItemMock.mockRejectedValue(
      Object.assign(new Error('fail'), { code: 'X' }),
    );

    const w = mountView();
    await flushPromises();
    const takeOffBtn = w.findAll('button').find((b) => b.text().includes('Tháo'));
    await takeOffBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
  });
});

describe('InventoryView — use flow', () => {
  it('click Dùng → useItem + toast success + list cập nhật (qty giảm)', async () => {
    const pill = makeInv({
      id: 'i_pill',
      itemKey: 'pill_hp',
      qty: 3,
      item: makeItemDef({
        key: 'pill_hp',
        name: 'Hồi HP Đan',
        kind: 'PILL_HP',
        slot: undefined,
        bonuses: undefined,
        effect: { hp: 50 },
      }),
    });
    const afterUse = { ...pill, qty: 2 };
    listInventoryMock.mockResolvedValue([pill]);
    useItemMock.mockResolvedValue([afterUse]);

    const w = mountView();
    await flushPromises();
    const useBtn = w.findAll('button').find((b) => b.text().includes('Dùng'));
    await useBtn!.trigger('click');
    await flushPromises();

    expect(useItemMock).toHaveBeenCalledWith('i_pill');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã dùng Hồi HP Đan.',
    });
    expect(w.text()).toContain('×2');
  });

  it('use error → toast map inventory.errors.NOT_OWNER', async () => {
    const pill = makeInv({
      id: 'i_pill',
      itemKey: 'pill_hp',
      item: makeItemDef({
        key: 'pill_hp',
        name: 'Hồi HP Đan',
        kind: 'PILL_HP',
        slot: undefined,
        bonuses: undefined,
        effect: { hp: 50 },
      }),
    });
    listInventoryMock.mockResolvedValue([pill]);
    useItemMock.mockRejectedValue(
      Object.assign(new Error('no'), { code: 'NOT_OWNER' }),
    );

    const w = mountView();
    await flushPromises();
    const useBtn = w.findAll('button').find((b) => b.text().includes('Dùng'));
    await useBtn!.trigger('click');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Không sở hữu vật phẩm.',
    });
  });
});
