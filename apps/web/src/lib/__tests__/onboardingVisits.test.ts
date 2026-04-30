import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasVisited,
  markVisited,
  clearAllVisits,
} from '@/lib/onboardingVisits';

describe('onboardingVisits', () => {
  beforeEach(() => {
    clearAllVisits();
  });

  it('hasVisited trả false mặc định khi chưa set', () => {
    expect(hasVisited('leaderboard')).toBe(false);
    expect(hasVisited('mail')).toBe(false);
  });

  it('markVisited("leaderboard") → hasVisited("leaderboard") = true', () => {
    markVisited('leaderboard');
    expect(hasVisited('leaderboard')).toBe(true);
    // mail vẫn false (key độc lập)
    expect(hasVisited('mail')).toBe(false);
  });

  it('markVisited("mail") → hasVisited("mail") = true', () => {
    markVisited('mail');
    expect(hasVisited('mail')).toBe(true);
    expect(hasVisited('leaderboard')).toBe(false);
  });

  it('markVisited gọi 2 lần idempotent (vẫn true)', () => {
    markVisited('leaderboard');
    markVisited('leaderboard');
    expect(hasVisited('leaderboard')).toBe(true);
  });

  it('clearAllVisits() reset cả 2 key', () => {
    markVisited('leaderboard');
    markVisited('mail');
    expect(hasVisited('leaderboard')).toBe(true);
    expect(hasVisited('mail')).toBe(true);
    clearAllVisits();
    expect(hasVisited('leaderboard')).toBe(false);
    expect(hasVisited('mail')).toBe(false);
  });

  it('giá trị bất kỳ ngoài "1" được treat như chưa visit (defensive)', () => {
    // Tay set raw "0" hoặc rỗng
    window.localStorage.setItem('onboarding:visited:leaderboard', '0');
    expect(hasVisited('leaderboard')).toBe(false);
    window.localStorage.setItem('onboarding:visited:leaderboard', '');
    expect(hasVisited('leaderboard')).toBe(false);
  });
});
