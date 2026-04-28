import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import SkeletonTable from '@/components/ui/SkeletonTable.vue';

describe('SkeletonBlock', () => {
  it('render mặc định h-4 w-full rounded + aria-hidden', () => {
    const w = mount(SkeletonBlock);
    const root = w.element as HTMLElement;
    expect(root.className).toContain('h-4');
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('rounded');
    expect(root.className).toContain('animate-pulse');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('data-testid')).toBe('skeleton-block');
  });

  it('respect props height/width/rounded/testId', () => {
    const w = mount(SkeletonBlock, {
      props: {
        height: 'h-12',
        width: 'w-1/3',
        rounded: 'rounded-full',
        testId: 'avatar-sk',
      },
    });
    const root = w.element as HTMLElement;
    expect(root.className).toContain('h-12');
    expect(root.className).toContain('w-1/3');
    expect(root.className).toContain('rounded-full');
    expect(root.getAttribute('data-testid')).toBe('avatar-sk');
  });
});

describe('SkeletonTable', () => {
  it('render mặc định 6 row × 5 col', () => {
    const w = mount(SkeletonTable);
    const root = w.find('[data-testid="skeleton-table"]');
    expect(root.exists()).toBe(true);
    const rootEl = root.element as HTMLElement;
    const rows = Array.from(rootEl.children) as HTMLElement[];
    expect(rows.length).toBe(6);
    expect(rows[0].children.length).toBe(5);
  });

  it('respect props rows/cols/testId + grid template inline style', () => {
    const w = mount(SkeletonTable, {
      props: { rows: 3, cols: 4, testId: 'leaderboard-sk' },
    });
    const root = w.find('[data-testid="leaderboard-sk"]');
    expect(root.exists()).toBe(true);
    const rootEl = root.element as HTMLElement;
    const rows = Array.from(rootEl.children) as HTMLElement[];
    expect(rows.length).toBe(3);
    expect(rows[0].children.length).toBe(4);
    expect(rows[0].style.gridTemplateColumns).toBe(
      'repeat(4, minmax(0, 1fr))',
    );
  });

  it('aria-hidden để screen reader bỏ qua', () => {
    const w = mount(SkeletonTable);
    expect(w.element.getAttribute('aria-hidden')).toBe('true');
  });
});
