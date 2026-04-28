import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { NextActionService } from './next-action.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let svc: NextActionService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  svc = new NextActionService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

describe('NextActionService.forUser', () => {
  it('NO_CHARACTER khi user chưa onboard', async () => {
    const user = await prisma.user.create({
      data: { email: 'no-char@xt.local', passwordHash: 'x' },
    });
    const actions = await svc.forUser(user.id);
    expect(actions).toEqual([
      { key: 'NO_CHARACTER', priority: 1, params: {}, route: '/onboarding' },
    ]);
  });

  it('CULTIVATE_IDLE fallback khi character idle + không có gì khác', async () => {
    const fx = await makeUserChar(prisma, { cultivating: false });
    const actions = await svc.forUser(fx.userId);
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('CULTIVATE_IDLE');
    expect(actions[0].route).toBe('/');
  });

  it('không gợi ý CULTIVATE_IDLE khi đang cultivating', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    const actions = await svc.forUser(fx.userId);
    expect(actions).toHaveLength(0);
  });

  it('MISSION_CLAIMABLE khi có mission đã đạt goal nhưng chưa claim', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.missionProgress.create({
      data: {
        characterId: fx.characterId,
        missionKey: 'daily_cultivate_5min',
        period: 'DAILY',
        currentAmount: 600,
        goalAmount: 600,
        claimed: false,
      },
    });
    await prisma.missionProgress.create({
      data: {
        characterId: fx.characterId,
        missionKey: 'daily_kill_3',
        period: 'DAILY',
        currentAmount: 1,
        goalAmount: 3,
        claimed: false,
      },
    });
    const actions = await svc.forUser(fx.userId);
    expect(actions).toContainEqual({
      key: 'MISSION_CLAIMABLE',
      priority: 1,
      params: { count: 1 },
      route: '/missions',
    });
  });

  it('MAIL_UNCLAIMED ưu tiên hơn MAIL_UNREAD (chỉ render 1 hint)', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    // Mail có thưởng linh thạch, chưa claim, chưa đọc.
    await prisma.mail.create({
      data: {
        recipientId: fx.characterId,
        subject: 'Quà',
        body: 'Linh thạch',
        rewardLinhThach: 1000n,
      },
    });
    // Mail đã đọc nhưng không có thưởng — không trigger hint.
    await prisma.mail.create({
      data: {
        recipientId: fx.characterId,
        subject: 'Tin',
        body: 'Hi',
        readAt: new Date(),
      },
    });
    const actions = await svc.forUser(fx.userId);
    const keys = actions.map((a) => a.key);
    expect(keys).toContain('MAIL_UNCLAIMED');
    expect(keys).not.toContain('MAIL_UNREAD');
  });

  it('MAIL_UNREAD khi không có mail thưởng, chỉ có thư chưa đọc', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.mail.create({
      data: {
        recipientId: fx.characterId,
        subject: 'Tin',
        body: 'Hi',
      },
    });
    const actions = await svc.forUser(fx.userId);
    const keys = actions.map((a) => a.key);
    expect(keys).toContain('MAIL_UNREAD');
    expect(actions.find((a) => a.key === 'MAIL_UNREAD')?.params).toEqual({ count: 1 });
  });

  it('không gợi ý mail expired', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.mail.create({
      data: {
        recipientId: fx.characterId,
        subject: 'Cũ',
        body: 'Hết hạn',
        rewardLinhThach: 100n,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const actions = await svc.forUser(fx.userId);
    expect(actions.map((a) => a.key)).not.toContain('MAIL_UNCLAIMED');
    expect(actions.map((a) => a.key)).not.toContain('MAIL_UNREAD');
  });

  it('BOSS_ACTIVE khi có world boss đang ACTIVE chưa expire', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.worldBoss.create({
      data: {
        bossKey: 'hoa_long',
        name: 'Hoả Long',
        level: 5,
        maxHp: 100000n,
        currentHp: 80000n,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const actions = await svc.forUser(fx.userId);
    const boss = actions.find((a) => a.key === 'BOSS_ACTIVE');
    expect(boss).toBeDefined();
    expect(boss?.params).toEqual({ name: 'Hoả Long', level: 5 });
    expect(boss?.route).toBe('/boss');
  });

  it('không gợi ý boss đã expire dù status còn ACTIVE', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.worldBoss.create({
      data: {
        bossKey: 'hoa_long',
        name: 'Hoả Long',
        level: 5,
        maxHp: 100000n,
        currentHp: 80000n,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const actions = await svc.forUser(fx.userId);
    expect(actions.map((a) => a.key)).not.toContain('BOSS_ACTIVE');
  });

  it('TOPUP_PENDING khi có order PENDING', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.topupOrder.create({
      data: {
        userId: fx.userId,
        packageKey: 'BAO_TAU',
        tienNgocAmount: 100,
        priceVND: 10_000,
        transferCode: 'TOPUP-AB12',
        status: 'PENDING',
      },
    });
    const actions = await svc.forUser(fx.userId);
    const topup = actions.find((a) => a.key === 'TOPUP_PENDING');
    expect(topup).toBeDefined();
    expect(topup?.params).toEqual({ code: 'TOPUP-AB12' });
  });

  it('BREAKTHROUGH_READY khi realmStage 9 + exp >= expNext', async () => {
    // Luyện Khí stage 9 — expCost lookup từ catalog. Dùng exp số rất lớn để chắc.
    const fx = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 9,
      exp: 10n ** 18n,
      cultivating: true,
    });
    const actions = await svc.forUser(fx.userId);
    expect(actions.map((a) => a.key)).toContain('BREAKTHROUGH_READY');
  });

  it('không gợi ý BREAKTHROUGH khi realmStage < 9', async () => {
    const fx = await makeUserChar(prisma, {
      realmKey: 'luyenkhi',
      realmStage: 1,
      exp: 10n ** 18n,
      cultivating: true,
    });
    const actions = await svc.forUser(fx.userId);
    expect(actions.map((a) => a.key)).not.toContain('BREAKTHROUGH_READY');
  });

  it('actions sort theo priority ASC', async () => {
    const fx = await makeUserChar(prisma, { cultivating: true });
    await prisma.missionProgress.create({
      data: {
        characterId: fx.characterId,
        missionKey: 'daily_cultivate_5min',
        period: 'DAILY',
        currentAmount: 600,
        goalAmount: 600,
        claimed: false,
      },
    });
    await prisma.worldBoss.create({
      data: {
        bossKey: 'hoa_long',
        name: 'Hoả Long',
        level: 5,
        maxHp: 100000n,
        currentHp: 80000n,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await prisma.topupOrder.create({
      data: {
        userId: fx.userId,
        packageKey: 'BAO_TAU',
        tienNgocAmount: 100,
        priceVND: 10_000,
        transferCode: 'TOPUP-X',
        status: 'PENDING',
      },
    });
    const actions = await svc.forUser(fx.userId);
    const priorities = actions.map((a) => a.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
    expect(actions[0].key).toBe('MISSION_CLAIMABLE');
  });
});
