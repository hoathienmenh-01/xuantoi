/**
 * Pure-unit tests cho `OpsService.scheduleRecurring` — ghost cleanup +
 * recurring add cho BullMQ ops queue (`prune` job).
 *
 * Lock-in invariants quan trọng:
 *   - Trước khi add lại job, MỌI repeatable job tên 'prune' cũ phải bị
 *     `removeRepeatableByKey(key)` (tránh ghost khi đổi interval / hot-reload).
 *   - Repeatable job khác tên (vd 'reset' chia sẻ queue cũ) KHÔNG bị xoá nhầm.
 *   - `add('prune', {}, { repeat: { every: OPS_PRUNE_INTERVAL_MS } })` được
 *     gọi đúng 1 lần với constant interval từ ops.queue.
 *   - `removeOnComplete/removeOnFail` cap = 10 (không tích log vô hạn).
 *
 * Mocked Queue (no Redis), pure-unit, chạy không cần `infra:up`.
 */
import { describe, expect, it, vi } from 'vitest';
import { OpsService } from './ops.service';
import { OPS_PRUNE_INTERVAL_MS } from './ops.queue';

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

function makeService(queue: FakeQueue): OpsService {
  // OpsService dùng `@InjectQueue` constructor injection — bypass DI bằng cách
  // truyền queue trực tiếp qua `as unknown as Queue`.
  return new OpsService(queue as unknown as Parameters<typeof OpsService>[0]);
}

describe('OpsService.scheduleRecurring', () => {
  it('queue rỗng: chỉ gọi add("prune", ...) đúng 1 lần với interval từ ops.queue', async () => {
    const q = makeFakeQueue();
    const svc = makeService(q);
    await svc.scheduleRecurring();
    expect(q.getRepeatableJobs).toHaveBeenCalledOnce();
    expect(q.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(q.add).toHaveBeenCalledOnce();
    const [name, payload, opts] = q.add.mock.calls[0];
    expect(name).toBe('prune');
    expect(payload).toEqual({});
    expect(opts).toMatchObject({
      repeat: { every: OPS_PRUNE_INTERVAL_MS },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    });
  });

  it('có 1 prune cũ: removeRepeatableByKey gọi với key cũ trước khi add', async () => {
    const q = makeFakeQueue({
      existing: [{ name: 'prune', key: 'prune::repeat-key-old' }],
    });
    const svc = makeService(q);
    await svc.scheduleRecurring();
    expect(q.removeRepeatableByKey).toHaveBeenCalledOnce();
    expect(q.removeRepeatableByKey).toHaveBeenCalledWith(
      'prune::repeat-key-old',
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

  it('có nhiều prune cũ: removeRepeatableByKey gọi cho TẤT CẢ', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'prune', key: 'prune::k1' },
        { name: 'prune', key: 'prune::k2' },
        { name: 'prune', key: 'prune::k3' },
      ],
    });
    const svc = makeService(q);
    await svc.scheduleRecurring();
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(3);
    const keys = q.removeRepeatableByKey.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(['prune::k1', 'prune::k2', 'prune::k3']);
  });

  it('repeatable khác tên (vd "reset", "other") KHÔNG bị xoá nhầm', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'reset', key: 'reset::shared' },
        { name: 'other', key: 'other::x' },
      ],
    });
    const svc = makeService(q);
    await svc.scheduleRecurring();
    expect(q.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(q.add).toHaveBeenCalledOnce();
  });

  it('mix prune + non-prune: chỉ xoá prune', async () => {
    const q = makeFakeQueue({
      existing: [
        { name: 'prune', key: 'prune::old' },
        { name: 'reset', key: 'reset::shared' },
        { name: 'prune', key: 'prune::older' },
      ],
    });
    const svc = makeService(q);
    await svc.scheduleRecurring();
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    const keys = q.removeRepeatableByKey.mock.calls.map((c) => c[0]);
    expect(keys.sort()).toEqual(['prune::old', 'prune::older'].sort());
  });

  it('OPS_PRUNE_INTERVAL_MS đúng = 24h', () => {
    expect(OPS_PRUNE_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
