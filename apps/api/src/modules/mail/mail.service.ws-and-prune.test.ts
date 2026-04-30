/**
 * Test bổ sung cho MailService — cover 3 area cũ chưa test:
 *
 * 1. WS `mail:new` emit — `sendToCharacter` phải bắn đúng 1 frame tới
 *    recipient; `broadcast` phải bắn đến MỌI user. Cần vì FE dựa vào
 *    `mail:new` để bump badge/popup thông báo — nếu emit sai (typo event
 *    name, payload thiếu `hasReward`) → thư vào inbox nhưng badge im ru.
 *
 * 2. `pruneExpired(olderThan)` — cron cleanup. Test rule: xoá thư đã
 *    claim lâu hơn `olderThan` + xoá thư expired mà không có reward nào
 *    (rác không giá trị). KHÔNG được xoá thư expired NHƯNG có reward
 *    chưa claim (người chơi vẫn có thể muốn xem lại).
 *
 * 3. `validateInput` edge case — subject > 120, body > 2000, rewardItems
 *    > 10, item qty <= 0, rewardExp âm. `mail.service.test.ts` cũ chỉ
 *    test subject rỗng + rewardTienNgoc âm.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { MailError, MailService } from './mail.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let realtime: RealtimeService;
let mail: MailService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const inventory = new InventoryService(prisma, realtime, chars);
  mail = new MailService(prisma, currency, inventory, realtime);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

describe('MailService WS mail:new emit', () => {
  it('sendToCharacter bắn đúng 1 frame `mail:new` tới recipient userId', async () => {
    const u = await makeUserChar(prisma);
    const spy = vi.spyOn(realtime, 'emitToUser');
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'Chúc mừng',
      body: 'Nhận thưởng đăng nhập.',
      rewardLinhThach: 500n,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const [userId, event, payload] = spy.mock.calls[0];
    expect(userId).toBe(u.userId);
    expect(event).toBe('mail:new');
    expect(payload).toMatchObject({
      mailId: sent.id,
      subject: 'Chúc mừng',
      senderName: 'Thiên Đạo Sứ Giả',
      hasReward: true,
    });
    spy.mockRestore();
  });

  it('sendToCharacter payload.hasReward = false khi không có reward', async () => {
    const u = await makeUserChar(prisma);
    const spy = vi.spyOn(realtime, 'emitToUser');
    await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'Thông báo',
      body: 'Chỉ là tin tức.',
    });
    const [, , payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ hasReward: false });
    spy.mockRestore();
  });

  it('sendToCharacter hasReward=true cho từng loại reward (linhThach / tienNgoc / exp / items)', async () => {
    const u = await makeUserChar(prisma);
    const cases = [
      { label: 'linhThach', input: { rewardLinhThach: 100n } },
      { label: 'tienNgoc', input: { rewardTienNgoc: 5 } },
      { label: 'exp', input: { rewardExp: 50n } },
      { label: 'items', input: { rewardItems: [{ itemKey: 'huyet_chi_dan', qty: 1 }] } },
    ];
    for (const c of cases) {
      const spy = vi.spyOn(realtime, 'emitToUser');
      await mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: `reward-${c.label}`,
        body: 'b',
        ...c.input,
      });
      const [, , payload] = spy.mock.calls[0];
      expect(payload).toMatchObject({ hasReward: true });
      spy.mockRestore();
    }
  });

  it('broadcast bắn `mail:new` tới MỖI user (không miss, không double)', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    const c = await makeUserChar(prisma);
    const spy = vi.spyOn(realtime, 'emitToUser');
    const count = await mail.broadcast({
      subject: 'Sự kiện',
      body: 'Tất cả nhận 100 LT.',
      rewardLinhThach: 100n,
    });
    expect(count).toBe(3);
    expect(spy).toHaveBeenCalledTimes(3);
    const userIds = spy.mock.calls.map((c) => c[0]).sort();
    expect(userIds).toEqual([a.userId, b.userId, c.userId].sort());
    // Mọi emit phải cùng event type + hasReward nhất quán.
    for (const [, event, payload] of spy.mock.calls) {
      expect(event).toBe('mail:new');
      expect(payload).toMatchObject({
        subject: 'Sự kiện',
        senderName: 'Thiên Đạo Sứ Giả',
        hasReward: true,
      });
    }
    spy.mockRestore();
  });

  it('broadcast không emit khi không có character nào', async () => {
    const spy = vi.spyOn(realtime, 'emitToUser');
    const count = await mail.broadcast({ subject: 'x', body: 'y' });
    expect(count).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('senderName custom được forward vào payload', async () => {
    const u = await makeUserChar(prisma);
    const spy = vi.spyOn(realtime, 'emitToUser');
    await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body: 'b',
      senderName: 'GM Tuyết Nguyệt',
    });
    const [, , payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ senderName: 'GM Tuyết Nguyệt' });
    spy.mockRestore();
  });
});

describe('MailService.pruneExpired', () => {
  it('xoá thư đã claim cũ hơn olderThan, giữ thư đã claim mới', async () => {
    const u = await makeUserChar(prisma);
    const oldMail = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'old',
      body: 'b',
      rewardLinhThach: 10n,
    });
    const newMail = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'new',
      body: 'b',
      rewardLinhThach: 10n,
    });
    await mail.claim(u.userId, oldMail.id);
    await mail.claim(u.userId, newMail.id);
    // Thủ công lùi claimedAt của oldMail về 7 ngày trước.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    await prisma.mail.update({
      where: { id: oldMail.id },
      data: { claimedAt: sevenDaysAgo },
    });
    // pruneExpired với ngưỡng 3 ngày → xoá oldMail, giữ newMail.
    const threshold = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const removed = await mail.pruneExpired(threshold);
    expect(removed).toBeGreaterThanOrEqual(1);
    const remaining = await prisma.mail.findMany({
      where: { recipientId: u.characterId },
      select: { id: true },
    });
    const remainingIds = remaining.map((m) => m.id);
    expect(remainingIds).not.toContain(oldMail.id);
    expect(remainingIds).toContain(newMail.id);
  });

  it('xoá thư expired mà không có reward nào (rác)', async () => {
    const u = await makeUserChar(prisma);
    const past = new Date(Date.now() - 1000);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'tin tức',
      body: 'hết hạn rồi',
      expiresAt: past,
    });
    const removed = await mail.pruneExpired(new Date(Date.now() + 60_000));
    expect(removed).toBeGreaterThanOrEqual(1);
    const exists = await prisma.mail.findUnique({ where: { id: sent.id } });
    expect(exists).toBeNull();
  });

  it('GIỮ thư expired nhưng có reward chưa claim (không phải rác, người chơi có thể khiếu nại)', async () => {
    const u = await makeUserChar(prisma);
    const past = new Date(Date.now() - 1000);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'quên claim',
      body: 'hết hạn rồi nhưng có thưởng',
      rewardLinhThach: 500n,
      expiresAt: past,
    });
    const removed = await mail.pruneExpired(new Date(Date.now() + 60_000));
    const exists = await prisma.mail.findUnique({ where: { id: sent.id } });
    expect(exists).not.toBeNull();
    // Có thể xoá thư khác (nếu có) nhưng không được xoá cái này.
    expect(removed).toBeGreaterThanOrEqual(0);
  });
});

describe('MailService.validateInput — edge cases bổ sung', () => {
  it('INVALID_INPUT khi subject > 120 ký tự', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 'a'.repeat(121),
        body: 'b',
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi body > 2000 ký tự', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'x'.repeat(2001),
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi rewardItems > 10', async () => {
    const u = await makeUserChar(prisma);
    const tooMany = Array.from({ length: 11 }, () => ({
      itemKey: 'huyet_chi_dan',
      qty: 1,
    }));
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardItems: tooMany,
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi reward item qty <= 0', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardItems: [{ itemKey: 'huyet_chi_dan', qty: 0 }],
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardItems: [{ itemKey: 'huyet_chi_dan', qty: -1 }],
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi reward item thiếu itemKey', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardItems: [{ itemKey: '', qty: 1 }],
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi rewardExp âm', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardExp: -1n,
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('INVALID_INPUT khi rewardLinhThach âm', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 's',
        body: 'b',
        rewardLinhThach: -10n,
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('broadcast cũng áp dụng validateInput', async () => {
    await expect(
      mail.broadcast({
        subject: 'a'.repeat(121),
        body: 'b',
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'INVALID_INPUT',
    );
  });

  it('subject = 120 ký tự vẫn hợp lệ (edge case ranh giới)', async () => {
    const u = await makeUserChar(prisma);
    const subject = 'a'.repeat(120);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject,
      body: 'b',
    });
    expect(sent.subject).toBe(subject);
  });

  it('body = 2000 ký tự vẫn hợp lệ', async () => {
    const u = await makeUserChar(prisma);
    const body = 'x'.repeat(2000);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body,
    });
    expect(sent.body).toBe(body);
  });

  it('rewardItems = 10 (exactly max) vẫn hợp lệ', async () => {
    const u = await makeUserChar(prisma);
    const items = Array.from({ length: 10 }, () => ({
      itemKey: 'huyet_chi_dan',
      qty: 1,
    }));
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body: 'b',
      rewardItems: items,
    });
    expect(sent.rewardItems).toHaveLength(10);
  });
});
