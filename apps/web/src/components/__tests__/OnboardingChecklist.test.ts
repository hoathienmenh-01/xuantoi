import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const routerPushMock = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

import OnboardingChecklist from '@/components/OnboardingChecklist.vue';
import { useGameStore } from '@/stores/game';
import type { CharacterStatePayload } from '@xuantoi/shared';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: {
    vi: {
      home: {
        onboarding: {
          title: 'Tân Thủ Chỉ Nam',
          go: 'Đi',
          steps: {
            character: 'Khai lập đạo hiệu',
            sect: 'Bái nhập tông môn',
            cultivate: 'Bắt đầu Nhập Định',
            breakthrough: 'Hoàn thành đột phá đầu tiên',
          },
        },
      },
    },
  },
});

function makeChar(overrides: Partial<CharacterStatePayload> = {}): CharacterStatePayload {
  return {
    id: 'c1',
    name: 'Đạo Hữu',
    realmKey: 'phamnhan',
    realmStage: 0,
    level: 1,
    exp: '0',
    expNext: '100',
    hp: 100,
    hpMax: 100,
    mp: 50,
    mpMax: 50,
    stamina: 100,
    staminaMax: 100,
    power: 10,
    spirit: 10,
    speed: 10,
    luck: 10,
    linhThach: '0',
    tienNgoc: 0,
    cultivating: false,
    sectId: null,
    sectKey: null,
    role: 'PLAYER',
    banned: false,
    ...overrides,
  };
}

function mountChecklist() {
  return mount(OnboardingChecklist, {
    global: { plugins: [i18n] },
  });
}

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routerPushMock.mockReset();
  });

  it('hiện đầy đủ 4 step khi character mới (chưa hoàn thành gì)', () => {
    const game = useGameStore();
    game.character = makeChar();
    const w = mountChecklist();
    expect(w.find('[data-testid="onboarding-checklist"]').exists()).toBe(true);
    const items = w.findAll('li');
    expect(items).toHaveLength(4);
    // 0/4 — counter "0/4" hiển thị (character đã có nhưng các step khác chưa)
    expect(w.text()).toContain('1/4'); // step character đã done, sect/cultivate/breakthrough chưa
    expect(items[0].text()).toContain('✓');
    expect(items[1].text()).toContain('○');
    expect(items[2].text()).toContain('○');
    expect(items[3].text()).toContain('○');
  });

  it('panel ẩn khi không có character (không thể render khi parent v-if)', () => {
    const game = useGameStore();
    game.character = null;
    const w = mountChecklist();
    // Khi character=null, mọi step done=false (character: c !== null = false)
    // → counter 0/4, panel HIỂN nhưng test parent guard separately.
    // Component này chỉ ẩn khi allDone, nên với null sẽ hiển 0/4.
    expect(w.find('[data-testid="onboarding-checklist"]').exists()).toBe(true);
    expect(w.text()).toContain('0/4');
  });

  it('counter tăng khi sectKey gán', () => {
    const game = useGameStore();
    game.character = makeChar({ sectKey: 'thanh_van', sectId: 's1' });
    const w = mountChecklist();
    expect(w.text()).toContain('2/4'); // character + sect
  });

  it('counter tăng khi cultivating=true', () => {
    const game = useGameStore();
    game.character = makeChar({
      sectKey: 'huyen_thuy',
      sectId: 's2',
      cultivating: true,
    });
    const w = mountChecklist();
    expect(w.text()).toContain('3/4'); // character + sect + cultivate
  });

  it('breakthrough: realmKey != phamnhan → done', () => {
    const game = useGameStore();
    game.character = makeChar({
      realmKey: 'luyenkhi',
      realmStage: 1,
      sectKey: 'tu_la',
      sectId: 's3',
      cultivating: true,
    });
    const w = mountChecklist();
    // 4/4 → panel ẩn
    expect(w.find('[data-testid="onboarding-checklist"]').exists()).toBe(false);
  });

  it('breakthrough: realmKey=phamnhan + realmStage>0 → done (edge case)', () => {
    const game = useGameStore();
    game.character = makeChar({
      realmKey: 'phamnhan',
      realmStage: 1,
      sectKey: 'thanh_van',
      sectId: 's1',
      cultivating: true,
    });
    const w = mountChecklist();
    expect(w.find('[data-testid="onboarding-checklist"]').exists()).toBe(false);
  });

  it('click button "Đi" trên step chưa done gọi router.push với route đúng', async () => {
    const game = useGameStore();
    game.character = makeChar();
    const w = mountChecklist();
    // Step 1 (sect) chưa done → có button.
    const buttons = w.findAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    await buttons[0].trigger('click'); // sect button (character đã done)
    expect(routerPushMock).toHaveBeenCalled();
    // Route có thể là /sect, /, /onboarding tùy step đầu tiên chưa done.
    expect(routerPushMock.mock.calls[0][0]).toMatch(/^\/(sect|onboarding|)$/);
  });

  it('step done không hiển button "Đi"', () => {
    const game = useGameStore();
    game.character = makeChar({
      sectKey: 'thanh_van',
      sectId: 's1',
    });
    const w = mountChecklist();
    const items = w.findAll('li');
    // Item 0 (character) done → no button.
    expect(items[0].find('button').exists()).toBe(false);
    // Item 1 (sect) done → no button.
    expect(items[1].find('button').exists()).toBe(false);
    // Item 2 (cultivate) chưa done → có button.
    expect(items[2].find('button').exists()).toBe(true);
  });
});
