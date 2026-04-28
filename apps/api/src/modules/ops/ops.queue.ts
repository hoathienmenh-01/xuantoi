/**
 * Hàng đợi ops — các cron bảo trì dữ liệu chạy ngầm (prune log, token, ...).
 * Chạy qua BullMQ để tận dụng Redis đã có. Không dùng @nestjs/schedule để
 * không cần thêm dep mới + tránh 2 character process chạy cron trùng.
 */
export const OPS_QUEUE = 'ops';

/**
 * Cách nhau 24h — đủ ít để không đè performance, đủ nhiều để giảm áp lực
 * DB (LoginAttempt + RefreshToken tăng dần nhưng không quá nhanh).
 */
export const OPS_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Ngưỡng TTL:
 *  - LoginAttempt: audit trail cho brute-force, không cần giữ quá 90 ngày.
 *  - RefreshToken: đã revoke/expire > 30 ngày chắc chắn không còn dùng.
 *  - CurrencyLedger: KHÔNG prune — audit trail tiền, giữ vĩnh viễn.
 *  - AdminAuditLog: KHÔNG prune — yêu cầu pháp lý/ops.
 *  - ChatMessage: KHÔNG prune — scope phase sau (retention tùy policy).
 */
export const LOGIN_ATTEMPT_TTL_DAYS = 90;
export const REFRESH_TOKEN_STALE_TTL_DAYS = 30;
