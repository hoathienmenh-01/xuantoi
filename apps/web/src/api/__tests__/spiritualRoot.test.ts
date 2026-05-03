import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (k: string) => k,
    },
  },
}));

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: getMock,
    post: postMock,
  },
}));

import {
  getSpiritualRootState,
  rerollSpiritualRoot,
} from '@/api/spiritualRoot';

const STUB_STATE = {
  grade: 'linh',
  primaryElement: 'kim',
  secondaryElements: ['moc'],
  purity: 88,
  rerollCount: 0,
};

describe('api/spiritualRoot — Phase 11.3.D client', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('getSpiritualRootState: GET /character/spiritual-root, parse envelope', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: { spiritualRoot: STUB_STATE },
      },
    });
    const out = await getSpiritualRootState();
    expect(getMock).toHaveBeenCalledWith('/character/spiritual-root');
    expect(out).toEqual(STUB_STATE);
  });

  it('getSpiritualRootState: server error → throws error preserving code', async () => {
    getMock.mockResolvedValueOnce({
      data: { ok: false, error: { code: 'NO_CHARACTER', message: 'no char' } },
    });
    await expect(getSpiritualRootState()).rejects.toMatchObject({
      code: 'NO_CHARACTER',
    });
  });

  it('getSpiritualRootState: empty data → throws fallback error', async () => {
    getMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(getSpiritualRootState()).rejects.toBeInstanceOf(Error);
  });

  it('rerollSpiritualRoot: POST /character/spiritual-root/reroll (no body)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          spiritualRoot: { ...STUB_STATE, grade: 'huyen', rerollCount: 1 },
        },
      },
    });
    const out = await rerollSpiritualRoot();
    expect(postMock).toHaveBeenCalledWith('/character/spiritual-root/reroll');
    expect(out.grade).toBe('huyen');
    expect(out.rerollCount).toBe(1);
  });

  it('rerollSpiritualRoot: ok=false LINH_CAN_DAN_INSUFFICIENT → throws preserving code', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'LINH_CAN_DAN_INSUFFICIENT', message: 'no pill' },
      },
    });
    await expect(rerollSpiritualRoot()).rejects.toMatchObject({
      code: 'LINH_CAN_DAN_INSUFFICIENT',
    });
  });

  it('rerollSpiritualRoot: empty data → throws fallback error', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });
    await expect(rerollSpiritualRoot()).rejects.toBeInstanceOf(Error);
  });
});
