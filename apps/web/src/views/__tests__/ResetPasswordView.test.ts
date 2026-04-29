import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const resetPasswordMock = vi.fn();
vi.mock('@/api/auth', () => ({
  resetPassword: (...a: unknown[]) => resetPasswordMock(...a),
}));

const routerPushMock = vi.fn();
const routeQuery = { value: {} as Record<string, string | undefined> };
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  useRoute: () => ({
    get query() {
      return routeQuery.value;
    },
  }),
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

import ResetPasswordView from '@/views/ResetPasswordView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      auth: {
        reset: {
          title: 'Đặt Lại Huyền Pháp',
          subtitle: 'Subtitle',
          token: 'Mã Đặt Lại',
          tokenFromUrl: 'Mã đã tự nhập từ đường dẫn email.',
          newPassword: 'Mới',
          confirm: 'Xác Nhận',
          submit: 'Đặt lại',
          success: 'Đã đặt lại.',
          mismatch: 'Không khớp.',
          missingToken: 'Thiếu mã.',
        },
        errors: {
          INVALID_RESET_TOKEN: 'Token không hợp lệ.',
          UNKNOWN: 'Lỗi.',
        },
      },
    },
  },
});

function mountView() {
  return mount(ResetPasswordView, {
    global: {
      plugins: [i18n],
      stubs: { MButton: { template: '<button :disabled="disabled" :data-loading="loading"><slot /></button>', props: ['loading', 'disabled'] } },
    },
  });
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetPasswordMock.mockReset();
    routerPushMock.mockReset();
    toastPushMock.mockReset();
    routeQuery.value = {};
  });

  it('token từ URL query: auto-fill + ẩn input + hiện hint "tokenFromUrl"', async () => {
    routeQuery.value = { token: 'abcdefghijklmnop1234567890' };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reset-token-from-url"]').exists()).toBe(true);
    expect(w.find('[data-testid="reset-token"]').exists()).toBe(false);
  });

  it('không có token query → hiện input cho user paste tay', async () => {
    routeQuery.value = {};
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reset-token"]').exists()).toBe(true);
    expect(w.find('[data-testid="reset-token-from-url"]').exists()).toBe(false);
  });

  it('token query quá ngắn (< 16 ký tự) → ignore, hiện input thay vì auto-fill', async () => {
    routeQuery.value = { token: 'short' };
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reset-token"]').exists()).toBe(true);
    expect(w.find('[data-testid="reset-token-from-url"]').exists()).toBe(false);
  });

  it('submit thành công → toast success + router.push("/auth")', async () => {
    routeQuery.value = { token: 'abcdefghijklmnop1234567890' };
    resetPasswordMock.mockResolvedValueOnce(undefined);
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="reset-new"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-confirm"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: 'abcdefghijklmnop1234567890',
      newPassword: 'NewPass1234',
    });
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'success', text: 'Đã đặt lại.' });
    expect(routerPushMock).toHaveBeenCalledWith('/auth');
  });

  it('mismatch password: hiện lỗi mismatch + không gọi API', async () => {
    routeQuery.value = { token: 'abcdefghijklmnop1234567890' };
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="reset-new"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-confirm"]').setValue('Different5678');
    expect(w.find('[data-testid="reset-mismatch"]').exists()).toBe(true);
    await w.find('[data-testid="reset-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(resetPasswordMock).not.toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'error', text: 'Không khớp.' });
  });

  it('BE throw INVALID_RESET_TOKEN → toast error map từ i18n', async () => {
    routeQuery.value = { token: 'abcdefghijklmnop1234567890' };
    resetPasswordMock.mockRejectedValueOnce({ code: 'INVALID_RESET_TOKEN' });
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="reset-new"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-confirm"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'error', text: 'Token không hợp lệ.' });
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it('submit khi token rỗng (URL không có + chưa paste) → toast missingToken, không gọi API', async () => {
    routeQuery.value = {};
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="reset-new"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-confirm"]').setValue('NewPass1234');
    await w.find('[data-testid="reset-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(resetPasswordMock).not.toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'error', text: 'Thiếu mã.' });
  });
});
