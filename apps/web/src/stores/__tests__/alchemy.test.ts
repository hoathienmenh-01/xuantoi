import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/alchemy', () => ({
  getAlchemyRecipes: vi.fn(),
  craftAlchemyRecipe: vi.fn(),
}));

import * as api from '@/api/alchemy';
import { useAlchemyStore } from '@/stores/alchemy';

const mockedGet = vi.mocked(api.getAlchemyRecipes);
const mockedCraft = vi.mocked(api.craftAlchemyRecipe);

const STUB_RECIPE: api.AlchemyRecipeView = {
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
};

describe('useAlchemyStore — Phase 11.11.D', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initial state: furnaceLevel=1, recipes empty, not loaded, no inFlight, lastOutcome null', () => {
    const s = useAlchemyStore();
    expect(s.furnaceLevel).toBe(1);
    expect(s.recipes).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.inFlight.size).toBe(0);
    expect(s.lastOutcome).toBeNull();
  });

  it('fetchState: hydrate furnaceLevel + recipes + loaded=true', async () => {
    mockedGet.mockResolvedValueOnce({
      furnaceLevel: 2,
      recipes: [STUB_RECIPE],
    });
    const s = useAlchemyStore();
    await s.fetchState();
    expect(s.furnaceLevel).toBe(2);
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].key).toBe('recipe_tieu_phuc_dan');
    expect(s.loaded).toBe(true);
  });

  it('craft success outcome: cập nhật furnaceLevel + lastOutcome.success=true', async () => {
    const s = useAlchemyStore();
    mockedCraft.mockResolvedValueOnce({
      furnaceLevel: 1,
      outcome: {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.42,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      },
    });
    const err = await s.craft('recipe_tieu_phuc_dan');
    expect(err).toBeNull();
    expect(s.lastOutcome?.success).toBe(true);
    expect(s.lastOutcome?.outputQty).toBe(1);
    expect(s.furnaceLevel).toBe(1);
    expect(s.inFlight.has('recipe_tieu_phuc_dan')).toBe(false);
  });

  it('craft fail outcome (server roll fail): vẫn return null, lastOutcome.success=false', async () => {
    const s = useAlchemyStore();
    mockedCraft.mockResolvedValueOnce({
      furnaceLevel: 1,
      outcome: {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: false,
        rollValue: 0.95,
        outputItem: null,
        outputQty: 0,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      },
    });
    const err = await s.craft('recipe_tieu_phuc_dan');
    expect(err).toBeNull();
    expect(s.lastOutcome?.success).toBe(false);
    expect(s.lastOutcome?.outputQty).toBe(0);
  });

  it('craft server error code: trả code, không update lastOutcome', async () => {
    const s = useAlchemyStore();
    mockedCraft.mockRejectedValueOnce({ code: 'INSUFFICIENT_INGREDIENTS' });
    const err = await s.craft('recipe_tieu_phuc_dan');
    expect(err).toBe('INSUFFICIENT_INGREDIENTS');
    expect(s.lastOutcome).toBeNull();
    expect(s.inFlight.has('recipe_tieu_phuc_dan')).toBe(false);
  });

  it('craft nested error.code: extract đúng (axios envelope shape)', async () => {
    const s = useAlchemyStore();
    mockedCraft.mockRejectedValueOnce({
      error: { code: 'FURNACE_LEVEL_TOO_LOW', message: 'low' },
    });
    const err = await s.craft('recipe_tieu_phuc_dan');
    expect(err).toBe('FURNACE_LEVEL_TOO_LOW');
  });

  it('craft unknown error: trả "UNKNOWN"', async () => {
    const s = useAlchemyStore();
    mockedCraft.mockRejectedValueOnce(new Error('boom'));
    const err = await s.craft('recipe_tieu_phuc_dan');
    expect(err).toBe('UNKNOWN');
  });

  it('craft double-call same key → second returns IN_FLIGHT (race protect)', async () => {
    const s = useAlchemyStore();
    let resolveFn!: (v: api.AlchemyCraftResult) => void;
    mockedCraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const p1 = s.craft('recipe_tieu_phuc_dan');
    const r2 = await s.craft('recipe_tieu_phuc_dan');
    expect(r2).toBe('IN_FLIGHT');
    resolveFn({
      furnaceLevel: 1,
      outcome: {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.5,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      },
    });
    await p1;
  });

  it('isCrafting reflect inFlight set during pending craft', async () => {
    const s = useAlchemyStore();
    let resolveFn!: (v: api.AlchemyCraftResult) => void;
    mockedCraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const p = s.craft('recipe_tieu_phuc_dan');
    expect(s.isCrafting('recipe_tieu_phuc_dan')).toBe(true);
    expect(s.isCrafting('other_recipe')).toBe(false);
    resolveFn({
      furnaceLevel: 1,
      outcome: {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.5,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      },
    });
    await p;
    expect(s.isCrafting('recipe_tieu_phuc_dan')).toBe(false);
  });

  it('reset: xoá furnaceLevel back to 1 + recipes empty + loaded=false + lastOutcome null', async () => {
    mockedGet.mockResolvedValueOnce({
      furnaceLevel: 3,
      recipes: [STUB_RECIPE],
    });
    const s = useAlchemyStore();
    await s.fetchState();
    mockedCraft.mockResolvedValueOnce({
      furnaceLevel: 3,
      outcome: {
        recipeKey: 'recipe_tieu_phuc_dan',
        success: true,
        rollValue: 0.42,
        outputItem: 'tieu_phuc_dan',
        outputQty: 1,
        linhThachConsumed: 50,
        inputsConsumed: [{ itemKey: 'linh_thao_pham', qty: 3 }],
      },
    });
    await s.craft('recipe_tieu_phuc_dan');
    expect(s.loaded).toBe(true);
    expect(s.lastOutcome).not.toBeNull();
    s.reset();
    expect(s.furnaceLevel).toBe(1);
    expect(s.recipes).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.lastOutcome).toBeNull();
  });
});
