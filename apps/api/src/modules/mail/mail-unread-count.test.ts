import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { MailService } from './mail.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

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

describe('MailService.unreadCount (G17 — mail badge BE)', () => {
  it('inbox rỗng → 0', async () => {
    const u = await makeUserChar(prisma);
    expect(await mail.unreadCount(u.userId)).toBe(0);
  });

  it('user chưa có character → 0 (silent, không throw)', async () => {
    const fakeUser = await prisma.user.create({
      data: { email: 'no-char@xt.local', passwordHash: 'x' },
    });
    expect(await mail.unreadCount(fakeUser.id)).toBe(0);
  });

  it('chỉ đếm mail readAt=null', async () => {
    const u = await makeUserChar(prisma);
    const m1 = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's1',
      body: 'b',
    });
    await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 's2',
      body: 'b',
    });
    expect(await mail.unreadCount(u.userId)).toBe(2);
    await mail.markRead(u.userId, m1.id);
    expect(await mail.unreadCount(u.userId)).toBe(1);
  });

  it('không đếm mail đã hết hạn (expiresAt < now)', async () => {
    const u = await makeUserChar(prisma);
    await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'fresh',
      body: 'b',
    });
    // Mail expired
    const expiredMail = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'expired',
      body: 'b',
    });
    await prisma.mail.update({
      where: { id: expiredMail.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect(await mail.unreadCount(u.userId)).toBe(1);
  });

  it('mail có expiresAt=null vẫn đếm', async () => {
    const u = await makeUserChar(prisma);
    const m = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'no-exp',
      body: 'b',
    });
    await prisma.mail.update({ where: { id: m.id }, data: { expiresAt: null } });
    expect(await mail.unreadCount(u.userId)).toBe(1);
  });

  it('mail expiresAt > now vẫn đếm', async () => {
    const u = await makeUserChar(prisma);
    const m = await mail.sendToCharacter({
      recipientCharacterId: u.characterId,
      subject: 'future-exp',
      body: 'b',
    });
    await prisma.mail.update({
      where: { id: m.id },
      data: { expiresAt: new Date(Date.now() + 86400_000) },
    });
    expect(await mail.unreadCount(u.userId)).toBe(1);
  });

  it('user khác không bị tính', async () => {
    const u1 = await makeUserChar(prisma);
    const u2 = await makeUserChar(prisma);
    await mail.sendToCharacter({
      recipientCharacterId: u1.characterId,
      subject: 's',
      body: 'b',
    });
    expect(await mail.unreadCount(u1.userId)).toBe(1);
    expect(await mail.unreadCount(u2.userId)).toBe(0);
  });
});
