/**
 * Smart UX polish (session 9i task D): unified toast duration policy.
 *
 * Trước đây `useToastStore` dùng default duration ngắn (2600ms info/success,
 * 3600ms warning/error) — error message thường dài, người chơi không kịp đọc
 * trước khi auto-dismiss → buộc lặp lại thao tác để đọc lại lỗi. Standard UX:
 *
 * - `info`    : 3000ms (thông báo nhẹ, đọc nhanh)
 * - `success` : 3500ms (xác nhận thao tác xong, lâu hơn info chút để cảm nhận)
 * - `warning` : 5000ms (cảnh báo, cần thời gian đọc kỹ + suy nghĩ)
 * - `error`   : 6000ms (lỗi, dài nhất — error message thường dài + cần action)
 *
 * Caller vẫn override được qua `raw.duration` nếu cần (ví dụ flash quick OK).
 */
export type ToastDurationType = 'info' | 'warning' | 'error' | 'success';

export const TOAST_DURATION_MS: Record<ToastDurationType, number> = {
  info: 3000,
  success: 3500,
  warning: 5000,
  error: 6000,
};

/**
 * Resolve duration cho toast type. Caller có thể truyền override để bypass.
 *
 * @param type - toast type sau normalize ('warn' → 'warning' xử lý ngoài).
 * @param override - duration ms từ caller (nếu có); ưu tiên override.
 * @returns duration ms (>= 0).
 */
export function resolveToastDuration(
  type: ToastDurationType,
  override?: number,
): number {
  if (typeof override === 'number' && override >= 0) return override;
  return TOAST_DURATION_MS[type];
}
