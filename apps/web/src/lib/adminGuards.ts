/**
 * Admin self-target guards.
 *
 * BE đã throw `CANNOT_TARGET_SELF` nếu admin cố thao tác lên chính tài khoản
 * mình (set role / ban / grant — xem `apps/api/src/modules/admin/admin.service.ts`).
 * FE bổ sung guard ở UI để: (a) disable nút trước khi user click → tránh
 * confirm dialog + toast error, (b) early return trong handler → defensive
 * khi user dispatch event qua DevTools.
 *
 * Các function ở đây là pure helper, dễ unit test mà không cần mount
 * `AdminView.vue`.
 */

/**
 * `targetUserId` có phải chính `actorUserId` hay không.
 * Trả `false` nếu một trong hai falsy (chưa hydrate auth/user).
 */
export function isSelfTarget(
  actorUserId: string | null | undefined,
  targetUserId: string | null | undefined,
): boolean {
  if (!actorUserId || !targetUserId) return false;
  return actorUserId === targetUserId;
}

/**
 * Kết quả guard cho action `setRole` của admin.
 * BE rule: `actorRole === 'ADMIN'` mới được đổi role; admin không thể
 * đổi role chính mình (CANNOT_TARGET_SELF).
 *
 * Lưu ý: không filter target role ở FE — BE cho ADMIN demote ADMIN khác
 * (chỉ chặn self) → FE không nên gây confusion bằng cách hide ADMIN option.
 */
export function canChangeRole(opts: {
  actorRole: 'ADMIN' | 'MOD' | 'PLAYER' | undefined | null;
  actorUserId: string | null | undefined;
  targetUserId: string;
}): { allowed: boolean; reason?: 'NOT_ADMIN' | 'SELF_TARGET' } {
  if (opts.actorRole !== 'ADMIN') return { allowed: false, reason: 'NOT_ADMIN' };
  if (isSelfTarget(opts.actorUserId, opts.targetUserId)) {
    return { allowed: false, reason: 'SELF_TARGET' };
  }
  return { allowed: true };
}

/**
 * Guard cho ban / grant — bất kỳ admin/mod nào (BE phân quyền chi tiết tiếp)
 * đều không được tự thao tác lên chính mình.
 */
export function canTargetUser(opts: {
  actorUserId: string | null | undefined;
  targetUserId: string;
}): { allowed: boolean; reason?: 'SELF_TARGET' } {
  if (isSelfTarget(opts.actorUserId, opts.targetUserId)) {
    return { allowed: false, reason: 'SELF_TARGET' };
  }
  return { allowed: true };
}
