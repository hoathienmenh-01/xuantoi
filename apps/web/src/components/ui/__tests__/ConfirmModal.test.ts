import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

/**
 * ConfirmModal render + wiring tests (session 9l UI primitive coverage).
 *
 * ConfirmModal là primitive dùng khắp app cho thao tác phá huỷ (giftcode revoke,
 * user ban, item grant, topup reject, ...). Regression ở đây có tác động rộng.
 *
 * Covers:
 *  - open=false → không render.
 *  - open=true → render title/message + confirm/cancel buttons.
 *  - click confirm/cancel → emit đúng event.
 *  - Escape key (when open) → emit cancel; khi loading thì không emit.
 *  - backdrop click (click.self) → emit cancel; khi loading thì không emit.
 *  - loading=true → nút disabled + label swap sang common.loading.
 *  - danger=true → nút confirm dùng class đỏ (style variant).
 *  - fallback i18n common.confirm/common.cancel khi không truyền confirmText/cancelText.
 *  - custom confirmText/cancelText → override.
 *  - testId propagate tới data-testid root + message + confirm/cancel buttons.
 */

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: { confirm: 'Xác nhận', cancel: 'Huỷ', loading: 'Đang tải...' },
    },
  },
});

function mountModal(props: Record<string, unknown> = {}) {
  return mount(ConfirmModal, {
    props: {
      open: true,
      title: 'Xác nhận thao tác',
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });
}

describe('ConfirmModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('open=false → không render dialog', () => {
    mountModal({ open: false });
    expect(document.querySelector('[data-testid="confirm-modal"]')).toBeNull();
  });

  it('open=true → render title + confirm/cancel buttons', () => {
    mountModal({ title: 'Thu hồi giftcode?' });
    expect(document.body.textContent).toContain('Thu hồi giftcode?');
    expect(document.querySelector('[data-testid="confirm-modal-confirm"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="confirm-modal-cancel"]')).not.toBeNull();
  });

  it('render message khi có prop message', () => {
    mountModal({ message: 'Hành động này không thể hoàn tác.' });
    const msg = document.querySelector('[data-testid="confirm-modal-message"]');
    expect(msg?.textContent).toContain('Hành động này không thể hoàn tác.');
  });

  it('không render message element khi message không truyền', () => {
    mountModal();
    expect(document.querySelector('[data-testid="confirm-modal-message"]')).toBeNull();
  });

  it('click nút confirm → emit "confirm"', async () => {
    const w = mountModal();
    await (document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLButtonElement).click();
    expect(w.emitted('confirm')).toHaveLength(1);
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('click nút cancel → emit "cancel"', async () => {
    const w = mountModal();
    await (document.querySelector('[data-testid="confirm-modal-cancel"]') as HTMLButtonElement).click();
    expect(w.emitted('cancel')).toHaveLength(1);
    expect(w.emitted('confirm')).toBeUndefined();
  });

  it('Escape key khi open → emit "cancel"', async () => {
    const w = mountModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('Escape key KHÔNG emit khi loading=true (tránh huỷ nhầm lúc submitting)', async () => {
    const w = mountModal({ loading: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('click backdrop (click.self) → emit "cancel"', async () => {
    const w = mountModal();
    const backdrop = document.querySelector('[data-testid="confirm-modal"]') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    // click.self: target phải === backdrop → event trên child không trigger
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('click bên trong dialog (không phải backdrop) → không emit cancel', async () => {
    const w = mountModal();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(w.emitted('cancel')).toBeUndefined();
  });

  it('loading=true → nút disabled + label swap sang common.loading', () => {
    mountModal({ loading: true });
    const confirmBtn = document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLButtonElement;
    const cancelBtn = document.querySelector('[data-testid="confirm-modal-cancel"]') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);
    expect(confirmBtn.textContent?.trim()).toBe('Đang tải...');
  });

  it('danger=true → nút confirm dùng class đỏ', () => {
    mountModal({ danger: true });
    const confirmBtn = document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement;
    // Danger variant uses red-* utility classes
    expect(confirmBtn.className).toMatch(/red-/);
    expect(confirmBtn.className).not.toMatch(/amber-/);
  });

  it('danger=false (default) → nút confirm dùng class amber', () => {
    mountModal();
    const confirmBtn = document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement;
    expect(confirmBtn.className).toMatch(/amber-/);
    expect(confirmBtn.className).not.toMatch(/red-/);
  });

  it('fallback i18n common.confirm/common.cancel khi không truyền text', () => {
    mountModal();
    const confirmBtn = document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement;
    const cancelBtn = document.querySelector('[data-testid="confirm-modal-cancel"]') as HTMLElement;
    expect(confirmBtn.textContent?.trim()).toBe('Xác nhận');
    expect(cancelBtn.textContent?.trim()).toBe('Huỷ');
  });

  it('custom confirmText/cancelText override i18n', () => {
    mountModal({ confirmText: 'Thu hồi ngay', cancelText: 'Giữ lại' });
    const confirmBtn = document.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement;
    const cancelBtn = document.querySelector('[data-testid="confirm-modal-cancel"]') as HTMLElement;
    expect(confirmBtn.textContent?.trim()).toBe('Thu hồi ngay');
    expect(cancelBtn.textContent?.trim()).toBe('Giữ lại');
  });

  it('custom testId → propagate tới root + message + buttons', () => {
    mountModal({ testId: 'revoke-modal', message: 'Bạn chắc không?' });
    expect(document.querySelector('[data-testid="revoke-modal"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="revoke-modal-message"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="revoke-modal-confirm"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="revoke-modal-cancel"]')).not.toBeNull();
  });

  it('unmount → remove window keydown listener (không leak)', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const w = mountModal();
    w.unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
