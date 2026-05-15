import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * Cửu Thiên Mộng — `usePullToRefresh` (Phase 5 mobile gesture).
 *
 * Phát hiện pull-down ở đầu viewport (scrollY === 0) và gọi `onRefresh`
 * khi user thả tay sau khi kéo > `threshold` px. Trong khi kéo, trả về
 * `progress` (0..1) + `pullY` (px hiện tại) để view render banner
 * "Buông để làm mới" với indicator.
 *
 * Activate flow:
 *   - touchstart tại scrollY === 0.
 *   - touchmove: dy > 0 → cập nhật `pullY` (giới hạn ở threshold * 1.5).
 *   - touchend: dy > threshold → gọi onRefresh, set `refreshing=true`
 *     cho tới khi `done()` được gọi (UI cleanup).
 *
 * SSR-safe: không attach khi thiếu window.
 *
 * Tôn trọng reduced motion: vẫn cho phép gesture (input), nhưng UI nên
 * disable animation transition (tự handle bằng CSS @media query).
 */
export type UsePullToRefreshOptions = {
  /** Px tối thiểu để trigger refresh. */
  threshold?: number;
  /** Hệ số kháng (resistance) để pull cảm giác "nặng". 1.0 = không kháng. */
  resistance?: number;
  /** Element scroll container; mặc định = target ref. */
  scrollSource?: () => Element | Window;
  /** Callback khi user thả tay vượt threshold. Phải gọi `done()` để reset UI. */
  onRefresh: () => void | Promise<void>;
};

export type UsePullToRefreshResult = {
  /** Số px đang kéo xuống (≥ 0). */
  pullY: Ref<number>;
  /** Progress 0..1 dựa trên threshold. */
  progress: Ref<number>;
  /** True trong khi onRefresh đang chạy (giữ banner). */
  refreshing: Ref<boolean>;
  /** Manual reset (gọi sau khi finish refresh). */
  done: () => void;
};

export function usePullToRefresh(
  target: Ref<HTMLElement | null>,
  opts: UsePullToRefreshOptions,
): UsePullToRefreshResult {
  const threshold = opts.threshold ?? 64;
  const resistance = opts.resistance ?? 0.5;

  const pullY = ref(0);
  const progress = ref(0);
  const refreshing = ref(false);

  let startY = 0;
  let active = false;
  let armed = false;

  function getScrollTop(): number {
    if (opts.scrollSource) {
      const src = opts.scrollSource() as { scrollY?: number; scrollTop?: number };
      if (typeof src.scrollY === 'number') return src.scrollY;
      if (typeof src.scrollTop === 'number') return src.scrollTop;
      return 0;
    }
    if (typeof window !== 'undefined') return window.scrollY;
    return 0;
  }

  function onTouchStart(e: TouchEvent): void {
    if (refreshing.value) return;
    if (e.touches.length !== 1) return;
    if (getScrollTop() > 0) return;
    startY = e.touches[0].clientY;
    active = true;
    armed = false;
    pullY.value = 0;
    progress.value = 0;
  }

  function onTouchMove(e: TouchEvent): void {
    if (!active || refreshing.value) return;
    const t0 = e.touches[0];
    const dy = t0.clientY - startY;
    if (dy <= 0) {
      pullY.value = 0;
      progress.value = 0;
      armed = false;
      return;
    }
    armed = true;
    const adjusted = Math.min(dy * resistance, threshold * 1.5);
    pullY.value = adjusted;
    progress.value = Math.min(adjusted / threshold, 1);
  }

  async function onTouchEnd(): Promise<void> {
    if (!active) return;
    active = false;
    if (!armed) {
      pullY.value = 0;
      progress.value = 0;
      return;
    }
    if (pullY.value >= threshold) {
      refreshing.value = true;
      pullY.value = threshold;
      progress.value = 1;
      try {
        await Promise.resolve(opts.onRefresh());
      } finally {
        // Caller có thể gọi done() sớm hơn; nếu không, reset ở đây.
        if (refreshing.value) done();
      }
    } else {
      pullY.value = 0;
      progress.value = 0;
    }
    armed = false;
  }

  function done(): void {
    refreshing.value = false;
    pullY.value = 0;
    progress.value = 0;
  }

  onMounted(() => {
    const el = target.value;
    if (!el || typeof window === 'undefined') return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
  });

  onBeforeUnmount(() => {
    const el = target.value;
    if (!el) return;
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchEnd);
  });

  return { pullY, progress, refreshing, done };
}
