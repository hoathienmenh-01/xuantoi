import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { MailError, MailService } from './mail.service';
import {
  TEST_DATABASE_URL,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let mail: MailService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const inventory = new InventoryService(prisma, realtime, chars);
  mail = new MailService(prisma, currency, inventory, realtime);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

describe('MailService.sendToCharacter', () => {
  it('tạo thư và lấy được từ inbox', async () => {
    const u = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'Chúc mừng',
      body: 'Bước chân đầu tiên.',
      rewardLinhThach: 500n,
    });
    expect(sent.subject).toBe('Chúc mừng');
    expect(sent.claimable).toBe(true);
    expect(sent.rewardLinhThach).toBe('500');

    const inbox = await mail.inbox(u.userId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].id).toBe(sent.id);
    expect(inbox[0].readAt).toBeNull();
    expect(inbox[0].claimedAt).toBeNull();
  });

  it('từ chối recipient không tồn tại', async () => {
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: 'ghost_id_not_exist',
        subject: 'x',
        body: 'y',
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'RECIPIENT_NOT_FOUND',
    );
  });

  it('từ chối subject rỗng / body rỗng / reward âm', async () => {
    const u = await makeUserChar(prisma);
    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: '',
        body: 'y',
      }),
    ).rejects.toSatisfy((e) => e instanceof MailError && e.code === 'INVALID_INPUT');

    await expect(
      mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: 'x',
        body: 'y',
        rewardTienNgoc: -5,
      }),
    ).rejects.toSatisfy((e) => e instanceof MailError && e.code === 'INVALID_INPUT');
  });
});

describe('MailService.broadcast', () => {
  it('tạo thư cho tất cả nhân vật', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    const c = await makeUserChar(prisma);
    const count = await mail.broadcast({
      subject: 'Sự kiện',
      body: 'Tất cả đạo hữu nhận 100 linh thạch.',
      rewardLinhThach: 100n,
    });
    expect(count).toBe(3);

    for (const u of [a, b, c]) {
      const inbox = await mail.inbox(u.userId);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].subject).toBe('Sự kiện');
    }
  });

  it('không tạo thư khi không có nhân vật', async () => {
    const count = await mail.broadcast({
      subject: 'Không ai',
      body: 'Void.',
    });
    expect(count).toBe(0);
  });
});

describe('MailService.markRead', () => {
  it('set readAt lần đầu, idempotent lần sau', async () => {
    const u = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body: 'b',
    });
    const r1 = await mail.markRead(u.userId, sent.id);
    expect(r1.readAt).not.toBeNull();
    const r2 = await mail.markRead(u.userId, sent.id);
    expect(r2.readAt).toBe(r1.readAt);
  });

  it('throw MAIL_NOT_FOUND nếu id sai hoặc không thuộc user', async () => {
    const u = await makeUserChar(prisma);
    const other = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: other.characterId,
      subject: 's',
      body: 'b',
    });
    await expect(mail.markRead(u.userId, sent.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'MAIL_NOT_FOUND',
    );
  });
});

describe('MailService.claim', () => {
  it('trao linhThach + tienNgoc + exp + item, ghi ledger, set claimedAt', async () => {
    const u = await makeUserChar(prisma, { linhThach: 0n, tienNgoc: 0 });
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'Thưởng',
      body: 'Hậu hỉ.',
      rewardLinhThach: 1000n,
      rewardTienNgoc: 50,
      rewardExp: 200n,
      rewardItems: [{ itemKey: 'huyet_chi_dan', qty: 3 }],
    });
    const claimed = await mail.claim(u.userId, sent.id);
    expect(claimed.claimedAt).not.toBeNull();
    expect(claimed.claimable).toBe(false);

    const char = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
    });
    expect(char.linhThach).toBe(1000n);
    expect(char.tienNgoc).toBe(50);
    expect(char.exp).toBe(200n);

    const inv = await prisma.inventoryItem.findMany({
      where: { characterId: u.characterId },
    });
    expect(inv).toHaveLength(1);
    expect(inv[0].itemKey).toBe('huyet_chi_dan');
    expect(inv[0].qty).toBe(3);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId, reason: 'MAIL_CLAIM' },
    });
    expect(ledger.length).toBe(2);
  });

  it('ALREADY_CLAIMED lần 2 — CAS ngăn double-claim', async () => {
    const u = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body: 'b',
      rewardLinhThach: 100n,
    });
    await mail.claim(u.userId, sent.id);
    await expect(mail.claim(u.userId, sent.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'ALREADY_CLAIMED',
    );
  });

  it('NO_REWARD khi thư không có reward nào', async () => {
    const u = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'Thông báo',
      body: 'Chỉ là tin tức, không có quà.',
    });
    await expect(mail.claim(u.userId, sent.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'NO_REWARD',
    );
  });

  it('MAIL_EXPIRED khi expiresAt đã qua', async () => {
    const u = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's',
      body: 'b',
      rewardLinhThach: 50n,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(mail.claim(u.userId, sent.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'MAIL_EXPIRED',
    );
  });

  it('MAIL_NOT_FOUND khi user không sở hữu', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    const sent = await mail.sendToCharacter({
      recipientCharacterId: a.characterId,
      subject: 's',
      body: 'b',
      rewardLinhThach: 100n,
    });
    await expect(mail.claim(b.userId, sent.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'MAIL_NOT_FOUND',
    );
  });
});

describe('MailService.inbox', () => {
  it('NO_CHARACTER nếu user chưa tạo nhân vật', async () => {
    const userRow = await prisma.user.create({
      data: { email: 'nochar@xt.local', passwordHash: 'x' },
    });
    await expect(mail.inbox(userRow.id)).rejects.toSatisfy(
      (e) => e instanceof MailError && e.code === 'NO_CHARACTER',
    );
  });

  it('trả về thư theo thứ tự desc createdAt, giới hạn 100 thư', async () => {
    const u = await makeUserChar(prisma);
    for (let i = 0; i < 5; i++) {
      await mail.sendToCharacter({
        recipientCharacterId: u.characterId,
        subject: `T${i}`,
        body: 'b',
      });
    }
    const inbox = await mail.inbox(u.userId);
    expect(inbox).toHaveLength(5);
    // Desc: thư mới nhất đầu tiên.
    expect(inbox[0].subject).toBe('T4');
    expect(inbox[4].subject).toBe('T0');
  });
});
