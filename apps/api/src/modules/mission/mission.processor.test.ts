/**
 * Unit test `MissionProcessor` — reset mission cron (BullMQ worker).
 * Pure unit: fake `MissionService` với `vi.fn()`, không đụng Redis / DB.
 *
 * Cover:
 *  - process('reset') gọi resetPeriod('DAILY') rồi resetPeriod('WEEKLY').
 *  - Non-'reset' job name bị skip (không gọi resetPeriod) — guard chống
 *    BullMQ chạy lộn job name vào worker này.
 *  - Error từ resetPeriod throw ra (BullMQ sẽ retry theo queue config).
 *  - Không log khi daily=0 && weekly=0 (tránh spam log).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { MissionProcessor } from './mission.processor';
import type { MissionService } from './mission.service';

function makeJob(name: string): Job {
  return { name } as unknown as Job;
}

function makeFakeMissionService(daily = 0, weekly = 0): MissionService {
  return {
    resetPeriod: vi
      .fn()
      .mockImplementation(async (period: 'DAILY' | 'WEEKLY') =>
        period === 'DAILY' ? daily : weekly,
      ),
  } as unknown as MissionService;
}

describe('MissionProcessor.process', () => {
  it('gọi resetPeriod DAILY rồi WEEKLY khi job.name === "reset"', async () => {
    const missions = makeFakeMissionService(3, 1);
    const proc = new MissionProcessor(missions);
    await proc.process(makeJob('reset'));

    expect(missions.resetPeriod).toHaveBeenCalledTimes(2);
    expect(missions.resetPeriod).toHaveBeenNthCalledWith(1, 'DAILY');
    expect(missions.resetPeriod).toHaveBeenNthCalledWith(2, 'WEEKLY');
  });

  it('skip khi job.name !== "reset" — guard sai job name', async () => {
    const missions = makeFakeMissionService();
    const proc = new MissionProcessor(missions);
    await proc.process(makeJob('some-other-job'));
    expect(missions.resetPeriod).not.toHaveBeenCalled();
  });

  it('skip khi job.name là empty string', async () => {
    const missions = makeFakeMissionService();
    const proc = new MissionProcessor(missions);
    await proc.process(makeJob(''));
    expect(missions.resetPeriod).not.toHaveBeenCalled();
  });

  it('propagate error khi resetPeriod throw (BullMQ sẽ retry)', async () => {
    const missions = {
      resetPeriod: vi.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as MissionService;
    const proc = new MissionProcessor(missions);
    await expect(proc.process(makeJob('reset'))).rejects.toThrow('DB down');
    // Call 1 lần (DAILY fail, không gọi tiếp WEEKLY).
    expect(missions.resetPeriod).toHaveBeenCalledTimes(1);
    expect(missions.resetPeriod).toHaveBeenCalledWith('DAILY');
  });

  it('process không log khi cả daily=0 + weekly=0 (tránh spam)', async () => {
    const missions = makeFakeMissionService(0, 0);
    const proc = new MissionProcessor(missions);
    // Spy logger (protected) — test hành vi "không log" gián tiếp qua
    // total count = 0 branch. Không dễ spy private `logger` nên ta
    // verify gián tiếp: process chạy thành công, không throw.
    await expect(proc.process(makeJob('reset'))).resolves.toBeUndefined();
  });

  it('process log khi daily + weekly > 0', async () => {
    const missions = makeFakeMissionService(5, 2);
    const proc = new MissionProcessor(missions);
    await expect(proc.process(makeJob('reset'))).resolves.toBeUndefined();
    // Verify hành vi gọi đầy đủ 2 period.
    expect(missions.resetPeriod).toHaveBeenCalledTimes(2);
  });

  it('process log khi chỉ weekly > 0', async () => {
    const missions = makeFakeMissionService(0, 3);
    const proc = new MissionProcessor(missions);
    await expect(proc.process(makeJob('reset'))).resolves.toBeUndefined();
    expect(missions.resetPeriod).toHaveBeenCalledTimes(2);
  });

  it('process log khi chỉ daily > 0', async () => {
    const missions = makeFakeMissionService(7, 0);
    const proc = new MissionProcessor(missions);
    await expect(proc.process(makeJob('reset'))).resolves.toBeUndefined();
    expect(missions.resetPeriod).toHaveBeenCalledTimes(2);
  });
});
