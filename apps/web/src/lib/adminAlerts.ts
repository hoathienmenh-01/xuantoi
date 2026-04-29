import type { AdminEconomyAlerts } from '@/api/admin';

/**
 * Đếm tổng số cảnh báo kinh tế hiện tại từ payload `/admin/economy/alerts`.
 *
 * Combines: `negativeCurrency` (character có currency âm), `negativeInventory`
 * (inventory item qty < 1), `stalePendingTopups` (topup PENDING quá staleHours).
 * Trả về 0 nếu `alerts` là null/undefined (lỗi fetch hoặc chưa load).
 *
 * Dùng cho red dot badge trên nav button Stats trong AdminView.
 */
export function countEconomyAlerts(alerts: AdminEconomyAlerts | null | undefined): number {
  if (!alerts) return 0;
  return (
    alerts.negativeCurrency.length +
    alerts.negativeInventory.length +
    alerts.stalePendingTopups.length
  );
}

/**
 * Phân loại mức độ cảnh báo theo số lượng — dùng cho color của badge:
 * - 0       → 'none' (không hiện)
 * - 1..2    → 'low'  (hơi đáng chú ý)
 * - 3..9    → 'medium' (đáng chú ý)
 * - >= 10   → 'high'  (cần xử lý ngay)
 */
export type AlertSeverity = 'none' | 'low' | 'medium' | 'high';

export function alertSeverity(count: number): AlertSeverity {
  if (count <= 0) return 'none';
  if (count <= 2) return 'low';
  if (count <= 9) return 'medium';
  return 'high';
}
