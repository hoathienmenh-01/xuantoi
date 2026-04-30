/**
 * Pure-unit tests cho `MissionScheduler.onModuleInit` — ghost cleanup +
 * recurring add cho BullMQ mission-reset queue (`reset` job).
 *
 * Lock-in invariants quan trọng:
 *   - Trước khi add lại job, MỌI repeatable job tên 'reset' cũ phải bị
 *     `removeRepeatableByKey(key)` (tránh ghost khi đổi interval / hot-reload).
 *   - Repeatable job khác tên (vd 'prune') KHÔNG bị xoá nhầm.
 *   - `add('reset', {}, { repeat: { every: MISSION_RESET_INTERVAL_MS } })`
 *     được gọi đúng 1 lần với constant interval từ mission.queue.
 *   - `removeOnComplete/removeOnFail` cap = 10 (không tích log vô hạn).
 *
 * Mocked Queue (no Redis), pure-unit, chạy không cần `infra:up`.
 */
import { describe, expect, it, vi } from 'vitest';
import { MissionScheduler } from './mission.scheduler';
import { MISSION_RESET_INTERVAL_MS } from './mission.queue';

type RepeatableJob = { name: string; key: string };

interface FakeQueue {
  getRepeatableJobs: ReturnType<typeof vi.fn>;
  removeRepeatableByKey: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
}

function makeFakeQueue(opts?: {
  existing?: RepeatableJob[];
}): FakeQueue {
  const existing = opts?.existing ?? [];
  return {
    getRepeatableJobs: vi.fn().mockResolvedValue(existing),
    removeRepeatableByKey: vi.fn().mockResolvedValue(true),
    add: vi.fn().mockResolvedValue({ id: 'fake-job-id' }),
  };
}

function makeScheduler(queue: FakeQueue): MissionScheduler {
  return new MissionScheduler(
    queue as unknown as Parameters<typeof MissionScheduler>[0],
  );
}

describe('MissionScheduler.onModuleInit', () => {
  it('queue rỗng: chỉ gọi add("reset", ...) với interval từ mission.queue', async () => {
    const q = makeFakeQueue();
    const svc = makeScheduler(q);
    await svc.onModuleInit();
    expect(q.getRepeatableJobs).toHaveBeenCalledOnce();
    expect(q.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(q.add).toHaveBeenCalledOnce();
    const [name, payload, opts] = q.add.mock.calls[0];
    expect(name).toBe('reset');
    expect(payload).toEqual({});
    expect(opts).toMatchObject({
      repeat: { every: MISSION_RESET_INTERVAL_MS },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    });
  });

  it('có 1 reset cũ: removeRepeatableByKey gọi với key cũ trước add', async () => {
    const q = makeFakeQueue({
      existing: [{ name: 'reset', key: 'reset::repeat-key-old' }],
    });
    const svc = makeScheduler(q);
    await svc.onModuleInit();
    expect(q.removeRepeatableByKey).toHaveBeenCalledOnce();
    expect(q.removeRepeatableByKey).toHaveBeenCalledWith(
      'reset::repeat-key-old',
    );
    expect(q.add).toHaveBeenCalledOnce();
    // Order: getRepeatableJobs → removeRepeatableByKey → add
    const callOrder = [
      ...q.getRepeatableJobs.mock.invocationCallOrder,
      ...q.removeRepeatableByKey.mock.invocationCallOrder,
      ...q.add.mock.invocationCallOrder,
    ];
    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it('có nhiều reset cũ: removeRepeatableByKey gọi cho TẤT CẢ', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'reset', key: 'reset::k1' },
        { name: 'reset', key: 'reset::k2' },
        { name: 'reset', key: 'reset::k3' },
      ],
    });
    const svc = makeScheduler(q);
    await svc.onModuleInit();
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(3);
    const keys = q.removeRepeatableByKey.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(['reset::k1', 'reset::k2', 'reset::k3']);
  });

  it('repeatable khác tên (vd "prune", "other") KHÔNG bị xoá nhầm', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'prune', key: 'prune::shared' },
        { name: 'other', key: 'other::x' },
      ],
    });
    const svc = makeScheduler(q);
    await svc.onModuleInit();
    expect(q.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(q.add).toHaveBeenCalledOnce();
  });

  it('mix reset + non-reset: chỉ xoá reset', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'reset', key: 'reset::old' },
        { name: 'prune', key: 'prune::shared' },
        { name: 'reset', key: 'reset::older' },
      ],
    });
    const svc = makeScheduler(q);
    await svc.onModuleInit();
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    const keys = q.removeRepeatableByKey.mock.calls.map((c) => c[0]);
    expect(keys.sort()).toEqual(['reset::old', 'reset::older'].sort());
  });

  it('MISSION_RESET_INTERVAL_MS đúng = 10 phút', () => {
    expect(MISSION_RESET_INTERVAL_MS).toBe(10 * 60 * 1000);
  });
});
