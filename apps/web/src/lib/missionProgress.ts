import type {
  MissionProgressChange,
  MissionProgressFramePayload,
} from '@xuantoi/shared';
import type { MissionProgressView } from '@/api/mission';

/**
 * Áp một frame `mission:progress` (delta) lên danh sách mission hiện tại.
 *
 * Hành vi:
 *  - Mission không nằm trong `frame.changes` giữ nguyên.
 *  - Mission có trong `frame.changes`: cập nhật `currentAmount` + `completable`.
 *  - **Không** tạo mission mới (server đảm bảo row đã tồn tại trước khi emit).
 *  - **Không** đụng `claimed` — frame chỉ chứa progress delta, claim status do
 *    response của `POST /missions/claim` quyết định (tránh race overwrite).
 *  - `currentAmount` trong frame KHÔNG được lùi: nếu giá trị frame nhỏ hơn local
 *    (do frame stale do reorder), giữ local. Đây là invariant của server (track
 *    luôn monotonic), nhưng FE thêm guard cho an toàn.
 *  - **Stale frame guard chỉ dựa trên `currentAmount`**: nếu frame không tăng
 *    `currentAmount`, toàn bộ frame là stale — bỏ qua cả `completable`. Tránh
 *    case HTTP response (refresh/claim) đến trước WS frame cũ làm regress
 *    `completable` true → false, ẩn nút claim đến khi refresh sau.
 *
 * Trả về array MỚI (immutable update) — caller có thể gán trực tiếp vào ref.
 */
export function applyMissionProgressFrame(
  current: MissionProgressView[],
  frame: MissionProgressFramePayload,
): MissionProgressView[] {
  if (frame.changes.length === 0) return current;
  const byKey = new Map<string, MissionProgressChange>();
  for (const c of frame.changes) byKey.set(c.missionKey, c);
  let mutated = false;
  const next = current.map((m) => {
    const ch = byKey.get(m.key);
    if (!ch) return m;
    if (ch.currentAmount <= m.currentAmount) {
      return m; // No-op: stale or duplicate frame (don't trust completable either).
    }
    mutated = true;
    return {
      ...m,
      currentAmount: ch.currentAmount,
      completable: ch.completable && !m.claimed,
    };
  });
  return mutated ? next : current;
}
