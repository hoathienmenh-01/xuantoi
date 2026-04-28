/**
 * Queue + scheduler constants cho mission reset (DAILY / WEEKLY).
 *
 * Dùng BullMQ để chạy cron ngầm, tận dụng Redis đã có (không cần
 * @nestjs/schedule — tránh 2 worker process chạy cron trùng).
 *
 * - DAILY: quét mỗi 10 phút, reset các row có `windowEnd <= now`. Interval
 *   nhỏ hơn 1 ngày để bù trừ khi server start trễ so với 00:00 UTC.
 * - WEEKLY: cùng processor, chỉ khác period.
 */
export const MISSION_QUEUE = 'mission-reset';

/** 10 phút — resolution đủ nhỏ để người chơi không phải đợi cửa sổ mới quá lâu. */
export const MISSION_RESET_INTERVAL_MS = 10 * 60 * 1000;
