import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncounterStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { InventoryService } from '../inventory/inventory.service';
import { CurrencyService } from '../character/currency.service';
import { CombatService } from './combat.service';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let combat: CombatService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const inventory = new InventoryService(prisma, realtime, chars);
  const currency = new CurrencyService(prisma);
  const missions = makeMissionService(prisma);
  combat = new CombatService(
    prisma,
    realtime,
    chars,
    inventory,
    currency,
    missions,
  );
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CombatService', () => {
  it('start: trừ stamina + tạo encounter ACTIVE', async () => {
    const u = await makeUserChar(prisma, { stamina: 100 });
    const enc = await combat.start(u.userId, 'son_coc');
    expect(enc.status).toBe(EncounterStatus.ACTIVE);
    const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
    expect(c.stamina).toBe(90);
  });

  it('start: stamina thấp → STAMINA_LOW', async () => {
    const u = await makeUserChar(prisma, { stamina: 5 });
    await expect(combat.start(u.userId, 'son_coc')).rejects.toMatchObject({
      code: 'STAMINA_LOW',
    });
  });

  it('start: dungeon không tồn tại → DUNGEON_NOT_FOUND', async () => {
    const u = await makeUserChar(prisma);
    await expect(combat.start(u.userId, 'no_such_dungeon')).rejects.toMatchObject({
      code: 'DUNGEON_NOT_FOUND',
    });
  });

  it('start: đã có encounter ACTIVE → ALREADY_IN_FIGHT', async () => {
    const u = await makeUserChar(prisma, { stamina: 100 });
    await combat.start(u.userId, 'son_coc');
    await expect(combat.start(u.userId, 'son_coc')).rejects.toMatchObject({
      code: 'ALREADY_IN_FIGHT',
    });
  });

  it('action: 3-hit clear son_coc → WON + cộng EXP + ghi ledger COMBAT_LOOT', async () => {
    const u = await makeUserChar(prisma, {
      stamina: 100,
      power: 200, // đảm bảo 1-shot từng quái
      hp: 1000,
      hpMax: 1000,
      linhThach: 0n,
    });
    const enc = await combat.start(u.userId, 'son_coc');

    let view = enc;
    for (let i = 0; i < 3; i++) {
      view = await combat.action(u.userId, enc.id, {});
      if (view.status !== EncounterStatus.ACTIVE) break;
    }
    expect(view.status).toBe(EncounterStatus.WON);

    const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
    // EXP drop tổng: 12 + 25 + 45 = 82
    expect(c.exp).toBe(82n);
    // linhThach drop: 5 + 9 + 15 = 29
    expect(c.linhThach).toBe(29n);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId, reason: 'COMBAT_LOOT' },
    });
    // Mỗi quái rớt linh thạch tạo 1 ledger row.
    expect(ledger.length).toBe(3);
    const total = ledger.reduce((s, r) => s + r.delta, 0n);
    expect(total).toBe(29n);
  });

  it('action: bị quái phản kích chết → LOST + hp = 1', async () => {
    const u = await makeUserChar(prisma, {
      stamina: 100,
      power: 1, // damage cực thấp, không kill nổi quái
      spirit: 0, // không đỡ được phản kích
      hp: 2,
      hpMax: 2,
    });
    const enc = await combat.start(u.userId, 'son_coc');
    const view = await combat.action(u.userId, enc.id, {});
    expect(view.status).toBe(EncounterStatus.LOST);
    const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
    expect(c.hp).toBe(1);
  });

  it('action: encounter đã ENDED → ENCOUNTER_ENDED', async () => {
    const u = await makeUserChar(prisma, { stamina: 100, power: 200 });
    const enc = await combat.start(u.userId, 'son_coc');
    // Win full chain
    let view = enc;
    for (let i = 0; i < 3; i++) {
      view = await combat.action(u.userId, enc.id, {});
      if (view.status !== EncounterStatus.ACTIVE) break;
    }
    await expect(combat.action(u.userId, enc.id, {})).rejects.toMatchObject({
      code: 'ENCOUNTER_ENDED',
    });
  });

  // — Phase 11.3.B Linh căn / Ngũ Hành element wire ----------------------
  describe('Linh căn / Ngũ Hành element wire (Phase 11.3.B)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character có spiritualRoot kim + skill kim hệ vs monster moc → tương khắc + character bonus (≥ 1.40×)', async () => {
      // variance = 0.85 + 0.5 * 0.3 = 1.0 → dmgBase = atk*scale - def*0.5 deterministic.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 200,
        hp: 1000,
        hpMax: 1000,
        spiritualRootGrade: 'tien',
        primaryElement: 'kim',
        secondaryElements: ['thuy', 'hoa'],
      });
      // moc_huyen_lam dungeon: 4 monster element 'moc'.
      const enc = await combat.start(u.userId, 'moc_huyen_lam');
      const view = await combat.action(u.userId, enc.id, { skillKey: 'kim_quang_tram' });
      // monster 'thanh_mang_xa' element=moc, hp=110, def=6.
      // dmgBase = (200 + 0)*1.7 - 6*0.5 = 340 - 3 = 337. multiplier = 1.30 (kim>moc khắc) + 0.10 (skill primary) = 1.40.
      // dmg = round(337 * 1.40) = 472. monsterHp 110 - 472 → kill, status ACTIVE next monster.
      // → log line "tương khắc/sinh — sát thương khuếch đại ×1.40" có mặt.
      const log = view.log.map((l) => l.text).join('\n');
      expect(log).toContain('tương khắc/sinh');
      expect(log).toMatch(/×1\.40/);
    });

    it('character có spiritualRoot moc + skill kim hệ vs monster moc → tương khắc nhưng KHÔNG có character bonus (×1.30)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 200,
        hp: 1000,
        hpMax: 1000,
        spiritualRootGrade: 'linh',
        primaryElement: 'moc',
        secondaryElements: ['thuy'],
      });
      const enc = await combat.start(u.userId, 'moc_huyen_lam');
      const view = await combat.action(u.userId, enc.id, { skillKey: 'kim_quang_tram' });
      const log = view.log.map((l) => l.text).join('\n');
      expect(log).toContain('tương khắc/sinh');
      expect(log).toMatch(/×1\.30/);
    });

    it('legacy character (primaryElement=null) skill kim hệ vs monster moc → vẫn áp Ngũ Hành ×1.30 (không bonus character)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 200,
        hp: 1000,
        hpMax: 1000,
        // KHÔNG set spiritualRootGrade → null → bypass character bonus.
      });
      const enc = await combat.start(u.userId, 'moc_huyen_lam');
      const view = await combat.action(u.userId, enc.id, { skillKey: 'kim_quang_tram' });
      const log = view.log.map((l) => l.text).join('\n');
      expect(log).toContain('tương khắc/sinh');
      expect(log).toMatch(/×1\.30/);
    });

    it('skill basic_attack (vô hệ) vs monster moc → KHÔNG log Ngũ Hành (multiplier = 1.0)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 200,
        hp: 1000,
        hpMax: 1000,
        spiritualRootGrade: 'tien',
        primaryElement: 'kim',
        secondaryElements: ['thuy', 'hoa'],
      });
      const enc = await combat.start(u.userId, 'moc_huyen_lam');
      // skillKey omitted → basic_attack, element undefined.
      const view = await combat.action(u.userId, enc.id, {});
      const log = view.log.map((l) => l.text).join('\n');
      expect(log).not.toContain('tương khắc/sinh');
      expect(log).not.toContain('lệch hệ');
    });

    it('skill kim hệ vs monster kim → cùng hệ ×0.90 → log "lệch hệ" suy giảm', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 200,
        hp: 1000,
        hpMax: 1000,
        // primaryElement=null để loại character bonus (cùng hệ kim → +0.10 bù vào 0.90 = 1.00, log không trigger).
      });
      // kim_son_mach dungeon: 4 monster element 'kim'.
      const enc = await combat.start(u.userId, 'kim_son_mach');
      const view = await combat.action(u.userId, enc.id, { skillKey: 'kim_quang_tram' });
      const log = view.log.map((l) => l.text).join('\n');
      expect(log).toContain('lệch hệ');
      expect(log).toMatch(/×0\.90/);
    });
  });
});
