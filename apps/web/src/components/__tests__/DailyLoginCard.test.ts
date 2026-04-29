import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';

const getStatusMock = vi.fn();
const claimMock = vi.fn();

vi.mock('@/api/dailyLogin', () => ({
  getDailyLoginStatus: (...a: unknown[]) => getStatusMock(...a),
  claimDailyLogin: (...a: unknown[]) => claimMock(...a),
}));

import DailyLoginCard from '@/components/DailyLoginCard.vue';
import { useToastStore } from '@/stores/toast';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: {
    vi: {
      home: {
        dailyLogin: {
          title: 'Quà đăng nhập hôm nay',
          availableHint: '+{amount} linh thạch đang chờ đạo hữu — bấm "Nhận".',
          claimedHint: 'Đã nhận. Chuỗi: {streak} ngày.',
          claim: 'Nhận quà',
          claiming: 'Đang nhận…',
          successToast: 'Đã nhận +{amount} linh thạch (chuỗi {streak} ngày).',
          alreadyClaimedToast: 'Đã nhận hôm nay rồi.',
        },
      },
    },
  },
});

function mountCard() {
  return mount(DailyLoginCard, {
    global: { plugins: [i18n] },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  getStatusMock.mockReset();
  claimMock.mockReset();
});

describe('DailyLoginCard (M9)', () => {
  it('canClaimToday=true → render hint + button', async () => {
    getStatusMock.mockResolvedValue({
      todayDateLocal: '2026-04-29',
      canClaimToday: true,
      currentStreak: 0,
      nextRewardLinhThach: '100',
    });
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.text()).toContain('+100');
    expect(wrapper.find('[data-testid="daily-login-claim-btn"]').exists()).toBe(true);
  });

  it('canClaimToday=false → render claimed hint, no button', async () => {
    getStatusMock.mockResolvedValue({
      todayDateLocal: '2026-04-29',
      canClaimToday: false,
      currentStreak: 5,
      nextRewardLinhThach: '100',
    });
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.text()).toContain('5 ngày');
    expect(wrapper.find('[data-testid="daily-login-claim-btn"]').exists()).toBe(false);
  });

  it('click claim → call API + toast success + reload status', async () => {
    getStatusMock
      .mockResolvedValueOnce({
        todayDateLocal: '2026-04-29',
        canClaimToday: true,
        currentStreak: 0,
        nextRewardLinhThach: '100',
      })
      .mockResolvedValueOnce({
        todayDateLocal: '2026-04-29',
        canClaimToday: false,
        currentStreak: 1,
        nextRewardLinhThach: '100',
      });
    claimMock.mockResolvedValue({
      claimed: true,
      linhThachDelta: '100',
      newStreak: 1,
      claimDateLocal: '2026-04-29',
    });

    const wrapper = mountCard();
    await flushPromises();
    const toast = useToastStore();

    await wrapper.find('[data-testid="daily-login-claim-btn"]').trigger('click');
    await flushPromises();

    expect(claimMock).toHaveBeenCalledTimes(1);
    expect(getStatusMock).toHaveBeenCalledTimes(2); // initial + reload after claim
    expect(toast.toasts.some((t) => t.text.includes('+100'))).toBe(true);
    expect(wrapper.find('[data-testid="daily-login-claim-btn"]').exists()).toBe(false);
  });

  it('claim returns claimed=false (idempotent server-side) → toast alreadyClaimed', async () => {
    getStatusMock.mockResolvedValue({
      todayDateLocal: '2026-04-29',
      canClaimToday: true,
      currentStreak: 0,
      nextRewardLinhThach: '100',
    });
    claimMock.mockResolvedValue({
      claimed: false,
      linhThachDelta: '0',
      newStreak: 1,
      claimDateLocal: '2026-04-29',
    });

    const wrapper = mountCard();
    await flushPromises();
    const toast = useToastStore();

    await wrapper.find('[data-testid="daily-login-claim-btn"]').trigger('click');
    await flushPromises();

    expect(toast.toasts.some((t) => t.text.includes('hôm nay'))).toBe(true);
  });
});
