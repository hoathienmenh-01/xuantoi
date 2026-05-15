import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { usePullToRefresh } from '@/composables/usePullToRefresh';

type TouchListLike = { clientX: number; clientY: number }[];

function makeTouchEvent(
  type: string,
  touches: TouchListLike,
  changed: TouchListLike = touches,
): TouchEvent {
  const ev = new Event(type) as Event & {
    touches: TouchListLike;
    changedTouches: TouchListLike;
  };
  (ev as unknown as { touches: TouchListLike }).touches = touches;
  (ev as unknown as { changedTouches: TouchListLike }).changedTouches = changed;
  return ev as unknown as TouchEvent;
}

function makeHost(opts: {
  onRefresh: () => void | Promise<void>;
  scrollSource?: () => Element | Window;
  threshold?: number;
  resistance?: number;
}): {
  el: HTMLElement;
  result: ReturnType<typeof usePullToRefresh>;
} {
  let captured: ReturnType<typeof usePullToRefresh> | null = null;
  const Cmp = defineComponent({
    setup() {
      const target = ref<HTMLElement | null>(null);
      captured = usePullToRefresh(target, opts);
      return () => h('div', { ref: target, 'data-testid': 'host' });
    },
  });
  const wrapper = mount(Cmp);
  return {
    el: wrapper.find('[data-testid="host"]').element as HTMLElement,
    result: captured as unknown as ReturnType<typeof usePullToRefresh>,
  };
}

describe('usePullToRefresh', () => {
  it('pull > threshold → gọi onRefresh + set refreshing=true', async () => {
    const fakeWindow = { scrollY: 0 } as Window;
    const onRefresh = vi.fn(() => Promise.resolve());
    const { el, result } = makeHost({
      onRefresh,
      threshold: 50,
      resistance: 1,
      scrollSource: () => fakeWindow,
    });
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]));
    await nextTick();
    expect(result.pullY.value).toBeGreaterThanOrEqual(50);
    el.dispatchEvent(makeTouchEvent('touchend', []));
    await flushPromises();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // After auto-done, refreshing reset.
    expect(result.refreshing.value).toBe(false);
  });

  it('pull < threshold → KHÔNG gọi onRefresh, reset pullY', async () => {
    const fakeWindow = { scrollY: 0 } as Window;
    const onRefresh = vi.fn();
    const { el, result } = makeHost({
      onRefresh,
      threshold: 80,
      resistance: 1,
      scrollSource: () => fakeWindow,
    });
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 100, clientY: 130 }]));
    await nextTick();
    expect(result.pullY.value).toBeGreaterThan(0);
    el.dispatchEvent(makeTouchEvent('touchend', []));
    await flushPromises();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.pullY.value).toBe(0);
  });

  it('scrollTop > 0 → bỏ qua (không trigger pull)', async () => {
    const fakeWindow = { scrollY: 100 } as Window;
    const onRefresh = vi.fn();
    const { el, result } = makeHost({
      onRefresh,
      threshold: 30,
      scrollSource: () => fakeWindow,
    });
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]));
    await nextTick();
    expect(result.pullY.value).toBe(0);
    el.dispatchEvent(makeTouchEvent('touchend', []));
    await flushPromises();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('progress: 0..1 dựa trên threshold', async () => {
    const fakeWindow = { scrollY: 0 } as Window;
    const onRefresh = vi.fn();
    const { el, result } = makeHost({
      onRefresh,
      threshold: 100,
      resistance: 1,
      scrollSource: () => fakeWindow,
    });
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
    await nextTick();
    expect(result.progress.value).toBeCloseTo(0.5, 1);
  });

  it('upward swipe (dy <= 0) → không kích hoạt pull', async () => {
    const fakeWindow = { scrollY: 0 } as Window;
    const onRefresh = vi.fn();
    const { el, result } = makeHost({
      onRefresh,
      threshold: 50,
      scrollSource: () => fakeWindow,
    });
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
    el.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
    await nextTick();
    expect(result.pullY.value).toBe(0);
    el.dispatchEvent(makeTouchEvent('touchend', []));
    await flushPromises();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
