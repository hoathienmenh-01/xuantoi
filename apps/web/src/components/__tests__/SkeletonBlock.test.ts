/**
 * Tests cho UI atom `apps/web/src/components/ui/SkeletonBlock.vue`.
 *
 * Props:
 *  - height/width/rounded: tailwind class injection (default `h-4`/`w-full`/`rounded`)
 *  - testId: data-testid query handle (default `skeleton-block`)
 *
 * Lock-in: pulse animation class always present, aria-hidden="true" cho screen
 * reader bỏ qua, default classes apply, prop classes override default,
 * testId default + override.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';

describe('SkeletonBlock', () => {
  it('default render: h-4 w-full rounded + animate-pulse + bg-ink-700/40', () => {
    const w = mount(SkeletonBlock);
    const cls = w.attributes('class') ?? '';
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-full');
    expect(cls).toContain('rounded');
    expect(cls).toContain('animate-pulse');
    expect(cls).toContain('bg-ink-700/40');
  });

  it('aria-hidden="true" (screen reader bỏ qua skeleton placeholder)', () => {
    const w = mount(SkeletonBlock);
    expect(w.attributes('aria-hidden')).toBe('true');
  });

  it('default data-testid="skeleton-block"', () => {
    const w = mount(SkeletonBlock);
    expect(w.attributes('data-testid')).toBe('skeleton-block');
  });

  it('custom testId prop override default', () => {
    const w = mount(SkeletonBlock, { props: { testId: 'mission-skeleton' } });
    expect(w.attributes('data-testid')).toBe('mission-skeleton');
  });

  it('custom height prop override default `h-4`', () => {
    const w = mount(SkeletonBlock, { props: { height: 'h-12' } });
    const cls = w.attributes('class') ?? '';
    expect(cls).toContain('h-12');
    expect(cls).not.toContain('h-4 ');
  });

  it('custom width prop override default `w-full`', () => {
    const w = mount(SkeletonBlock, { props: { width: 'w-1/3' } });
    const cls = w.attributes('class') ?? '';
    expect(cls).toContain('w-1/3');
  });

  it('custom rounded prop override default `rounded`', () => {
    const w = mount(SkeletonBlock, { props: { rounded: 'rounded-full' } });
    const cls = w.attributes('class') ?? '';
    expect(cls).toContain('rounded-full');
  });
});
