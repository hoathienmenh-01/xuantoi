import { describe, expect, it } from 'vitest';
import { PROVERBS, randomProverb } from './proverbs';

describe('PROVERBS corpus', () => {
  it('có ít nhất 50 câu (loading screen ít lặp)', () => {
    expect(PROVERBS.length).toBeGreaterThanOrEqual(50);
  });

  it('mọi câu là string không rỗng và đã trim', () => {
    for (const p of PROVERBS) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
      expect(p).toBe(p.trim());
    }
  });

  it('không có câu trùng lặp', () => {
    const set = new Set(PROVERBS);
    expect(set.size).toBe(PROVERBS.length);
  });

  it('mọi câu kết thúc bằng dấu chấm hoặc dấu chấm than (consistent punctuation)', () => {
    for (const p of PROVERBS) {
      expect(p.endsWith('.') || p.endsWith('!')).toBe(true);
    }
  });
});

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

  it('rng=0 trả về câu đầu tiên trong corpus', () => {
    expect(randomProverb(() => 0)).toBe(PROVERBS[0]);
  });

  it('rng=0.999... trả về câu cuối trong corpus (clamp Math.floor)', () => {
    expect(randomProverb(() => 0.9999999)).toBe(PROVERBS[PROVERBS.length - 1]);
  });

  it('rng=0.5 trả về câu giữa corpus (deterministic)', () => {
    const expected = PROVERBS[Math.floor(0.5 * PROVERBS.length)];
    expect(randomProverb(() => 0.5)).toBe(expected);
  });

  it('mỗi câu trong corpus đều có thể trả ra với rng tương ứng', () => {
    for (let i = 0; i < PROVERBS.length; i++) {
      // dùng rng trả về (i + 0.5) / PROVERBS.length → Math.floor = i
      const ratio = (i + 0.5) / PROVERBS.length;
      expect(randomProverb(() => ratio)).toBe(PROVERBS[i]);
    }
  });
});
