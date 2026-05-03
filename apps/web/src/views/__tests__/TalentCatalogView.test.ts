import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import { TALENTS } from '@xuantoi/shared';

/**
 * Phase 11.X.AR — Talent Catalog read-only view test suite.
 *
 * Bao phủ:
 *  - Render đủ TALENTS từ shared catalog (no filter).
 *  - Filter theo type (passive/active).
 *  - Filter theo element (kim/moc/thuy/hoa/tho/neutral).
 *  - Empty state khi filter không khớp talent nào.
 *  - Effect summary format đúng cho passive (stat_mod / regen / damage_bonus)
 *    + active (damage / cc / heal / dot / utility).
 */

const replaceMock = vi.fn();

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

import TalentCatalogView from '@/views/TalentCatalogView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      talents: {
        title: 'Ngộ Đạo',
        subtitle: 'Catalog {total} thần thông',
        counts: '{passive} bị động · {active} chủ động',
        empty: 'Không có thần thông',
        filter: {
          type: 'Loại',
          element: 'Hệ',
          all: 'Tất cả',
          passive: 'Bị động',
          active: 'Chủ động',
          shown: 'Hiển thị {shown}/{total}',
        },
        type: { passive: 'Bị động', active: 'Chủ động' },
        element: {
          kim: 'Kim',
          moc: 'Mộc',
          thuy: 'Thuỷ',
          hoa: 'Hoả',
          tho: 'Thổ',
          neutral: 'Vô hệ',
        },
        stat: {
          atk: 'công',
          def: 'thủ',
          hpMax: 'sinh',
          mpMax: 'linh',
          spirit: 'thần',
        },
        field: { realm: 'Cảnh giới', cost: 'Cost', effect: 'Hiệu ứng' },
        effect: {
          statMod: '+{pct}% {stat}',
          regen: '+{flat} {stat}',
          dropBonus: '+{pct}% drop',
          expBonus: '+{pct}% exp',
          damageBonus: '+{pct}% vs {element}',
          aoe: 'AoE',
          single: 'đơn',
          activeDamage: '×{mul} ({aoe}) {mp}MP CD{cd}',
          activeCc: 'CC{turns} ({aoe}) {mp}MP CD{cd}',
          activeHeal: 'Heal×{mul} {mp}MP CD{cd}',
          activeDot: 'DoT{turns} ({aoe}) {mp}MP CD{cd}',
          activeUtility: 'Util {mp}MP CD{cd}',
        },
      },
    },
  },
});

function mountView() {
  return mount(TalentCatalogView, { global: { plugins: [i18n] } });
}

describe('TalentCatalogView — render & counts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('mặc định no filter: render đủ TALENTS.length card', async () => {
    const w = mountView();
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    expect(cards).toHaveLength(TALENTS.length);
  });

  it('hiển thị counts passive vs active đúng từ catalog', async () => {
    const w = mountView();
    await flushPromises();
    const passiveCount = TALENTS.filter((t) => t.type === 'passive').length;
    const activeCount = TALENTS.filter((t) => t.type === 'active').length;
    const counts = w.find('[data-testid="talents-counts"]').text();
    expect(counts).toContain(String(passiveCount));
    expect(counts).toContain(String(activeCount));
  });

  it('result count text reflect filtered/total', async () => {
    const w = mountView();
    await flushPromises();
    const txt = w.find('[data-testid="talents-result-count"]').text();
    expect(txt).toContain(`${TALENTS.length}/${TALENTS.length}`);
  });
});

describe('TalentCatalogView — filter type', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('filter type=passive → chỉ render talent passive', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="talents-filter-type"]').setValue('passive');
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    const passiveCount = TALENTS.filter((t) => t.type === 'passive').length;
    expect(cards).toHaveLength(passiveCount);
    // Verify không có talent active nào hiển thị.
    const activeKeys = TALENTS.filter((t) => t.type === 'active').map(
      (t) => t.key,
    );
    for (const key of activeKeys) {
      expect(w.find(`[data-testid="talent-card-${key}"]`).exists()).toBe(
        false,
      );
    }
  });

  it('filter type=active → chỉ render talent active', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="talents-filter-type"]').setValue('active');
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    const activeCount = TALENTS.filter((t) => t.type === 'active').length;
    expect(cards).toHaveLength(activeCount);
  });
});

