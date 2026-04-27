import { describe, expect, it } from 'vitest';
import { randomProverb } from './proverbs';

describe('randomProverb', () => {
  it('export là function', () => {
    expect(typeof randomProverb).toBe('function');
  });

  it('trả về string không rỗng', () => {
    const p = randomProverb();
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });

  it('seedable bằng rng deterministic', () => {
    const p1 = randomProverb(() => 0);
    const p2 = randomProverb(() => 0);
    expect(p1).toBe(p2);
  });
});
