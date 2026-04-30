import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

/**
 * AuthView smoke tests (session 9j task F / K3.4): cover tab switching
 * (login/register/change), login flow (success + router.push /home, error
 * INVALID_CREDENTIALS / fallback), register flow (success + router.push
 * /onboarding, error EMAIL_TAKEN / fallback), password strength computed,
 * change password flow (success clear fields, error OLD_PASSWORD_WRONG).
 *
 * AuthView là điểm vào hệ thống — login/register flow đúng là pre-requisite
 * tuyệt đối cho closed beta. Test chống regression khi refactor auth store
 * hoặc rename i18n key.
 */

const authLoginMock = vi.fn();
const authRegisterMock = vi.fn();
const changePasswordMock = vi.fn();

vi.mock('@/api/auth', () => ({
  changePassword: (...a: unknown[]) => changePasswordMock(...a),
}));

const routerPushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  RouterLink: {
    name: 'RouterLinkStub',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

const authState = {
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
};
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}));

vi.mock('@xuantoi/shared', async () => {
  const actual = await vi.importActual<typeof import('@xuantoi/shared')>('@xuantoi/shared');
  return {
    ...actual,
    randomProverb: () => 'Thiên địa vô tình, thánh nhân vi tâm.',
  };
});

import AuthViewComponent from '@/views/AuthView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      app: { brand: 'Xuân Tôi' },
      auth: {
        tab: {
          login: 'Đăng nhập',
          register: 'Đăng ký',
          change: 'Đổi mật khẩu',
        },
        login: {
          email: 'Email',
          password: 'Mật khẩu',
          remember: 'Ghi nhớ',
          note: 'Lưu ý dev',
          submit: 'Đăng nhập',
          success: 'Đăng nhập thành công',
        },
        register: {
          submit: 'Đăng ký',
          success: 'Tạo tài khoản thành công',
          strength: 'Độ mạnh:',
          strengthLevels: {
            0: 'Rất yếu',
            1: 'Yếu',
            2: 'Trung bình',
            3: 'Khá',
            4: 'Mạnh',
            5: 'Rất mạnh',
          },
        },
        change: {
          old: 'Mật khẩu cũ',
          new: 'Mật khẩu mới',
          submit: 'Đổi mật khẩu',
          success: 'Đổi mật khẩu thành công',
        },
        forgot: {
          title: 'Quên mật khẩu?',
        },
        errors: {
          INVALID_CREDENTIALS: 'Email hoặc mật khẩu sai.',
          EMAIL_TAKEN: 'Email đã được dùng.',
          OLD_PASSWORD_WRONG: 'Mật khẩu cũ sai.',
          UNKNOWN: 'Có lỗi xảy ra.',
        },
      },
    },
  },
});

function mountView() {
  return mount(AuthViewComponent, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  authLoginMock.mockReset();
  authRegisterMock.mockReset();
  changePasswordMock.mockReset();
  routerPushMock.mockReset();
  toastPushMock.mockReset();
  authState.loading = false;
  authState.login = vi.fn((...a: unknown[]) => authLoginMock(...a));
  authState.register = vi.fn((...a: unknown[]) => authRegisterMock(...a));
});

describe('AuthView — tab switching', () => {
  it('mặc định tab=login: hiện form login + placeholder email', () => {
    const w = mountView();
    expect(w.text()).toContain('Đăng nhập');
    expect(w.findAll('input[type="password"]').length).toBe(1); // chỉ 1 password field trong login
  });

  it('click tab register → hiện form register (2 input: email + password + strength bar)', async () => {
    const w = mountView();
    const registerTab = w.findAll('button').find((b) => b.text() === 'Đăng ký');
    await registerTab!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Độ mạnh:');
  });

  it('click tab change → hiện form change (2 password field: old + new)', async () => {
    const w = mountView();
    const changeTab = w.findAll('button').find((b) => b.text() === 'Đổi mật khẩu');
    await changeTab!.trigger('click');
    await flushPromises();
    const passwordInputs = w.findAll('input[type="password"]');
    expect(passwordInputs.length).toBe(2);
  });
});

describe('AuthView — login flow', () => {
  it('success: auth.login gọi với (email, password, remember) + toast + router.push /home', async () => {
    authLoginMock.mockResolvedValue({ id: 'u1' });
    const w = mountView();
    const inputs = w.findAll('input');
    const emailInput = inputs.find((i) => i.attributes('type') === 'email')!;
    const passwordInput = inputs.find((i) => i.attributes('type') === 'password')!;
    await emailInput.setValue('test@x.com');
    await passwordInput.setValue('pw-123456');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(authLoginMock).toHaveBeenCalledWith('test@x.com', 'pw-123456', true);
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đăng nhập thành công',
    });
    expect(routerPushMock).toHaveBeenCalledWith('/home');
  });

  it('error INVALID_CREDENTIALS → map toast auth.errors.INVALID_CREDENTIALS', async () => {
    authLoginMock.mockRejectedValue(
      Object.assign(new Error('bad'), { code: 'INVALID_CREDENTIALS' }),
    );
    const w = mountView();
    await w.find('input[type="email"]').setValue('test@x.com');
    await w.find('input[type="password"]').setValue('pw-wrong1');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Email hoặc mật khẩu sai.',
    });
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it('error không có code → fallback INVALID_CREDENTIALS (login default)', async () => {
    authLoginMock.mockRejectedValue(new Error('network'));
    const w = mountView();
    await w.find('input[type="email"]').setValue('test@x.com');
    await w.find('input[type="password"]').setValue('pw-any1234');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Email hoặc mật khẩu sai.',
    });
  });

  it('error code lạ (key i18n không có) → fallback auth.errors.UNKNOWN', async () => {
    authLoginMock.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'WEIRD_SERVER_ERROR' }),
    );
    const w = mountView();
    await w.find('input[type="email"]').setValue('test@x.com');
    await w.find('input[type="password"]').setValue('pw-123456');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
  });
});

