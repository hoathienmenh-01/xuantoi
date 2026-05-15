import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useSwipe } from '@/composables/useSwipe';

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

function makeHost(
  onSwipeLeft = vi.fn(),
  onSwipeRight = vi.fn(),
  threshold = 50,
  maxVertical = 60,
): { wrapper: ReturnType<typeof mount>; el: HTMLElement; onSwipeLeft: typeof onSwipeLeft; onSwipeRight: typeof onSwipeRight } {
  const Cmp = defineComponent({
    setup() {
      const target = ref<HTMLElement | null>(null);
      useSwipe(target, { onSwipeLeft, onSwipeRight, threshold, maxVertical });
      return () => h('div', { ref: target, 'data-testid': 'host' });
    },
  });
  const wrapper = mount(Cmp);
  const el = wrapper.find('[data-testid="host"]').element as HTMLElement;
  return { wrapper, el, onSwipeLeft, onSwipeRight };
}

describe('useSwipe', () => {
  it('swipe-left (dx < -threshold) → gọi onSwipeLeft', async () => {
    const { el, onSwipeLeft, onSwipeRight } = makeHost();
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 80, clientY: 105 }]));
    await nextTick();
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('swipe-right (dx > threshold) → gọi onSwipeRight', async () => {
    const { el, onSwipeLeft, onSwipeRight } = makeHost();
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 50, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 200, clientY: 102 }]));
    await nextTick();
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('vertical movement > maxVertical → bỏ qua', async () => {
    const { el, onSwipeLeft, onSwipeRight } = makeHost();
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 50, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 200, clientY: 250 }]));
    await nextTick();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('dx < threshold → bỏ qua (tap)', async () => {
    const { el, onSwipeLeft, onSwipeRight } = makeHost();
    el.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 110, clientY: 100 }]));
    await nextTick();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('multi-touch → không active', async () => {
    const { el, onSwipeLeft, onSwipeRight } = makeHost();
    el.dispatchEvent(
      makeTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 150, clientY: 100 },
      ]),
    );
    el.dispatchEvent(makeTouchEvent('touchend', [], [{ clientX: 250, clientY: 100 }]));
    await nextTick();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
