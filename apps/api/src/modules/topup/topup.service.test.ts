import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TopupStatus } from '@prisma/client';
import { TOPUP_PACKAGES, TOPUP_BANK_INFO } from '@xuantoi/shared';
import { PrismaService } from '../../common/prisma.service';
import { TopupService } from './topup.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let topup: TopupService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  topup = new TopupService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const PKG = TOPUP_PACKAGES[0]; // lien_xuan_50
const PKG_AMOUNT = PKG.tienNgoc + PKG.bonus;

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------
describe('TopupService.createOrder', () => {
  it('tạo order PENDING với đúng amount + transferCode format', async () => {
    const u = await makeUserChar(prisma);
    const view = await topup.createOrder(u.userId, PKG.key);

    expect(view.status).toBe('PENDING');
    expect(view.tienNgocAmount).toBe(PKG_AMOUNT);
    expect(view.priceVND).toBe(PKG.priceVND);
    expect(view.packageKey).toBe(PKG.key);
    expect(view.packageName).toBe(PKG.name);
    expect(view.transferCode).toMatch(/^TOPUP-[A-HJ-NP-Z2-9]{6}$/);
    expect(view.note).toBe('');
    expect(view.approvedAt).toBeNull();
    expect(view.approvedByEmail).toBeNull();
    expect(view.createdAt).toBeTruthy();
    // ISO8601 format
    expect(new Date(view.createdAt).toISOString()).toBe(view.createdAt);
  });

  it('mỗi gói trong TOPUP_PACKAGES đều tạo order thành công', async () => {
    // Fresh user per package to avoid MAX_PENDING_PER_USER=5 limit (6 packages)
    for (const pkg of TOPUP_PACKAGES) {
      const u = await makeUserChar(prisma);
      const view = await topup.createOrder(u.userId, pkg.key);
      expect(view.packageKey).toBe(pkg.key);
      expect(view.tienNgocAmount).toBe(pkg.tienNgoc + pkg.bonus);
      expect(view.priceVND).toBe(pkg.priceVND);
    }
  });

  it('package không tồn tại → INVALID_PACKAGE', async () => {
    const u = await makeUserChar(prisma);
    await expect(topup.createOrder(u.userId, 'no_such_pkg')).rejects.toMatchObject({
      code: 'INVALID_PACKAGE',
    });
    await expect(topup.createOrder(u.userId, '')).rejects.toMatchObject({
      code: 'INVALID_PACKAGE',
    });
  });

  it('quá 5 đơn PENDING → TOO_MANY_PENDING', async () => {
    const u = await makeUserChar(prisma);
    for (let i = 0; i < 5; i++) {
      await topup.createOrder(u.userId, PKG.key);
    }
    await expect(topup.createOrder(u.userId, PKG.key)).rejects.toMatchObject({
      code: 'TOO_MANY_PENDING',
    });
  });

  it('user khác nhau: mỗi người có limit riêng biệt', async () => {
    const u1 = await makeUserChar(prisma);
    const u2 = await makeUserChar(prisma);
    for (let i = 0; i < 5; i++) {
      await topup.createOrder(u1.userId, PKG.key);
    }
    // u1 đã đầy nhưng u2 vẫn tạo được
    const view = await topup.createOrder(u2.userId, PKG.key);
    expect(view.status).toBe('PENDING');
  });

  it('transferCode unique cho mỗi order', async () => {
    const u = await makeUserChar(prisma);
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const view = await topup.createOrder(u.userId, PKG.key);
      codes.add(view.transferCode);
    }
    expect(codes.size).toBe(5);
  });

  it('order tạo ra có DB row tương ứng (verify persistence)', async () => {
    const u = await makeUserChar(prisma);
    const view = await topup.createOrder(u.userId, PKG.key);
    const row = await prisma.topupOrder.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.userId).toBe(u.userId);
    expect(row.packageKey).toBe(PKG.key);
    expect(row.status).toBe(TopupStatus.PENDING);
    expect(row.tienNgocAmount).toBe(PKG_AMOUNT);
    expect(row.priceVND).toBe(PKG.priceVND);
  });

  it('PENDING limit tính đúng: order APPROVED/REJECTED không tính vào limit', async () => {
    const u = await makeUserChar(prisma);
    // Tạo 5 order
    const orders: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = await topup.createOrder(u.userId, PKG.key);
      orders.push(v.id);
    }
    // Limit đầy
    await expect(topup.createOrder(u.userId, PKG.key)).rejects.toMatchObject({
      code: 'TOO_MANY_PENDING',
    });

    // Admin approve 1 order → free up 1 slot
    await prisma.topupOrder.update({
      where: { id: orders[0] },
      data: { status: TopupStatus.APPROVED },
    });
    const newView = await topup.createOrder(u.userId, PKG.key);
    expect(newView.status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// listForUser
// ---------------------------------------------------------------------------
describe('TopupService.listForUser', () => {
  it('trả danh sách rỗng khi user chưa có đơn', async () => {
    const u = await makeUserChar(prisma);
    const list = await topup.listForUser(u.userId);
    expect(list).toHaveLength(0);
  });

  it('trả đúng số đơn đã tạo, sắp xếp mới nhất trước', async () => {
    const u = await makeUserChar(prisma);
    await topup.createOrder(u.userId, TOPUP_PACKAGES[0].key);
    await topup.createOrder(u.userId, TOPUP_PACKAGES[1].key);
    await topup.createOrder(u.userId, TOPUP_PACKAGES[2].key);

    const list = await topup.listForUser(u.userId);
    expect(list).toHaveLength(3);
    // Mới nhất trước (desc)
    expect(list[0].packageKey).toBe(TOPUP_PACKAGES[2].key);
    expect(list[2].packageKey).toBe(TOPUP_PACKAGES[0].key);
  });

  it('không trả đơn của user khác (isolation)', async () => {
    const u1 = await makeUserChar(prisma);
    const u2 = await makeUserChar(prisma);
    await topup.createOrder(u1.userId, PKG.key);
    await topup.createOrder(u2.userId, PKG.key);

    const list1 = await topup.listForUser(u1.userId);
    const list2 = await topup.listForUser(u2.userId);
    expect(list1).toHaveLength(1);
    expect(list2).toHaveLength(1);
    expect(list1[0].id).not.toBe(list2[0].id);
  });

  it('trả tối đa 50 đơn (pagination cap)', async () => {
    const u = await makeUserChar(prisma);
    // Phải tạo trực tiếp qua prisma vì MAX_PENDING_PER_USER = 5
    for (let i = 0; i < 55; i++) {
      await prisma.topupOrder.create({
        data: {
          userId: u.userId,
          packageKey: PKG.key,
          tienNgocAmount: PKG_AMOUNT,
          priceVND: PKG.priceVND,
          transferCode: `TOPUP-T${String(i).padStart(5, '0')}`,
          status: TopupStatus.APPROVED,
        },
      });
    }
    const list = await topup.listForUser(u.userId);
    expect(list).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// bankInfo
// ---------------------------------------------------------------------------
describe('TopupService.bankInfo', () => {
  it('trả thông tin bank đúng format', () => {
    const info = topup.bankInfo();
    expect(info).toStrictEqual(TOPUP_BANK_INFO);
    expect(info.bankName).toBeTruthy();
    expect(info.accountName).toBeTruthy();
    expect(info.accountNumber).toBeTruthy();
    expect(info.noteHint).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// toView
// ---------------------------------------------------------------------------
describe('TopupService.toView', () => {
  it('chuyển đổi DB row sang view format đúng', () => {
    const now = new Date();
    const view = topup.toView(
      {
        id: 'test-id',
        packageKey: PKG.key,
        tienNgocAmount: PKG_AMOUNT,
        priceVND: PKG.priceVND,
        transferCode: 'TOPUP-AAAAAA',
        status: TopupStatus.PENDING,
        note: '',
        createdAt: now,
        approvedAt: null,
      },
      null,
    );
    expect(view.id).toBe('test-id');
    expect(view.packageName).toBe(PKG.name);
    expect(view.createdAt).toBe(now.toISOString());
    expect(view.approvedAt).toBeNull();
    expect(view.approvedByEmail).toBeNull();
  });

  it('packageKey không tồn tại → packageName fallback to key', () => {
    const view = topup.toView(
      {
        id: 'test-id',
        packageKey: 'deleted_pkg',
        tienNgocAmount: 999,
        priceVND: 0,
        transferCode: 'TOPUP-BBBBBB',
        status: TopupStatus.APPROVED,
        note: 'test note',
        createdAt: new Date(),
        approvedAt: new Date(),
      },
      'admin@test.local',
    );
    expect(view.packageName).toBe('deleted_pkg');
    expect(view.approvedByEmail).toBe('admin@test.local');
    expect(view.approvedAt).toBeTruthy();
    expect(view.note).toBe('test note');
  });
});

// ---------------------------------------------------------------------------
// Economy safety: createOrder không thay đổi currency balance
// ---------------------------------------------------------------------------
describe('TopupService economy safety', () => {
  it('createOrder KHÔNG thay đổi tienNgoc/linhThach của character', async () => {
    const u = await makeUserChar(prisma, { tienNgoc: 100, linhThach: 500n });
    await topup.createOrder(u.userId, PKG.key);
    const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
    expect(c.tienNgoc).toBe(100);
    expect(c.linhThach).toBe(500n);
  });

  it('createOrder KHÔNG tạo CurrencyLedger entry', async () => {
    const u = await makeUserChar(prisma);
    await topup.createOrder(u.userId, PKG.key);
    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId },
    });
    expect(ledger).toHaveLength(0);
  });
});
