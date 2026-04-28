import { describe, expect, it } from 'vitest';
import type { MissionProgressFramePayload } from '@xuantoi/shared';
import { applyMissionProgressFrame } from '../missionProgress';
import type { MissionProgressView } from '@/api/mission';

function mkMission(
  partial: Partial<MissionProgressView> & { key: string },
): MissionProgressView {
  return {
    key: partial.key,
    name: partial.name ?? partial.key,
    description: '',
    period: partial.period ?? 'DAILY',
    goalKind: 'CULTIVATE_SECONDS',
    goalAmount: partial.goalAmount ?? 600,
    currentAmount: partial.currentAmount ?? 0,
    claimed: partial.claimed ?? false,
    completable: partial.completable ?? false,
    windowEnd: null,
    rewards: { linhThach: 50 },
    quality: 'PHAM',
  };
}

const FRAME = (
  changes: MissionProgressFramePayload['changes'],
): MissionProgressFramePayload => ({
  characterId: 'char-1',
  changes,
});

describe('applyMissionProgressFrame', () => {
  it('cập nhật currentAmount + completable cho mission match key', () => {
    const cur = [
      mkMission({ key: 'daily_cultivate_600s', currentAmount: 100 }),
      mkMission({ key: 'weekly_cultivate_18000s', currentAmount: 100, period: 'WEEKLY' }),
    ];
    const next = applyMissionProgressFrame(
      cur,
      FRAME([
        {
          missionKey: 'daily_cultivate_600s',
          period: 'DAILY',
          currentAmount: 400,
          goalAmount: 600,
          completable: false,
        },
      ]),
    );
    expect(next[0].currentAmount).toBe(400);
    expect(next[1].currentAmount).toBe(100); // không match → giữ
    expect(next).not.toBe(cur); // immutable
  });

  it('completable = true đẩy mission lên trạng thái sẵn sàng claim', () => {
    const cur = [
      mkMission({ key: 'daily_cultivate_600s', currentAmount: 500 }),
    ];
    const next = applyMissionProgressFrame(
      cur,
      FRAME([
        {
          missionKey: 'daily_cultivate_600s',
          period: 'DAILY',
          currentAmount: 600,
          goalAmount: 600,
          completable: true,
        },
      ]),
    );
    expect(next[0].currentAmount).toBe(600);
    expect(next[0].completable).toBe(true);
  });

  it('không lùi currentAmount khi frame stale (server invariant guard)', () => {
    const cur = [mkMission({ key: 'k', currentAmount: 500 })];
    const next = applyMissionProgressFrame(
      cur,
      FRAME([
        {
          missionKey: 'k',
          period: 'DAILY',
          currentAmount: 200,
          goalAmount: 600,
          completable: false,
        },
      ]),
    );
    // Stale frame có cùng completable → return ngay current, không mutate.
    expect(next).toBe(cur);
  });

  it('claimed=true → completable không bị bật lại bởi frame', () => {
    const cur = [
      mkMission({
        key: 'k',
        currentAmount: 600,
        claimed: true,
        completable: false,
      }),
    ];
    const next = applyMissionProgressFrame(
      cur,
      FRAME([
        {
          missionKey: 'k',
          period: 'DAILY',
          currentAmount: 600,
          goalAmount: 600,
          completable: true,
        },
      ]),
    );
    expect(next[0].claimed).toBe(true);
    expect(next[0].completable).toBe(false);
  });

  it('frame.changes rỗng → return cùng reference (no-op)', () => {
    const cur = [mkMission({ key: 'k', currentAmount: 100 })];
    const next = applyMissionProgressFrame(cur, FRAME([]));
    expect(next).toBe(cur);
  });

  it('mission key không tồn tại trong list → bỏ qua, không tạo mới', () => {
    const cur = [mkMission({ key: 'k', currentAmount: 100 })];
    const next = applyMissionProgressFrame(
      cur,
      FRAME([
        {
          missionKey: 'unknown_key',
          period: 'DAILY',
          currentAmount: 999,
          goalAmount: 1000,
          completable: false,
        },
      ]),
    );
    expect(next).toBe(cur);
    expect(next.length).toBe(1);
  });
});