describe('AuthView — register flow', () => {
  async function openRegisterTab(w: ReturnType<typeof mountView>) {
    const registerTab = w.findAll('button').find((b) => b.text() === 'Đăng ký');
    await registerTab!.trigger('click');
    await flushPromises();
  }

  it('success: auth.register gọi với (email, password) + toast + router.push /onboarding', async () => {
    authRegisterMock.mockResolvedValue({ id: 'u1' });
    const w = mountView();
    await openRegisterTab(w);
    await w.find('input[type="email"]').setValue('new@x.com');
    await w.find('input[type="password"]').setValue('Strong-Pass1!');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(authRegisterMock).toHaveBeenCalledWith('new@x.com', 'Strong-Pass1!');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Tạo tài khoản thành công',
    });
    expect(routerPushMock).toHaveBeenCalledWith('/onboarding');
  });

  it('error EMAIL_TAKEN → map auth.errors.EMAIL_TAKEN', async () => {
    authRegisterMock.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'EMAIL_TAKEN' }),
    );
    const w = mountView();
    await openRegisterTab(w);
    await w.find('input[type="email"]').setValue('taken@x.com');
    await w.find('input[type="password"]').setValue('pw-12345678');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Email đã được dùng.',
    });
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});

describe('AuthView — password strength', () => {
  it('mật khẩu "abc" → strength 1 (chỉ lowercase)', async () => {
    const w = mountView();
    const registerTab = w.findAll('button').find((b) => b.text() === 'Đăng ký');
    await registerTab!.trigger('click');
    await flushPromises();
    await w.find('input[type="password"]').setValue('abc');
    await flushPromises();
    // label strengthLevels[1] = 'Yếu'
    expect(w.text()).toContain('Yếu');
  });

  it('mật khẩu "Abcdef12!" → strength 5 (8+ len + upper + lower + digit + special)', async () => {
    const w = mountView();
    const registerTab = w.findAll('button').find((b) => b.text() === 'Đăng ký');
    await registerTab!.trigger('click');
    await flushPromises();
    await w.find('input[type="password"]').setValue('Abcdef12!');
    await flushPromises();
    // label strengthLevels[5] = 'Rất mạnh'
    expect(w.text()).toContain('Rất mạnh');
  });
});

describe('AuthView — change password flow', () => {
  async function openChangeTab(w: ReturnType<typeof mountView>) {
    const changeTab = w.findAll('button').find((b) => b.text() === 'Đổi mật khẩu');
    await changeTab!.trigger('click');
    await flushPromises();
  }

  it('success: changePassword gọi với {oldPassword, newPassword} + toast success + clear fields', async () => {
    changePasswordMock.mockResolvedValue(undefined);
    const w = mountView();
    await openChangeTab(w);
    const passwordInputs = w.findAll('input[type="password"]');
    await passwordInputs[0].setValue('old-pw-1234');
    await passwordInputs[1].setValue('new-pw-1234');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(changePasswordMock).toHaveBeenCalledWith({
      oldPassword: 'old-pw-1234',
      newPassword: 'new-pw-1234',
    });
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đổi mật khẩu thành công',
    });
    // Fields should be cleared.
    const passwordInputsAfter = w.findAll('input[type="password"]');
    expect((passwordInputsAfter[0].element as HTMLInputElement).value).toBe('');
    expect((passwordInputsAfter[1].element as HTMLInputElement).value).toBe('');
  });

  it('error OLD_PASSWORD_WRONG → map auth.errors.OLD_PASSWORD_WRONG', async () => {
    changePasswordMock.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'OLD_PASSWORD_WRONG' }),
    );
    const w = mountView();
    await openChangeTab(w);
    const passwordInputs = w.findAll('input[type="password"]');
    await passwordInputs[0].setValue('bad-old-pw1');
    await passwordInputs[1].setValue('new-pw-1234');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Mật khẩu cũ sai.',
    });
  });

  it('error không có code → fallback OLD_PASSWORD_WRONG (change default)', async () => {
    changePasswordMock.mockRejectedValue(new Error('net'));
    const w = mountView();
    await openChangeTab(w);
    const passwordInputs = w.findAll('input[type="password"]');
    await passwordInputs[0].setValue('any-old-pw1');
    await passwordInputs[1].setValue('new-pw-1234');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Mật khẩu cũ sai.',
    });
  });
});
