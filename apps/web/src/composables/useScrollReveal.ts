import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * Cửu Thiên Mộng — `useScrollReveal` (Phase 5 micro-interaction).
 *
 * Trả về `{ target, revealed }`:
 *   - `target`: gán `ref="target"` vào element cần reveal.
 *   - `revealed`: `true` khi element vào viewport lần đầu (lưu trữ luôn,
 *     không revert khi scroll khỏi viewport — giúp animation 1 lần).
 *
 * Tích hợp:
 *   - SSR-safe: trả `revealed.value = true` ngay nếu thiếu IntersectionObserver
 *     (Jest/jsdom/SSR) để không che nội dung khi animation không phải critical.
 *   - `prefers-reduced-motion: reduce` → bỏ qua observe, set `revealed=true`
 *     ngay → CSS hợp tác (transition: none) đảm bảo không có motion.
 *
 * Options:
 *   - `threshold` (0..1, mặc định 0.15): tỷ lệ visible để trigger.
 *   - `rootMargin` (mặc định `"0px 0px -10% 0px"`): tăng "đáy" để reveal
 *     sớm hơn khi cuộn xuống.
 *   - `once` (mặc định true): chỉ reveal lần đầu.
 */
export type UseScrollRevealOptions = {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

export function useScrollReveal(opts: UseScrollRevealOptions = {}): {
  target: Ref<HTMLElement | null>;
  revealed: Ref<boolean>;
} {
  const target = ref<HTMLElement | null>(null);
  const revealed = ref(false);

  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    revealed.value = true;
    return { target, revealed };
  }

  // Honor reduced motion: reveal immediately (no animation needed).
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    revealed.value = true;
    return { target, revealed };
  }

  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    const el = target.value;
    if (!el) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            revealed.value = true;
            if (opts.once !== false) {
              observer?.disconnect();
              observer = null;
            }
          } else if (opts.once === false) {
            revealed.value = false;
          }
        }
      },
      {
        threshold: opts.threshold ?? 0.15,
        rootMargin: opts.rootMargin ?? '0px 0px -10% 0px',
      },
    );
    observer.observe(el);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return { target, revealed };
}
