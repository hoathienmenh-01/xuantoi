import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const fetchMock = vi.fn();

vi.mock('@/api/leaderboard', () => ({
  fetchLeaderboardPower: (...a: unknown[]) => fetchMock(...a),
}));

// Stub AppShell để test view không kéo theo full shell + websocket setup.
vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

import LeaderboardView from '@/views/LeaderboardView.vue';
import type { LeaderboardRow } from '@/api/leaderboard';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: {
    vi: {
      shell: {
        sect: {
          thanh_van: 'Thanh Vân Môn',
          huyen_thuy: 'Huyền Thuỷ Cung',
          tu_la: 'Tu La Tông',
        },
      },
      leaderboard: {
        title: 'Phong Thần Bảng',
        subtitle: 'Top 50',
        loading: 'Đang truy vấn…',
        error: 'Lỗi.',
        retry: 'Thử lại',
        empty: 'Chưa có đạo hữu nào.',
        col: {
          name: 'Đạo Hiệu',
          realm: 'Cảnh Giới',
          sect: 'Tông Môn',
          power: 'Lực',
        },
      },
    },
  },
});

function makeRow(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank: 1,
    characterId: 'c1',
    name: 'Đạo Hữu',
    realmKey: 'luyenkhi',
    realmStage: 1,
    power: 100,
    level: 1,
    sectKey: null,
    ...overrides,
  };
}

function mountView() {
  return mount(LeaderboardView, {
    global: { plugins: [i18n] },
  });
}

describe('LeaderboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
  });

  it('hiển thị loading state khi đang fetch', async () => {
    let resolveFetch: (rows: LeaderboardRow[]) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<LeaderboardRow[]>((r) => {
        resolveFetch = r;
      }),
    );
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain('Đang truy vấn');
    resolveFetch([]);
    await flushPromises();
  });

  it('empty state khi rows rỗng', async () => {
    fetchMock.mockResolvedValue([]);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Chưa có đạo hữu nào');
    expect(w.find('[data-testid="leaderboard-table"]').exists()).toBe(false);
  });

  it('error state khi fetch throw, click retry gọi lại fetch', async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error('UNKNOWN'), { code: 'UNKNOWN' }))
      .mockResolvedValueOnce([]);
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain('Lỗi.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await w.find('button').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('render table với rows + format realm + sect + power', async () => {
    fetchMock.mockResolvedValue([
      makeRow({
        rank: 1,
        characterId: 'c1',
        name: 'Lý Phi Vũ',
        realmKey: 'kim_dan',
        realmStage: 5,
        power: 12345,
        sectKey: 'thanh_van',
      }),
      makeRow({
        rank: 2,
        characterId: 'c2',
        name: 'Trương Tam',
        realmKey: 'luyenkhi',
        realmStage: 9,
        power: 999,
        sectKey: null,
      }),
    ]);
    const w = mountView();
    await flushPromises();
    const tbl = w.find('[data-testid="leaderboard-table"]');
    expect(tbl.exists()).toBe(true);
    const rows = tbl.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Lý Phi Vũ');
    expect(rows[0].text()).toContain('Kim Đan'); // from realm catalog
    expect(rows[0].text()).toContain('Ngũ Trọng');
    expect(rows[0].text()).toContain('Thanh Vân Môn');
    expect(rows[0].text()).toContain('12,345');
    expect(rows[1].text()).toContain('Trương Tam');
    expect(rows[1].text()).toContain('—'); // sectKey null
  });

  it('rank ≤ 3 highlight, rank > 3 không highlight', async () => {
    fetchMock.mockResolvedValue([
      makeRow({ rank: 1, characterId: 'c1', name: 'Top1' }),
      makeRow({ rank: 4, characterId: 'c4', name: 'Top4' }),
    ]);
    const w = mountView();
    await flushPromises();
    const rows = w.findAll('tbody tr');
    expect(rows[0].html()).toContain('bg-amber-500/20');
    expect(rows[1].html()).not.toContain('bg-amber-500/20');
  });

  it('fetch được gọi với limit=50', async () => {
    fetchMock.mockResolvedValue([]);
    mountView();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(50);
  });
});
