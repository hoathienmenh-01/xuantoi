/**
 * Tests cho UI atom `apps/web/src/components/ui/SkeletonTable.vue`.
 *
 * Props:
 *  - rows: số dòng giả; default 6
 *  - cols: số cột giả; default 5
 *  - testId: data-testid; default 'skeleton-table'
 *
 * Lock-in: rows × cols cells, default 6×5=30, custom dims, gridTemplateColumns
 * inline style đúng số cols, aria-hidden cho a11y, animate-pulse trên từng cell.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import SkeletonTable from '@/components/ui/SkeletonTable.vue';

describe('SkeletonTable', () => {
  it('default 6 rows × 5 cols = 30 cells', () => {
    const w = mount(SkeletonTable);
    const cells = w.findAll('.bg-ink-700\\/40');
    expect(cells).toHaveLength(30);
  });

  it('custom 3 rows × 4 cols = 12 cells', () => {
    const w = mount(SkeletonTable, { props: { rows: 3, cols: 4 } });
    expect(w.findAll('.bg-ink-700\\/40')).toHaveLength(12);
  });

  it('rows = 1, cols = 1 → 1 cell', () => {
    const w = mount(SkeletonTable, { props: { rows: 1, cols: 1 } });
    expect(w.findAll('.bg-ink-700\\/40')).toHaveLength(1);
  });

  it('inline gridTemplateColumns reflects cols prop', () => {
    const w = mount(SkeletonTable, { props: { rows: 2, cols: 7 } });
    const rowDivs = w.findAll('.grid');
    expect(rowDivs).toHaveLength(2);
    for (const r of rowDivs) {
      expect(r.attributes('style') ?? '').toContain('repeat(7, minmax(0, 1fr))');
    }
  });

  it('default data-testid="skeleton-table"', () => {
    const w = mount(SkeletonTable);
    expect(w.attributes('data-testid')).toBe('skeleton-table');
  });

  it('custom testId override', () => {
    const w = mount(SkeletonTable, { props: { testId: 'leaderboard-skeleton' } });
    expect(w.attributes('data-testid')).toBe('leaderboard-skeleton');
  });

  it('aria-hidden="true" (a11y: screen reader skip)', () => {
    const w = mount(SkeletonTable);
    expect(w.attributes('aria-hidden')).toBe('true');
  });

  it('mỗi cell có animate-pulse class', () => {
    const w = mount(SkeletonTable, { props: { rows: 1, cols: 3 } });
    const cells = w.findAll('.bg-ink-700\\/40');
    for (const c of cells) {
      expect(c.attributes('class') ?? '').toContain('animate-pulse');
    }
  });
});
