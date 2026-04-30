import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';

/**
 * SkeletonBlock smoke tests (session 9l UI primitive coverage).
 * Primitive dùng trong mọi loading state FE — chỉ cần chắc prop render đúng + có aria-hidden.
 */
describe('SkeletonBlock', () => {
  it('default → class h-4 w-full rounded + aria-hidden', () => {
    const w = mount(SkeletonBlock);
    const el = w.find('div');
    expect(el.classes()).toContain('h-4');
    expect(el.classes()).toContain('w-full');
    expect(el.classes()).toContain('rounded');
    expect(el.classes()).toContain('animate-pulse');
    expect(el.attributes('aria-hidden')).toBe('true');
  });

  it('custom height/width/rounded → apply vào class binding', () => {
    const w = mount(SkeletonBlock, { props: { height: 'h-12', width: 'w-1/3', rounded: 'rounded-full' } });
    const el = w.find('div');
    expect(el.classes()).toContain('h-12');
    expect(el.classes()).toContain('w-1/3');
    expect(el.classes()).toContain('rounded-full');
  });

  it('testId mặc định = skeleton-block khi không truyền', () => {
    const w = mount(SkeletonBlock);
    expect(w.find('div').attributes('data-testid')).toBe('skeleton-block');
  });

  it('testId custom → propagate vào data-testid', () => {
    const w = mount(SkeletonBlock, { props: { testId: 'leaderboard-skeleton-row' } });
    expect(w.find('div').attributes('data-testid')).toBe('leaderboard-skeleton-row');
  });
});
