import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const forgotPasswordMock = vi.fn();
vi.mock('@/api/auth', () => ({
  forgotPassword: (...a: unknown[]) => forgotPasswordMock(...a),
}));

const routerPushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

import ForgotPasswordView from '@/views/ForgotPasswordView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      auth: {
        forgot: {
          title: 'Tìm Lại Huyền Pháp',
          subtitle: 'Subtitle',
          email: 'Email',
          submit: 'Gửi đường dẫn',
          back: 'Quay về Nhập Định',
          sent: 'Đã gửi nếu email tồn tại.',
          devTokenNote: '(Dev) Token:',
        },
        reset: { title: 'Đặt Lại Huyền Pháp' },
        errors: {
          RATE_LIMITED: 'Quá nhiều yêu cầu.',
          UNKNOWN: 'Lỗi không xác định.',
        },
      },
    },
  },
});

function mountView() {
  return mount(ForgotPasswordView, {
    global: {
      plugins: [i18n],
      stubs: { MButton: { template: '<button :data-loading="loading"><slot /></button>', props: ['loading', 'disabled'] } },
    },
  });
}

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    forgotPasswordMock.mockReset();
    routerPushMock.mockReset();
    toastPushMock.mockReset();
  });

  it('submit gọi API forgotPassword với email + show "sent" state khi devToken=null (production-like)', async () => {
    forgotPasswordMock.mockResolvedValueOnce({ ok: true, devToken: null });
    const w = mountView();
    await w.find('[data-testid="forgot-email"]').setValue('a@xt.local');
    await w.find('[data-testid="forgot-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(forgotPasswordMock).toHaveBeenCalledWith({ email: 'a@xt.local' });
    expect(w.find('[data-testid="forgot-sent"]').exists()).toBe(true);
    expect(w.find('[data-testid="forgot-form"]').exists()).toBe(false);
    expect(w.find('[data-testid="forgot-devtoken"]').exists()).toBe(false);
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'success', text: 'Đã gửi nếu email tồn tại.' });
  });

  it('show devToken note + reset shortcut khi non-prod (BE trả devToken)', async () => {
    forgotPasswordMock.mockResolvedValueOnce({ ok: true, devToken: 'dev-token-abc-123-456-789' });
    const w = mountView();
    await w.find('[data-testid="forgot-email"]').setValue('b@xt.local');
    await w.find('[data-testid="forgot-form"]').trigger('submit.prevent');
    await flushPromises();
    const devEl = w.find('[data-testid="forgot-devtoken"]');
    expect(devEl.exists()).toBe(true);
    expect(devEl.text()).toContain('dev-token-abc-123-456-789');
    await w.find('[data-testid="forgot-goreset"]').trigger('click');
    expect(routerPushMock).toHaveBeenCalledWith({
      name: 'reset-password',
      query: { token: 'dev-token-abc-123-456-789' },
    });
  });

  it('lỗi RATE_LIMITED → toast error map từ i18n, không show sent state', async () => {
    forgotPasswordMock.mockRejectedValueOnce({ code: 'RATE_LIMITED' });
    const w = mountView();
    await w.find('[data-testid="forgot-email"]').setValue('c@xt.local');
    await w.find('[data-testid="forgot-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'error', text: 'Quá nhiều yêu cầu.' });
    expect(w.find('[data-testid="forgot-sent"]').exists()).toBe(false);
    expect(w.find('[data-testid="forgot-form"]').exists()).toBe(true);
  });

  it('back link: click → router.push("/auth")', async () => {
    const w = mountView();
    await w.find('[data-testid="forgot-back"]').trigger('click');
    expect(routerPushMock).toHaveBeenCalledWith('/auth');
  });

  it('email rỗng: form không submit (HTML required), không gọi API', async () => {
    const w = mountView();
    // bỏ qua HTML required check bằng cách gọi trực tiếp form submit handler.
    // Nhưng đơn giản hơn: empty email → onSubmit early return.
    await w.find('[data-testid="forgot-form"]').trigger('submit.prevent');
    await flushPromises();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });
});
