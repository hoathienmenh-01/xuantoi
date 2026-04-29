import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: {
        confirm: 'Đồng ý',
        cancel: 'Huỷ',
        loading: 'Đang xử lý…',
      },
    },
  },
});

function mountModal(props: Record<string, unknown> = {}) {
  return mount(ConfirmModal, {
    attachTo: document.body,
    props: {
      open: true,
      title: 'Xác nhận hành động',
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

describe('ConfirmModal — render & emit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('không render khi open=false', () => {
    mountModal({ open: false });
    expect(document.querySelector('[data-testid="confirm-modal"]')).toBeNull();
  });

  it('render title + message + 2 button khi open=true', () => {
    mountModal({ message: 'Bạn chắc chắn?' });
    const modal = document.querySelector('[data-testid="confirm-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Xác nhận hành động');
    expect(modal?.textContent).toContain('Bạn chắc chắn?');
    expect(modal?.querySelector('[data-testid="confirm-modal-confirm"]')).not.toBeNull();
    expect(modal?.querySelector('[data-testid="confirm-modal-cancel"]')).not.toBeNull();
  });

  it('confirm/cancel default label fallback từ i18n common', () => {
    mountModal();
    const confirmBtn = document.querySelector(
      '[data-testid="confirm-modal-confirm"]',
    );
    const cancelBtn = document.querySelector(
      '[data-testid="confirm-modal-cancel"]',
    );
    expect(confirmBtn?.textContent?.trim()).toBe('Đồng ý');
    expect(cancelBtn?.textContent?.trim()).toBe('Huỷ');
  });

  it('custom confirmText / cancelText override default', () => {
    mountModal({ confirmText: 'Đăng xuất', cancelText: 'Quay lại' });
    expect(
      document.querySelector('[data-testid="confirm-modal-confirm"]')?.textContent?.trim(),
    ).toBe('Đăng xuất');
    expect(
      document.querySelector('[data-testid="confirm-modal-cancel"]')?.textContent?.trim(),
    ).toBe('Quay lại');
  });

  it('click confirm button → emit "confirm"', async () => {
    const w = mountModal();
    const confirmBtn = document.querySelector(
      '[data-testid="confirm-modal-confirm"]',
    ) as HTMLButtonElement;
    confirmBtn.click();
    await w.vm.$nextTick();
    expect(w.emitted('confirm')).toHaveLength(1);
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('click cancel button → emit "cancel"', async () => {
    const w = mountModal();
    const cancelBtn = document.querySelector(
      '[data-testid="confirm-modal-cancel"]',
    ) as HTMLButtonElement;
    cancelBtn.click();
    await w.vm.$nextTick();
    expect(w.emitted('cancel')).toHaveLength(1);
    expect(w.emitted('confirm')).toBeUndefined();
  });

  it('loading=true → disable cả 2 button + confirm hiện text "Đang xử lý…"', async () => {
    const w = mountModal({ loading: true });
    const confirmBtn = document.querySelector(
      '[data-testid="confirm-modal-confirm"]',
    ) as HTMLButtonElement;
    const cancelBtn = document.querySelector(
      '[data-testid="confirm-modal-cancel"]',
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);
    expect(confirmBtn.textContent?.trim()).toBe('Đang xử lý…');

    confirmBtn.click();
    cancelBtn.click();
    await w.vm.$nextTick();
    // Disabled buttons không emit click → component không emit confirm/cancel
    expect(w.emitted('confirm')).toBeUndefined();
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('phím Escape → emit "cancel"', async () => {
    const w = mountModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('phím Escape khi loading=true KHÔNG emit cancel', async () => {
    const w = mountModal({ loading: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('click backdrop (self) → emit "cancel"', async () => {
    const w = mountModal();
    const backdrop = document.querySelector(
      '[data-testid="confirm-modal"]',
    ) as HTMLElement;
    // Click self (target === currentTarget) — dispatch sự kiện gốc trên backdrop.
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('danger=true → confirm button có class red, danger=false → amber', () => {
    const wDanger = mountModal({ danger: true });
    let confirmBtn = document.querySelector(
      '[data-testid="confirm-modal-confirm"]',
    ) as HTMLButtonElement;
    expect(confirmBtn.className).toContain('red');
    wDanger.unmount();
    document.body.innerHTML = '';

    mountModal({ danger: false });
    confirmBtn = document.querySelector(
      '[data-testid="confirm-modal-confirm"]',
    ) as HTMLButtonElement;
    expect(confirmBtn.className).toContain('amber');
  });

  it('custom testId → các sub-element có prefix tương ứng', () => {
    mountModal({ testId: 'logout-modal', message: 'sure?' });
    expect(document.querySelector('[data-testid="logout-modal"]')).not.toBeNull();
    expect(
      document.querySelector('[data-testid="logout-modal-confirm"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="logout-modal-cancel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="logout-modal-message"]'),
    ).not.toBeNull();
  });

  it('cleanup: keydown listener gỡ khi component unmount', async () => {
    const w = mountModal();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    w.unmount();
    expect(
      removeSpy.mock.calls.some(
        (c) => c[0] === 'keydown' && typeof c[1] === 'function',
      ),
    ).toBe(true);
    removeSpy.mockRestore();
  });
});
