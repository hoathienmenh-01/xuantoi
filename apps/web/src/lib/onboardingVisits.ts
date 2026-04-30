/**
 * Smart onboarding "exploration milestones" — tracks one-time visits via
 * localStorage. Used by `OnboardingChecklist` to add steps "Đã xem bảng xếp
 * hạng" + "Đã kiểm tra thư" mà không cần backend tracking riêng.
 *
 * Keys per visit:
 *   - `onboarding:visited:leaderboard` — set khi user mount LeaderboardView.
 *   - `onboarding:visited:mail` — set khi user mount MailView.
 *
 * Storage là per-browser (không sync giữa device/clear cookies). Đủ tốt cho
 * onboarding hint vì:
 *   - User mới thường dùng 1 device.
 *   - Nếu mất, panel chỉ hiện lại — không phá flow.
 *
 * SSR-safe: mọi function tự kiểm tra `typeof window` để không crash trong test
 * environment chưa mock localStorage.
 */
export type OnboardingVisitKey = 'leaderboard' | 'mail';

const PREFIX = 'onboarding:visited:';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function hasVisited(key: OnboardingVisitKey): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(PREFIX + key) === '1';
  } catch {
    // localStorage có thể bị block (private mode + Safari) → treat như chưa visit
    return false;
  }
}

export function markVisited(key: OnboardingVisitKey): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + key, '1');
  } catch {
    // silently ignore quota / private mode failure
  }
}

/** Test helper — clear all onboarding visit flags. */
export function clearAllVisits(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PREFIX + 'leaderboard');
    window.localStorage.removeItem(PREFIX + 'mail');
  } catch {
    // silently ignore
  }
}
