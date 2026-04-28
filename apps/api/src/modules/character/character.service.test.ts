import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from './character.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let chars: CharacterService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  chars = new CharacterService(prisma, realtime);
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
