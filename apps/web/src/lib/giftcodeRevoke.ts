/**
 * Pure helpers cho luồng admin thu hồi giftcode.
 *
 * Mục tiêu: thay thế `window.confirm()` text-only bằng ConfirmModal hiển thị
 * impact rõ ràng (số lượt đã dùng, ngày hết hạn, cảnh báo không thể hoàn tác).
 *
 * Tách helper sang đây để test thuần không phụ thuộc Vue/Pinia/i18n.
 */

export interface GiftcodeRevokeImpactInput {
  code: string;
  redeemCount: number;
  maxRedeems: number | null;
  expiresAt: string | null;
  now?: Date;
}

export interface GiftcodeRevokeImpact {
  /** "ABC" — copy hiển thị in-modal title. */
  code: string;
  /** "3 / 100" hoặc "3 / ∞". */
  redeemUsage: string;
  /** Số lượt còn lại; null nếu vô hạn. */
  remaining: number | null;
  /**
   * `'expired'` nếu `expiresAt < now`, `'expires-soon'` nếu < 24h,
   * `'active'` còn dùng được, `'no-expiry'` không có hạn.
   */
  expiryStatus: 'expired' | 'expires-soon' | 'active' | 'no-expiry';
  /** ISO `expiresAt` đã chuẩn hoá thành null nếu input null/invalid. */
  expiresAt: string | null;
}

/**
 * Đo lường impact của thu hồi giftcode để hiển thị trong ConfirmModal.
 *
 * - `remaining`: nếu `maxRedeems` null ⇒ vô hạn ⇒ trả null.
 * - `expiryStatus`:
 *   - `'no-expiry'` nếu `expiresAt` null/invalid.
 *   - `'expired'` nếu `expiresAt < now`.
 *   - `'expires-soon'` nếu `< now + 24h`.
 *   - `'active'` còn lại.
 */
export function computeGiftcodeRevokeImpact(
  input: GiftcodeRevokeImpactInput,
): GiftcodeRevokeImpact {
  const now = input.now ?? new Date();
  const remaining =
    input.maxRedeems === null
      ? null
      : Math.max(0, input.maxRedeems - input.redeemCount);
  const redeemUsage =
    input.maxRedeems === null
      ? `${input.redeemCount} / ∞`
      : `${input.redeemCount} / ${input.maxRedeems}`;

  let expiryStatus: GiftcodeRevokeImpact['expiryStatus'] = 'no-expiry';
  let normalisedExpiresAt: string | null = null;
  if (input.expiresAt) {
    const t = new Date(input.expiresAt).getTime();
    if (Number.isFinite(t)) {
      normalisedExpiresAt = new Date(t).toISOString();
      const diff = t - now.getTime();
      if (diff <= 0) expiryStatus = 'expired';
      else if (diff < 24 * 60 * 60 * 1000) expiryStatus = 'expires-soon';
      else expiryStatus = 'active';
    }
  }

  return {
    code: input.code,
    redeemUsage,
    remaining,
    expiryStatus,
    expiresAt: normalisedExpiresAt,
  };
}

/**
 * Map error code BE từ `POST /admin/giftcodes/:code/revoke` sang i18n key cụ thể.
 * Caller (AdminView `handleErr`) đã có fallback sang `admin.errors.UNKNOWN`,
 * nhưng helper này giúp toast revoke có message chuyên biệt khi cần.
 *
 * - `CODE_NOT_FOUND` ⇒ `admin.errors.CODE_NOT_FOUND`
 * - `CODE_REVOKED` ⇒ `admin.errors.CODE_REVOKED` (đã thu hồi trước đó — idempotent)
 * - mọi code khác ⇒ `admin.errors.UNKNOWN`
 */
export function mapGiftcodeRevokeErrorKey(code: string | undefined): string {
  if (!code) return 'admin.errors.UNKNOWN';
  if (code === 'CODE_NOT_FOUND') return 'admin.errors.CODE_NOT_FOUND';
  if (code === 'CODE_REVOKED') return 'admin.errors.CODE_REVOKED';
  return 'admin.errors.UNKNOWN';
}