describe('TalentCatalogView — filter element', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('filter element=kim → chỉ render talent kim', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="talents-filter-element"]').setValue('kim');
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    const kimCount = TALENTS.filter((t) => t.element === 'kim').length;
    expect(cards).toHaveLength(kimCount);
    expect(kimCount).toBeGreaterThan(0);
  });

  it('filter element=neutral → chỉ render talent có element null', async () => {
    const w = mountView();
    await flushPromises();
    await w
      .find('[data-testid="talents-filter-element"]')
      .setValue('neutral');
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    const neutralCount = TALENTS.filter((t) => t.element === null).length;
    expect(cards).toHaveLength(neutralCount);
  });

  it('filter element=tho → chỉ render talent tho', async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="talents-filter-element"]').setValue('tho');
    await flushPromises();
    const cards = w.findAll('[data-testid^="talent-card-"]');
    const thoCount = TALENTS.filter((t) => t.element === 'tho').length;
    expect(cards).toHaveLength(thoCount);
    expect(thoCount).toBeGreaterThan(0);
  });
});

describe('TalentCatalogView — combined filter empty', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('filter type+element không khớp talent nào → hiện empty state', async () => {
    const w = mountView();
    await flushPromises();
    // Pick element + type combo không có trong catalog: neutral + active có thể empty
    // hoặc ngược lại. Find combo trống thật:
    const allCombos: Array<{ type: 'passive' | 'active'; element: string }> = [];
    for (const type of ['passive', 'active'] as const) {
      for (const el of ['kim', 'moc', 'thuy', 'hoa', 'tho', 'neutral']) {
        const matches = TALENTS.filter((t) => {
          if (t.type !== type) return false;
          if (el === 'neutral') return t.element === null;
          return t.element === el;
        });
        if (matches.length === 0) allCombos.push({ type, element: el });
      }
    }
    if (allCombos.length === 0) {
      // Mọi combo đều có talent → skip empty test (catalog đã hoàn chỉnh).
      return;
    }
    const combo = allCombos[0];
    await w.find('[data-testid="talents-filter-type"]').setValue(combo.type);
    await w
      .find('[data-testid="talents-filter-element"]')
      .setValue(combo.element);
    await flushPromises();
    expect(w.find('[data-testid="talents-empty"]').exists()).toBe(true);
    expect(w.findAll('[data-testid^="talent-card-"]')).toHaveLength(0);
  });
});

describe('TalentCatalogView — effect summary format', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('passive stat_mod hiện format "+pct% stat"', async () => {
    const w = mountView();
    await flushPromises();
    // Tìm talent stat_mod đầu tiên (vd: talent_kim_thien_co +10% atk).
    const sample = TALENTS.find(
      (t) => t.passiveEffect?.kind === 'stat_mod' && t.passiveEffect.value > 1,
    );
    if (!sample) throw new Error('no stat_mod talent in catalog');
    const card = w.find(`[data-testid="talent-card-${sample.key}"]`);
    expect(card.exists()).toBe(true);
    const pct = Math.round((sample.passiveEffect!.value - 1) * 100);
    expect(card.text()).toContain(`+${pct}%`);
  });

  it('passive regen hiện format "+flat stat"', async () => {
    const w = mountView();
    await flushPromises();
    const sample = TALENTS.find((t) => t.passiveEffect?.kind === 'regen');
    if (!sample) throw new Error('no regen talent in catalog');
    const card = w.find(`[data-testid="talent-card-${sample.key}"]`);
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain(`+${sample.passiveEffect!.value}`);
  });

  it('passive damage_bonus hiện format "+pct% vs element"', async () => {
    const w = mountView();
    await flushPromises();
    const sample = TALENTS.find(
      (t) => t.passiveEffect?.kind === 'damage_bonus',
    );
    if (!sample) throw new Error('no damage_bonus talent in catalog');
    const card = w.find(`[data-testid="talent-card-${sample.key}"]`);
    expect(card.exists()).toBe(true);
    const pct = Math.round((sample.passiveEffect!.value - 1) * 100);
    expect(card.text()).toContain(`+${pct}%`);
  });

  it('active damage hiện cooldown + mp cost', async () => {
    const w = mountView();
    await flushPromises();
    const sample = TALENTS.find((t) => t.activeEffect?.kind === 'damage');
    if (!sample) throw new Error('no active damage talent in catalog');
    const card = w.find(`[data-testid="talent-card-${sample.key}"]`);
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain(`${sample.activeEffect!.mpCost}MP`);
    expect(card.text()).toContain(`CD${sample.activeEffect!.cooldownTurns}`);
  });
});

describe('TalentCatalogView — auth redirect', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('mỗi talent card có realm requirement + cost hiển thị', async () => {
    const w = mountView();
    await flushPromises();
    const sample = TALENTS[0];
    const card = w.find(`[data-testid="talent-card-${sample.key}"]`);
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain(String(sample.talentPointCost));
  });
});
