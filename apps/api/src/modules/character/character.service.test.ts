import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from './character.service';
import { SpiritualRootService } from './spiritual-root.service';
import { CultivationMethodService } from './cultivation-method.service';
import { CharacterSkillService } from './character-skill.service';
import { CurrencyService } from './currency.service';
import {
  ELEMENTS,
  SPIRITUAL_ROOT_GRADES,
  STARTER_CULTIVATION_METHOD_KEY,
} from '@xuantoi/shared';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let chars: CharacterService;
let charsWithRoot: CharacterService;
let charsWithMethod: CharacterService;
let charsWithSkill: CharacterService;
let rootSvc: SpiritualRootService;
let methodSvc: CultivationMethodService;
let skillSvc: CharacterSkillService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const currency = new CurrencyService(prisma);
  rootSvc = new SpiritualRootService(prisma);
  methodSvc = new CultivationMethodService(prisma);
  skillSvc = new CharacterSkillService(prisma, currency);
  chars = new CharacterService(prisma, realtime);
  charsWithRoot = new CharacterService(prisma, realtime, rootSvc);
  charsWithMethod = new CharacterService(
    prisma,
    realtime,
    rootSvc,
    methodSvc,
  );
  charsWithSkill = new CharacterService(
    prisma,
    realtime,
    rootSvc,
    methodSvc,
    skillSvc,
  );
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CharacterService.findPublicProfile', () => {
  it('id không tồn tại → null', async () => {
    const r = await chars.findPublicProfile('clxxxxxxxxxxxxxxxxxxxxxxx');
    expect(r).toBeNull();
  });

  it('character bình thường → trả public-safe view (không có exp/hp/mp/currency/cultivating)', async () => {
    const f = await makeUserChar(prisma, {
      power: 42,
      spirit: 17,
      speed: 21,
      luck: 8,
      realmKey: 'truchko',
      realmStage: 3,
      linhThach: 999_999_999n,
      tienNgoc: 12345,
      hp: 50,
      mp: 25,
    });
    const r = await chars.findPublicProfile(f.characterId);
    expect(r).not.toBeNull();
    expect(r?.id).toBe(f.characterId);
    expect(r?.name).toBe(f.name);
    expect(r?.power).toBe(42);
    expect(r?.spirit).toBe(17);
    expect(r?.speed).toBe(21);
    expect(r?.luck).toBe(8);
    expect(r?.realmKey).toBe('truchko');
    expect(r?.realmStage).toBe(3);
    expect(r?.role).toBe('PLAYER');
    // Public-safe — không lộ các field nhạy cảm.
    const obj = r as unknown as Record<string, unknown>;
    expect(obj.exp).toBeUndefined();
    expect(obj.hp).toBeUndefined();
    expect(obj.mp).toBeUndefined();
    expect(obj.stamina).toBeUndefined();
    expect(obj.linhThach).toBeUndefined();
    expect(obj.tienNgoc).toBeUndefined();
    expect(obj.cultivating).toBeUndefined();
    // createdAt là ISO string.
    expect(typeof r?.createdAt).toBe('string');
    expect(new Date(r!.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('character có sect → sectId/sectKey/sectName được điền đúng', async () => {
    const sect = await prisma.sect.create({
      data: { name: 'Thanh Vân Môn' },
    });
    const f = await makeUserChar(prisma, { sectId: sect.id });
    const r = await chars.findPublicProfile(f.characterId);
    expect(r?.sectId).toBe(sect.id);
    expect(r?.sectName).toBe('Thanh Vân Môn');
    expect(r?.sectKey).toBe('thanh_van');
  });

  it('character không có sect → các field sect đều null', async () => {
    const f = await makeUserChar(prisma, { sectId: null });
    const r = await chars.findPublicProfile(f.characterId);
    expect(r?.sectId).toBeNull();
    expect(r?.sectKey).toBeNull();
    expect(r?.sectName).toBeNull();
  });

  it('user owner đang banned → trả null (không lộ profile của người bị khóa)', async () => {
    const f = await makeUserChar(prisma);
    await prisma.user.update({
      where: { id: f.userId },
      data: { banned: true },
    });
    const r = await chars.findPublicProfile(f.characterId);
    expect(r).toBeNull();
  });

  it('role admin/mod được phơi ra (cho UI hiển thị badge)', async () => {
    const fAdmin = await makeUserChar(prisma, { role: 'ADMIN' });
    const fMod = await makeUserChar(prisma, { role: 'MOD' });
    const rAdmin = await chars.findPublicProfile(fAdmin.characterId);
    const rMod = await chars.findPublicProfile(fMod.characterId);
    expect(rAdmin?.role).toBe('ADMIN');
    expect(rMod?.role).toBe('MOD');
  });
});

describe('CharacterService.onboard with SpiritualRootService (Phase 11.3.A)', () => {
  it('onboard tự động roll Linh căn server-side', async () => {
    // Tạo user trống (chưa có Character) — qua prisma trực tiếp.
    const user = await prisma.user.create({
      data: {
        email: `onboard_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithRoot.onboard(user.id, {
      name: `Tester_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'thanh_van',
    });
    expect(state.id).toBeDefined();
    const c = await prisma.character.findUnique({ where: { id: state.id } });
    expect(c).not.toBeNull();
    expect(SPIRITUAL_ROOT_GRADES).toContain(c!.spiritualRootGrade as never);
    expect(ELEMENTS).toContain(c!.primaryElement as never);
    expect(c!.rootPurity).toBeGreaterThanOrEqual(80);
    expect(c!.rootPurity).toBeLessThanOrEqual(100);

    // Log entry tạo với source='onboard'.
    const logs = await prisma.spiritualRootRollLog.findMany({
      where: { characterId: c!.id, source: 'onboard' },
    });
    expect(logs.length).toBe(1);
  });

  it('CharacterService không inject SpiritualRootService vẫn onboard được (backward-compat)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_legacy_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await chars.onboard(user.id, {
      name: `LegacyTester_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'tu_la',
    });
    const c = await prisma.character.findUnique({ where: { id: state.id } });
    expect(c).not.toBeNull();
    // Legacy onboard (không có SpiritualRootService) → field nullable.
    expect(c!.spiritualRootGrade).toBeNull();
    expect(c!.primaryElement).toBeNull();
  });
});

describe('CharacterService.onboard with CultivationMethodService (Phase 11.1.B)', () => {
  it('onboard tự động grant + equip starter `khai_thien_quyet`', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_method_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithMethod.onboard(user.id, {
      name: `MethodTester_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'thanh_van',
    });
    const c = await prisma.character.findUniqueOrThrow({
      where: { id: state.id },
    });
    expect(c.equippedCultivationMethodKey).toBe(STARTER_CULTIVATION_METHOD_KEY);
    const rows = await prisma.characterCultivationMethod.findMany({
      where: { characterId: c.id },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].methodKey).toBe(STARTER_CULTIVATION_METHOD_KEY);
    expect(rows[0].source).toBe('starter');
  });

  it('CharacterService không inject CultivationMethodService vẫn onboard được (backward-compat)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_no_method_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithRoot.onboard(user.id, {
      name: `NoMethod_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'huyen_thuy',
    });
    const c = await prisma.character.findUniqueOrThrow({
      where: { id: state.id },
    });
    expect(c.equippedCultivationMethodKey).toBeNull();
  });
});

describe('CharacterService.onboard with CharacterSkillService (Phase 11.2.B)', () => {
  it('onboard tự động grant + equip starter `basic_attack`', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_skill_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithSkill.onboard(user.id, {
      name: `SkillTester_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'thanh_van',
    });
    const rows = await prisma.characterSkill.findMany({
      where: { characterId: state.id },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].skillKey).toBe('basic_attack');
    expect(rows[0].masteryLevel).toBe(1);
    expect(rows[0].isEquipped).toBe(true);
    expect(rows[0].source).toBe('starter');
  });

  it('CharacterService không inject CharacterSkillService vẫn onboard được (backward-compat)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_no_skill_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithRoot.onboard(user.id, {
      name: `NoSkill_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'huyen_thuy',
    });
    const rows = await prisma.characterSkill.findMany({
      where: { characterId: state.id },
    });
    expect(rows.length).toBe(0);
  });

  it('onboard idempotent: chạy 2 lần (giả lập retry) → KHÔNG dup row skill', async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboard_skill_idem_${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'PLAYER',
      },
    });
    const state = await charsWithSkill.onboard(user.id, {
      name: `IdemSkill_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      sectKey: 'tu_la',
    });
    // Re-call grantStarterIfMissing — must be safe.
    await skillSvc.grantStarterIfMissing(state.id);
    await skillSvc.grantStarterIfMissing(state.id);
    const rows = await prisma.characterSkill.findMany({
      where: { characterId: state.id },
    });
    expect(rows.length).toBe(1);
  });
});
