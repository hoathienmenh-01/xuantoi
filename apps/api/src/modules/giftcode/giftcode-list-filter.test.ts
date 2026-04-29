import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { GiftCodeService } from './giftcode.service';
import { TEST_DATABASE_URL, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let gift: GiftCodeService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const inventory = new InventoryService(prisma, realtime, chars);
  gift = new GiftCodeService(prisma, currency, inventory);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

async function seedFixtures() {
  // Active vĩnh viễn
  await gift.create({ code: 'WELCOME', rewardLinhThach: 100n });
  // Active có maxRedeems chưa cạn
  await gift.create({ code: 'PROMO_A', rewardLinhThach: 100n, maxRedeems: 100 });
  // Đã hết hạn (expiresAt < now)
  await gift.create({
    code: 'EXPIRED_X',
    rewardLinhThach: 50n,
    expiresAt: new Date(Date.now() - 24 * 3_600_000),
  });
  // Đã exhaust: bump redeemCount = maxRedeems
  const exhaust = await gift.create({
    code: 'BURNED',
    rewardLinhThach: 10n,
    maxRedeems: 1,
  });
  await prisma.giftCode.update({
    where: { id: exhaust.id },
    data: { redeemCount: 1 },
  });
  // Revoked
  await gift.create({ code: 'BANNED', rewardLinhThach: 10n });
  await gift.revoke('BANNED');
}

describe('GiftCodeService.list filter', () => {
  it('không filter → trả tất cả 5 mã, sắp theo createdAt desc', async () => {
    await seedFixtures();
    const rows = await gift.list(100);
    expect(rows.length).toBe(5);
    // Code mới nhất tạo cuối → đứng đầu (BANNED revoke không tạo row mới).
    expect(rows[0].code).toBe('BANNED');
  });

  it('filter q="prom" (case-insensitive) → chỉ PROMO_A', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { q: 'prom' });
    expect(rows.map((r) => r.code)).toEqual(['PROMO_A']);
  });

  it('filter status=ACTIVE → loại expired/revoked/exhaust → còn WELCOME + PROMO_A', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { status: 'ACTIVE' });
    const codes = rows.map((r) => r.code).sort();
    expect(codes).toEqual(['PROMO_A', 'WELCOME']);
  });

  it('filter status=REVOKED → chỉ BANNED', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { status: 'REVOKED' });
    expect(rows.map((r) => r.code)).toEqual(['BANNED']);
  });

  it('filter status=EXPIRED → chỉ EXPIRED_X', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { status: 'EXPIRED' });
    expect(rows.map((r) => r.code)).toEqual(['EXPIRED_X']);
  });

  it('filter status=EXHAUSTED → chỉ BURNED (redeemCount === maxRedeems)', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { status: 'EXHAUSTED' });
    expect(rows.map((r) => r.code)).toEqual(['BURNED']);
  });

  it('combine q="prom" + status=ACTIVE → PROMO_A', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { q: 'prom', status: 'ACTIVE' });
    expect(rows.map((r) => r.code)).toEqual(['PROMO_A']);
  });

  it('combine q="burn" + status=EXHAUSTED → BURNED (regression test Devin Review #74)', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { q: 'burn', status: 'EXHAUSTED' });
    expect(rows.map((r) => r.code)).toEqual(['BURNED']);
  });

  it('combine q="welcome" + status=EXHAUSTED → 0 (q filter áp vào EXHAUSTED branch)', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { q: 'welcome', status: 'EXHAUSTED' });
    expect(rows.length).toBe(0);
  });

  it('combine q="zzz_no_match" → 0 rows', async () => {
    await seedFixtures();
    const rows = await gift.list(100, { q: 'zzz_no_match' });
    expect(rows.length).toBe(0);
  });
});
