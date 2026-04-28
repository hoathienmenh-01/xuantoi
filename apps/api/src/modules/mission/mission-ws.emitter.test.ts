import { describe, expect, it, vi } from 'vitest';
import { RealtimeService } from '../realtime/realtime.service';
import { MissionWsEmitter } from './mission-ws.emitter';

/**
 * Đơn vị test cho `MissionWsEmitter` — đảm bảo throttle 500ms hoạt động:
 *  1. Lần đầu emit qua → ra event.
 *  2. Lần thứ 2 trong cửa sổ throttle → drop.
 *  3. Lần thứ 3 sau cửa sổ → ra event.
 *  4. Mỗi user có throttle độc lập (không drop chéo).
 *  5. payload.changes rỗng → drop sớm (không gọi RealtimeService).
 */

function makeEmitter(throttleMs: number, clock: { t: number }) {
  const realtime = new RealtimeService();
  const spy = vi.spyOn(realtime, 'emitToUser').mockImplementation(() => {});
  const emitter = new MissionWsEmitter(realtime, throttleMs, () => clock.t);
  return { emitter, spy };
}

const PAYLOAD = {
  characterId: 'char-1',
  changes: [
    {
      missionKey: 'daily_cultivate_300s',
      period: 'DAILY',
      currentAmount: 50,
      goalAmount: 300,
      completable: false,
    },
  ],
};

describe('MissionWsEmitter — throttle hành vi', () => {
  it('lần đầu push → emit ra RealtimeService', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('user-1', 'mission:progress', PAYLOAD);
  });

  it('lần thứ 2 trong cửa sổ throttle → bị drop', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    emitter.pushProgress('user-1', PAYLOAD);
    clock.t += 100; // 100ms < 500ms.
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(false);
    clock.t += 100; // 200ms total, vẫn trong window.
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('sau khi qua window → emit lại', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    emitter.pushProgress('user-1', PAYLOAD);
    clock.t += 600; // qua window 500ms.
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throttle độc lập theo userId — user khác không bị chặn chéo', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    expect(emitter.pushProgress('user-A', PAYLOAD)).toBe(true);
    clock.t += 100;
    // user-A bị throttle, nhưng user-B chưa từng emit → vẫn được.
    expect(emitter.pushProgress('user-A', PAYLOAD)).toBe(false);
    expect(emitter.pushProgress('user-B', PAYLOAD)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'user-A', 'mission:progress', PAYLOAD);
    expect(spy).toHaveBeenNthCalledWith(2, 'user-B', 'mission:progress', PAYLOAD);
  });

  it('payload.changes rỗng → drop ngay, KHÔNG gọi RealtimeService', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    expect(
      emitter.pushProgress('user-1', { characterId: 'c', changes: [] }),
    ).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('reset() cho phép emit lại ngay (test-only API)', () => {
    const clock = { t: 1_000_000 };
    const { emitter, spy } = makeEmitter(500, clock);
    emitter.pushProgress('user-1', PAYLOAD);
    clock.t += 100;
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(false);
    emitter.reset();
    expect(emitter.pushProgress('user-1', PAYLOAD)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
