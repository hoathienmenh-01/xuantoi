import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SkeletonTable from '@/components/ui/SkeletonTable.vue';

/**
 * SkeletonTable smoke tests (session 9l UI primitive coverage).
 * Primitive dùng trong LeaderboardView / ShopView / AdminView khi đợi fetch — verify grid shape.
 */
describe('SkeletonTable', () => {
  it('default → 6 rows × 5 cols grid + aria-hidden + data-testid', () => {
    const w = mount(SkeletonTable);
    const root = w.find('[data-testid="skeleton-table"]').element as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    const rows = Array.from(root.children) as HTMLElement[];
    expect(rows).toHaveLength(6);
    expect(rows[0].children).toHaveLength(5);
  });

  it('rows=3 cols=2 → grid 3×2', () => {
    const w = mount(SkeletonTable, { props: { rows: 3, cols: 2 } });
    const root = w.find('[data-testid="skeleton-table"]').element as HTMLElement;
    const rows = Array.from(root.children) as HTMLElement[];
    expect(rows).toHaveLength(3);
    expect(rows[0].children).toHaveLength(2);
  });

  it('inline grid-template-columns style reflect prop cols', () => {
    const w = mount(SkeletonTable, { props: { cols: 7 } });
    const root = w.find('[data-testid="skeleton-table"]').element as HTMLElement;
    const firstRow = root.children[0] as HTMLElement;
    expect(firstRow.getAttribute('style')).toContain('repeat(7,');
  });

  it('custom testId → propagate data-testid', () => {
    const w = mount(SkeletonTable, { props: { testId: 'shop-table-skeleton' } });
    expect(w.find('[data-testid="shop-table-skeleton"]').exists()).toBe(true);
    expect(w.find('[data-testid="skeleton-table"]').exists()).toBe(false);
  });
});
