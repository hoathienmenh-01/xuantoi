import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const getNextActionsMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock('@/api/nextAction', () => ({
  getNextActions: (...a: unknown[]) => getNextActionsMock(...a),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

import NextActionPanel from '@/components/NextActionPanel.vue';
import type { NextAction } from '@/api/nextAction';

const ACTION_BREAKTHROUGH: NextAction = {
  key: 'BREAKTHROUGH_READY',
  priority: 1,
  params: {},
  route: '/cultivate',
};
const ACTION_MISSION_3: NextAction = {
  key: 'MISSION_CLAIMABLE',
  priority: 2,
  params: { count: 3 },
  route: '/missions',
};
const ACTION_BOSS: NextAction = {
  key: 'BOSS_ACTIVE',
  priority: 4,
  params: { name: 'Hắc Long', level: 5 },
  route: '/boss',
};

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: {
    vi: {
      home: {
        nextAction: {
          title: 'Đạo Lộ Gợi Ý',
          loading: 'Đang xét vận trình…',
          go: 'Đi ngay',
          items: {
            BREAKTHROUGH_READY: 'Linh khí đã đầy! Sẵn sàng đột phá.',
            MISSION_CLAIMABLE: 'Có {count} nhiệm vụ chờ nhận thưởng.',
            BOSS_ACTIVE: 'Boss đang xuất thế: {name} Lv.{level}.',
          },
        },
      },
    },
  },
});

function mountPanel() {
  return mount(NextActionPanel, {
    global: {
      plugins: [i18n],
    },
  });
}

describe('NextActionPanel', () => {
  beforeEach(() => {
    getNextActionsMock.mockReset();
    routerPushMock.mockReset();
  });

  it('section ẩn khi không có actions và không loading (sau resolve)', async () => {
    getNextActionsMock.mockResolvedValueOnce([]);
    const w = mountPanel();
    await flushPromises();
    expect(w.find('section').exists()).toBe(false);
  });

  it('render danh sách actions với label đã dịch + interpolation params', async () => {
    getNextActionsMock.mockResolvedValueOnce([
      ACTION_BREAKTHROUGH,
      ACTION_MISSION_3,
      ACTION_BOSS,
    ]);
    const w = mountPanel();
    await flushPromises();
    expect(w.find('section').exists()).toBe(true);
    expect(w.find('h3').text()).toBe('Đạo Lộ Gợi Ý');
    const items = w.findAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].text()).toContain('Linh khí đã đầy');
    expect(items[1].text()).toContain('Có 3 nhiệm vụ chờ nhận thưởng');
    expect(items[2].text()).toContain('Hắc Long');
    expect(items[2].text()).toContain('Lv.5');
  });

  it('priority class: p<=1 rose, p<=3 amber, p>3 ink (mặc định)', async () => {
    getNextActionsMock.mockResolvedValueOnce([
      ACTION_BREAKTHROUGH, // p=1
      ACTION_MISSION_3, // p=2
      ACTION_BOSS, // p=4
    ]);
    const w = mountPanel();
    await flushPromises();
    const items = w.findAll('li');
    expect(items[0].classes().some((c) => c.includes('rose-500'))).toBe(true);
    expect(items[1].classes().some((c) => c.includes('amber-500'))).toBe(true);
    expect(items[2].classes().some((c) => c.includes('ink-300'))).toBe(true);
    expect(items[2].classes().some((c) => c.includes('rose-500'))).toBe(false);
  });

  it('click button "Đi ngay" gọi router.push với route action tương ứng', async () => {
    getNextActionsMock.mockResolvedValueOnce([ACTION_MISSION_3]);
    const w = mountPanel();
    await flushPromises();
    await w.find('li button').trigger('click');
    expect(routerPushMock).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith('/missions');
  });

  it('API reject → actions = [] (silent), section ẩn', async () => {
    getNextActionsMock.mockRejectedValueOnce(new Error('network down'));
    const w = mountPanel();
    await flushPromises();
    expect(w.find('section').exists()).toBe(false);
  });

  it('refresh() expose call lại API và update list', async () => {
    getNextActionsMock.mockResolvedValueOnce([ACTION_MISSION_3]);
    const w = mountPanel();
    await flushPromises();
    expect(w.findAll('li')).toHaveLength(1);

    getNextActionsMock.mockResolvedValueOnce([ACTION_BREAKTHROUGH, ACTION_MISSION_3]);
    await (w.vm as unknown as { refresh: () => Promise<void> }).refresh();
    await flushPromises();
    expect(w.findAll('li')).toHaveLength(2);
    expect(getNextActionsMock).toHaveBeenCalledTimes(2);
  });
});
