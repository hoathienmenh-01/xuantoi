import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/**
 * Cửu Thiên Mộng — `useSwipe` (Phase 5 mobile gesture).
 *
 * Horizontal swipe detector trên element được tham chiếu. Phát hiện
 * "vuốt trái / vuốt phải" khi delta-x vượt ngưỡng và chuyển dịch chủ yếu
 * theo trục ngang (không phải scroll dọc).
 *
 * SSR-safe: không attach listener khi thiếu window.
 *
 * Honor `prefers-reduced-motion`? — KHÔNG: swipe là input, không phải
 * animation. Reduced motion chỉ cấm motion. Tuy nhiên view tiêu thụ swipe
 * có thể disable transition để chuyển tab "instant".
 *
 * Options:
 *   - `threshold` (default 50): khoảng cách px tối thiểu để tính swipe.
 *   - `maxVertical` (default 60): nếu |dy| > giá trị này → bỏ (user đang
 *     scroll dọc thay vì swipe ngang).
 *   - `passive` (default false): override touch listener passive flag.
 *     Mặc định false để có thể call preventDefault trong scenario edge.
 *
 * Returns: void (composable tự gắn/xoá listener).
 */
export type UseSwipeOptions = {
  threshold?: number;
  maxVertical?: number;
  passive?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export function useSwipe(
  target: Ref<HTMLElement | null>,
  opts: UseSwipeOptions = {},
): void {
  const threshold = opts.threshold ?? 50;
  const maxVertical = opts.maxVertical ?? 60;
  const passive = opts.passive ?? true;

  let startX = 0;
  let startY = 0;
  let active = false;

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) {
      active = false;
      return;
    }
    const t0 = e.touches[0];
    startX = t0.clientX;
    startY = t0.clientY;
    active = true;
  }

  function onTouchEnd(e: TouchEvent): void {
    if (!active) return;
    active = false;
    const t0 = e.changedTouches[0];
    if (!t0) return;
    const dx = t0.clientX - startX;
    const dy = t0.clientY - startY;
    if (Math.abs(dy) > maxVertical) return;
    if (Math.abs(dx) < threshold) return;
    if (dx < 0) opts.onSwipeLeft?.();
    else opts.onSwipeRight?.();
  }

  onMounted(() => {
    const el = target.value;
    if (!el || typeof window === 'undefined') return;
    el.addEventListener('touchstart', onTouchStart, { passive });
    el.addEventListener('touchend', onTouchEnd, { passive });
  });

  onBeforeUnmount(() => {
    const el = target.value;
    if (!el) return;
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchend', onTouchEnd);
  });
}
