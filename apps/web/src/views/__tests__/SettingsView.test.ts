import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';

const logoutAllMock = vi.fn();
const changePasswordMock = vi.fn();

vi.mock('@/api/auth', () => ({
  logoutAll: (...a: unknown[]) => logoutAllMock(...a),
  changePassword: (...a: unknown[]) => changePasswordMock(...a),
}));

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

const authUser = { value: { id: 'u1', email: 'tester@xuantoi.local', role: 'PLAYER', createdAt: '2024-01-01T00:00:00.000Z' } };
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    hydrate: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    get user() {
      return authUser.value;
    },
    set user(v) {
      authUser.value = v;
    },
  }),
}));

vi.mock('@/stores/game', () => ({
  useGameStore: () => ({
    fetchState: vi.fn().mockResolvedValue(undefined),
    bindSocket: vi.fn(),
  }),
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

vi.mock('@/i18n', () => ({
  setLocale: vi.fn(),
}));

import SettingsView from '@/views/SettingsView.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: { confirm: 'Đồng ý', cancel: 'Huỷ', loading: 'Đang xử lý…' },
      settings: {
        title: 'Tâm Pháp Đường',
        subtitle: 'Subtitle',
        account: {
          title: 'Thông Tin',
          email: 'Email',
          role: 'Vai Trò',
          createdAt: 'Ngày nhập đạo',
        },
        password: {
          title: 'Đổi Mật Khẩu',
          hint: 'Hint',
          old: 'Cũ',
          new: 'Mới',
          confirm: 'Xác nhận',
          submit: 'Cập nhật',
          empty: 'Vui lòng nhập đủ.',
          mismatch: 'Không khớp.',
          tooShort: 'Quá ngắn.',
          success: 'Thành công.',
        },
        locale: { title: 'Ngôn Ngữ', changed: 'Đã đổi.' },
        logoutAll: {
          title: 'Đăng xuất khỏi tất cả thiết bị',
          hint: 'Hint',
          submit: 'Đăng xuất tất cả',
          confirm: 'Bạn chắc chắn muốn đăng xuất khỏi mọi thiết bị?',
          success: 'Đã thu hồi {revoked} phiên.',
        },
        errors: {
          UNKNOWN: 'Có lỗi xảy ra.',
          UNAUTHENTICATED: 'Hết phiên.',
        },
      },
    },
  },
});

let wrapper: ReturnType<typeof mount> | null = null;

function mountView() {
  wrapper = mount(SettingsView, {
    attachTo: document.body,
    global: { plugins: [i18n] },
  });
  return wrapper;
}

describe('SettingsView — logout-all confirm modal flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authUser.value = { id: 'u1', email: 'tester@xuantoi.local', role: 'PLAYER', createdAt: '2024-01-01T00:00:00.000Z' };
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('khi mới render: modal logout-all không hiển thị, KHÔNG gọi logoutAll', async () => {
    mountView();
    await flushPromises();
    expect(document.querySelector('[data-testid="logout-all-confirm-modal"]')).toBeNull();
    expect(logoutAllMock).not.toHaveBeenCalled();
  });

  it('click nút "Đăng xuất tất cả" mở modal confirm, không gọi API ngay', async () => {
    mountView();
    await flushPromises();
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]');
    expect(btn).not.toBeNull();
    btn!.click();
    await flushPromises();
    const modal = document.querySelector('[data-testid="logout-all-confirm-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Bạn chắc chắn muốn đăng xuất khỏi mọi thiết bị?');
    expect(logoutAllMock).not.toHaveBeenCalled();
  });

  it('cancel modal → đóng modal, không gọi logoutAll', async () => {
    mountView();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="logout-all-confirm-modal-cancel"]')!
      .click();
    await flushPromises();
    expect(document.querySelector('[data-testid="logout-all-confirm-modal"]')).toBeNull();
    expect(logoutAllMock).not.toHaveBeenCalled();
  });

  it('confirm modal → gọi logoutAll, toast success, navigate /auth, đóng modal', async () => {
    logoutAllMock.mockResolvedValue({ revoked: 3 });
    mountView();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="logout-all-confirm-modal-confirm"]')!
      .click();
    await flushPromises();

    expect(logoutAllMock).toHaveBeenCalledTimes(1);
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã thu hồi 3 phiên.',
    });
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(document.querySelector('[data-testid="logout-all-confirm-modal"]')).toBeNull();
  });

  it('confirm error có code map qua i18n settings.errors → toast error đúng text', async () => {
    logoutAllMock.mockRejectedValue({ code: 'UNAUTHENTICATED' });
    mountView();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="logout-all-confirm-modal-confirm"]')!
      .click();
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Hết phiên.',
    });
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('error code không có trong i18n → fallback UNKNOWN', async () => {
    logoutAllMock.mockRejectedValue({ code: 'WEIRD_UNMAPPED' });
    mountView();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="logout-all-confirm-modal-confirm"]')!
      .click();
    await flushPromises();

    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Có lỗi xảy ra.',
    });
  });

  it('phím Escape khi modal mở → đóng modal, không gọi logoutAll', async () => {
    mountView();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="settings-logout-all-btn"]')!
      .click();
    await flushPromises();
    expect(document.querySelector('[data-testid="logout-all-confirm-modal"]')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(document.querySelector('[data-testid="logout-all-confirm-modal"]')).toBeNull();
    expect(logoutAllMock).not.toHaveBeenCalled();
  });
});
