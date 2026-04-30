/**
 * Pure unit tests for CultivationService — no Redis, no BullMQ.
 * Mocks Queue to verify scheduleRecurring logic.
 */
import { describe, expect, it, vi } from 'vitest';
import { CULTIVATION_TICK_MS } from '@xuantoi/shared';
import { CultivationService } from './cultivation.service';

interface FakeQueue {
  getRepeatableJobs: ReturnType<typeof vi.fn>;
  removeRepeatableByKey: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
}

function makeDeps() {
  const queue: FakeQueue = {
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({}),
  };
  // CultivationService uses @InjectQueue — we bypass DI and set queue directly
  const service = new (CultivationService as unknown as {
    new (queue: FakeQueue): CultivationService;
  })(queue);
  return { queue, service };
}

describe('CultivationService.scheduleRecurring', () => {
  it('removes existing tick repeatable jobs before adding new one', async () => {
    const { queue, service } = makeDeps();
    queue.getRepeatableJobs.mockResolvedValue([
      { name: 'tick', key: 'tick-key-1' },
      { name: 'tick', key: 'tick-key-2' },
      { name: 'other', key: 'other-key' },
    ]);

    await service.scheduleRecurring();

    // Only tick jobs removed, not 'other'
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('tick-key-1');
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('tick-key-2');
  });

  it('adds tick job with correct repeat interval', async () => {
    const { queue, service } = makeDeps();

    await service.scheduleRecurring();

    expect(queue.add).toHaveBeenCalledWith(
      'tick',
      {},
      expect.objectContaining({
        repeat: { every: CULTIVATION_TICK_MS },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      }),
    );
  });

  it('still adds new job when no existing repeatable jobs', async () => {
    const { queue, service } = makeDeps();
    queue.getRepeatableJobs.mockResolvedValue([]);

    await service.scheduleRecurring();

    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
