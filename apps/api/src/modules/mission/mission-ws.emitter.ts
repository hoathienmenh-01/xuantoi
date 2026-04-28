import { Injectable } from '@nestjs/common';
import {
  MISSION_PROGRESS_PUSH_THROTTLE_MS,
  type MissionProgressFramePayload,
} from '@xuantoi/shared';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Throttled push cho event `mission:progress`. Mỗi user nhận tối đa 1 frame
 * trong cửa sổ {@link MISSION_PROGRESS_PUSH_THROTTLE_MS}; frame trong cửa
 * sổ bị **drop** (best-effort). Lý do drop thay vì coalesce-flush:
 *  1. Lần track tiếp theo sẽ gửi snapshot mới nhất.
 *  2. FE có thể luôn fallback `GET /mission/list` để chốt lại nếu cần.
 *  3. Tránh tạo timer thường trú trong service không có lifecycle quản lý.
 *
 * `now()` có thể inject để test dễ mock thời gian (không cần fake-timers).
 */
@Injectable()
export class MissionWsEmitter {
  private readonly lastEmitMs = new Map<string, number>();

  constructor(
    private readonly realtime: RealtimeService,
    private readonly throttleMs: number = MISSION_PROGRESS_PUSH_THROTTLE_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * @returns `true` nếu frame được emit, `false` nếu bị drop bởi throttle.
   *           (Public để test assert dễ dàng.)
   */
  pushProgress(userId: string, payload: MissionProgressFramePayload): boolean {
    if (payload.changes.length === 0) return false;
    const t = this.now();
    const last = this.lastEmitMs.get(userId) ?? 0;
    if (t - last < this.throttleMs) return false;
    this.lastEmitMs.set(userId, t);
    this.realtime.emitToUser(userId, 'mission:progress', payload);
    return true;
  }

  /** Test-only: xoá state throttle giữa các test case. */
  reset(): void {
    this.lastEmitMs.clear();
  }
}
