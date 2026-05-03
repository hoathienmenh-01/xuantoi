import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (k: string) => k,
    },
  },
}));

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: getMock,
    post: postMock,
  },
}));

import {
  craftAlchemyRecipe,
  getAlchemyRecipes,
  upgradeAlchemyFurnace,
} from '@/api/alchemy';

const STUB_RECIPE = {
  key: 'recipe_tieu_phuc_dan',
  name: 'Tiểu Phục Đan',
  description: 'Đan dược nhập môn',
  outputItem: 'tieu_phuc_dan',
  outputQty: 1,
  outputQuality: 'PHAM' as const,
  inputs: [{ itemKey: 'linh_thao_pham', qty: 3 }],
  furnaceLevel: 1,
  realmRequirement: null,
  linhThachCost: 50,
  successRate: 0.8,
};

describe('api/alchemy — Phase 11.11.D client', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('getAlchemyRecipes: GET /character/alchemy/recipes, parse envelope', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
            furnaceLevel: 2,
            recipes: [STUB_RECIPE],
            nextUpgrade: {
              toLevel: 3,
              linhThachCost: 2_000,
              realmRequirement: 'truc_co',
            },
          },
        },
      },
    });
    const out = await getAlchemyRecipes();
    expect(getMock).toHaveBeenCalledWith('/character/alchemy/recipes');
    expect(out.furnaceLevel).toBe(2);
    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0].key).toBe('recipe_tieu_phuc_dan');
    expect(out.nextUpgrade).toEqual({
      toLevel: 3,
      linhThachCost: 2_000,
      realmRequirement: 'truc_co',
    });
  });

  it('getAlchemyRecipes: nextUpgrade=null khi furnace ở MAX_LEVEL', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
            furnaceLevel: 9,
            recipes: [STUB_RECIPE],
            nextUpgrade: null,
          },
        },
      },
    });
    const out = await getAlchemyRecipes();
    expect(out.furnaceLevel).toBe(9);
    expect(out.nextUpgrade).toBeNull();
  });

  it('getAlchemyRecipes: server error envelope → throws error object preserving code', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'NO_CHARACTER', message: 'no char' },
      },
    });
    await expect(getAlchemyRecipes()).rejects.toMatchObject({
      code: 'NO_CHARACTER',
    });
  });

  it('getAlchemyRecipes: empty data → throws fallback error', async () => {
    getMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(getAlchemyRecipes()).rejects.toBeInstanceOf(Error);
  });

  it('craftAlchemyRecipe: POST /character/alchemy/craft body { recipeKey }', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
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
          },
        },
      },
    });
    const out = await craftAlchemyRecipe('recipe_tieu_phuc_dan');
    expect(postMock).toHaveBeenCalledWith('/character/alchemy/craft', {
      recipeKey: 'recipe_tieu_phuc_dan',
    });
    expect(out.outcome.success).toBe(true);
    expect(out.outcome.outputQty).toBe(1);
    expect(out.outcome.linhThachConsumed).toBe(50);
    expect(out.furnaceLevel).toBe(1);
  });

  it('craftAlchemyRecipe: ok=false → throws error object preserving code', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'INSUFFICIENT_INGREDIENTS', message: 'no herbs' },
      },
    });
    await expect(
      craftAlchemyRecipe('recipe_tieu_phuc_dan'),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_INGREDIENTS',
    });
  });

  it('craftAlchemyRecipe: fail outcome (server roll fail) → returns outcome.success=false, không throw', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
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
          },
        },
      },
    });
    const out = await craftAlchemyRecipe('recipe_tieu_phuc_dan');
    expect(out.outcome.success).toBe(false);
    expect(out.outcome.outputItem).toBeNull();
    expect(out.outcome.outputQty).toBe(0);
    expect(out.outcome.linhThachConsumed).toBe(50);
  });

  it('upgradeAlchemyFurnace: POST /character/alchemy/upgrade-furnace empty body', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
            furnaceLevel: 2,
            outcome: { fromLevel: 1, toLevel: 2, linhThachConsumed: 500 },
            nextUpgrade: {
              toLevel: 3,
              linhThachCost: 2_000,
              realmRequirement: 'truc_co',
            },
          },
        },
      },
    });
    const out = await upgradeAlchemyFurnace();
    expect(postMock).toHaveBeenCalledWith(
      '/character/alchemy/upgrade-furnace',
      {},
    );
    expect(out.furnaceLevel).toBe(2);
    expect(out.outcome).toEqual({
      fromLevel: 1,
      toLevel: 2,
      linhThachConsumed: 500,
    });
    expect(out.nextUpgrade?.toLevel).toBe(3);
  });

  it('upgradeAlchemyFurnace: ok=false → throws error preserving code', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'INSUFFICIENT_FUNDS', message: 'no funds' },
      },
    });
    await expect(upgradeAlchemyFurnace()).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });
  });

  it('upgradeAlchemyFurnace: empty data → throws fallback error', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(upgradeAlchemyFurnace()).rejects.toBeInstanceOf(Error);
  });

  it('upgradeAlchemyFurnace: nextUpgrade=null khi vừa đạt MAX_LEVEL', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          alchemy: {
            furnaceLevel: 9,
            outcome: { fromLevel: 8, toLevel: 9, linhThachConsumed: 800_000 },
            nextUpgrade: null,
          },
        },
      },
    });
    const out = await upgradeAlchemyFurnace();
    expect(out.furnaceLevel).toBe(9);
    expect(out.nextUpgrade).toBeNull();
  });
});
