import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.11.D — Alchemy (Luyện Đan) API client.
 *
 * Wire `GET /character/alchemy/recipes` + `POST /character/alchemy/craft`
 * (Phase 11.11.C server endpoints, PR #319) cho Pinia `useAlchemyStore` + UI
 * `AlchemyView.vue` (Luyện Đan tab).
 *
 * Server-authoritative: client chỉ gửi `recipeKey`, server resolve character +
 * RNG + ItemLedger + CurrencyLedger nguyên tử qua `prisma.$transaction`.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

export interface AlchemyRecipeIngredient {
  itemKey: string;
  qty: number;
}

export interface AlchemyRecipeView {
  key: string;
  name: string;
  description: string;
  outputItem: string;
  outputQty: number;
  outputQuality: 'PHAM' | 'LINH' | 'HUYEN' | 'TIEN' | 'THAN';
  inputs: AlchemyRecipeIngredient[];
  furnaceLevel: number;
  realmRequirement: string | null;
  linhThachCost: number;
  successRate: number;
}

export interface AlchemyState {
  furnaceLevel: number;
  recipes: AlchemyRecipeView[];
}

export interface AlchemyOutcomeView {
  recipeKey: string;
  success: boolean;
  rollValue: number;
  outputItem: string | null;
  outputQty: number;
  linhThachConsumed: number;
  inputsConsumed: AlchemyRecipeIngredient[];
}

export interface AlchemyCraftResult {
  furnaceLevel: number;
  outcome: AlchemyOutcomeView;
}

export async function getAlchemyRecipes(): Promise<AlchemyState> {
  const { data } =
    await apiClient.get<Envelope<{ alchemy: AlchemyState }>>(
      '/character/alchemy/recipes',
    );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('alchemyState');
  return data.data.alchemy;
}

export async function craftAlchemyRecipe(
  recipeKey: string,
): Promise<AlchemyCraftResult> {
  const { data } = await apiClient.post<Envelope<{ alchemy: AlchemyCraftResult }>>(
    '/character/alchemy/craft',
    { recipeKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('alchemyCraft');
  return data.data.alchemy;
}
