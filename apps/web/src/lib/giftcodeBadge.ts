/**
 * Smart admin giftcode badge helper (session 9i task C).
 *
 * Đếm số giftcode đang ACTIVE (chưa revoked, chưa expired, chưa exhausted) để
 * hiển thị badge trên nav button "Giftcode" trong AdminView. Mirror pattern
 * pendingTopupCount badge (PR #118).
 *
 * Read-only thuần — chỉ filter mảng đã fetch sẵn.
 */
import { giftCodeStatusOf, type AdminGiftCodeRow } from '../api/admin';

/**
 * Đếm số giftcode còn ACTIVE từ danh sách rows. Lệ thuộc vào `giftCodeStatusOf`
 * (single source of truth) thay vì so sánh field thô tránh lệch logic với BE.
 *
 * @param rows - mảng giftcode rows từ `adminListGiftcodes()`.
 * @param now - thời điểm so sánh (default `new Date()`); có thể inject để test
 *              các kịch bản expired/non-expired.
 */
export function countActiveUnused(rows: AdminGiftCodeRow[], now = new Date()): number {
  let n = 0;
  for (const row of rows) {
    if (giftCodeStatusOf(row, now) === 'ACTIVE') n++;
  }
  return n;
}
