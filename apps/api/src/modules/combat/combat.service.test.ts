import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncounterStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CharacterSkillService } from '../character/character-skill.service';
import { InventoryService } from '../inventory/inventory.service';
import { CurrencyService } from '../character/currency.service';
import { TitleService } from '../character/title.service';
import { AchievementService } from '../character/achievement.service';
import { TalentService } from '../character/talent.service';
import { BuffService } from '../character/buff.service';
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

  // — Phase 11.3.C statBonusPercent wire vào combat power -------------------
  describe('Linh căn statBonusPercent wire vào atk/def (Phase 11.3.C)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character grade=than (statBonus 30%) damage > grade=pham (statBonus 0%) cùng power=100', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const pham = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        spiritualRootGrade: 'pham',
        primaryElement: 'kim',
      });
      const than = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        spiritualRootGrade: 'than',
        primaryElement: 'kim',
        secondaryElements: ['moc', 'thuy', 'hoa', 'tho'],
      });
      // basic_attack (element undefined) → playerElementMul = 1.0 cho cả 2.
      // pham: effPower = 100 * 1.0 = 100. than: effPower = 100 * 1.30 = 130.
      const encPham = await combat.start(pham.userId, 'son_coc');
      const viewPham = await combat.action(pham.userId, encPham.id, {});
      const encThan = await combat.start(than.userId, 'son_coc');
      const viewThan = await combat.action(than.userId, encThan.id, {});
      const dmgPham = parseInt(
        viewPham.log.find((l) => l.text.includes('sát thương'))!.text.match(/gây (\d+)/)![1],
        10,
      );
      const dmgThan = parseInt(
        viewThan.log.find((l) => l.text.includes('sát thương'))!.text.match(/gây (\d+)/)![1],
        10,
      );
      expect(dmgThan).toBeGreaterThan(dmgPham);
      expect(dmgThan).toBeGreaterThanOrEqual(Math.round(dmgPham * 1.25));
    });

    it('legacy character (spiritualRootGrade=null) statMul=1.0 → damage formula gốc', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const legacy = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
      });
      const enc = await combat.start(legacy.userId, 'son_coc');
      const view = await combat.action(legacy.userId, enc.id, {});
      const dmg = parseInt(
        view.log.find((l) => l.text.includes('sát thương'))!.text.match(/gây (\d+)/)![1],
        10,
      );
      // son_thu_lon def=2. dmgBase = round((100*1 - 2*0.5) * 1.0) = 99.
      expect(dmg).toBe(99);
    });
  });

  // — Phase 11.2.B Skill mastery wire ----------------------------------------
  describe('Skill mastery wire (Phase 11.2.B)', () => {
    let combatWithMastery: CombatService;
    let skillSvc: CharacterSkillService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      skillSvc = new CharacterSkillService(prisma, currency);
      combatWithMastery = new CombatService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        skillSvc,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character có CharacterSkill masteryLevel=3 cho `kiem_khi_chem` → atkScale > base → damage > baseline', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sect = await prisma.sect.upsert({
        where: { name: 'Thanh Vân Môn' },
        update: {},
        create: { name: 'Thanh Vân Môn' },
      });
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        sectId: sect.id,
      });
      // L3 mastery — kiem_khi_chem (basic tier) +0.05 × 3 = +15% atkScale.
      // kiem_khi_chem element=null → playerElementMul = 1.0 (skill vô hệ).
      await prisma.characterSkill.create({
        data: {
          characterId: u.characterId,
          skillKey: 'kiem_khi_chem',
          masteryLevel: 3,
          source: 'admin_grant',
        },
      });
      const enc = await combatWithMastery.start(u.userId, 'son_coc');
      const view = await combatWithMastery.action(u.userId, enc.id, {
        skillKey: 'kiem_khi_chem',
      });
      const dmg = parseInt(
        view.log
          .find((l) => l.text.includes('Kiếm Khí Trảm'))!
          .text.match(/gây (\d+)/)![1],
        10,
      );
      // Base atkScale 1.7; effective = round2(1.7 * 1.15) = 1.95 (FP
      // truncation: 1.7*1.15 = 1.95499... → round2 → 1.95).
      // power=100, son_thu_lon def=2 → dmgBase = round((100*1.95 - 1)*1.0)
      // = round(194) = 194.
      // KHÔNG mastery: dmgBase = round((100 * 1.7 - 1) * 1.0) = 169.
      expect(dmg).toBe(194);
      expect(dmg).toBeGreaterThan(169);
    });

    it('legacy character (no row) → masteryLevel=0 → damage = baseline', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sect = await prisma.sect.upsert({
        where: { name: 'Thanh Vân Môn' },
        update: {},
        create: { name: 'Thanh Vân Môn' },
      });
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        sectId: sect.id,
      });
      // grantStarterIfMissing trong getEffectiveSkillFor — không lazy-grant
      // cho non-basic_attack skill. Character có 0 row CharacterSkill cho
      // `kiem_khi_chem` → masteryLevel = 0 → no bonus.
      const enc = await combatWithMastery.start(u.userId, 'son_coc');
      const view = await combatWithMastery.action(u.userId, enc.id, {
        skillKey: 'kiem_khi_chem',
      });
      const dmg = parseInt(
        view.log
          .find((l) => l.text.includes('Kiếm Khí Trảm'))!
          .text.match(/gây (\d+)/)![1],
        10,
      );
      // No row → applyMasteryEffect masteryLevel=0 → atkScale=1.7 không đổi.
      // dmgBase = round((100 * 1.7 - 1) * 1.0) = 169.
      expect(dmg).toBe(169);
    });

    it('mastery mpCostReduction → dùng skill khi MP gốc thiếu nhưng đủ sau giảm', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sect = await prisma.sect.upsert({
        where: { name: 'Thanh Vân Môn' },
        update: {},
        create: { name: 'Thanh Vân Môn' },
      });
      // kiem_khi_chem mpCost gốc = 12. L5 basic mastery → mpCostReduction
      // 0.05*5 = 0.25 → effective = round(12 * 0.75) = 9.
      // Cho character mp=10 → tickled qua sau giảm.
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        mp: 10,
        mpMax: 100,
        sectId: sect.id,
      });
      await prisma.characterSkill.create({
        data: {
          characterId: u.characterId,
          skillKey: 'kiem_khi_chem',
          masteryLevel: 5,
          source: 'admin_grant',
        },
      });
      const enc = await combatWithMastery.start(u.userId, 'son_coc');
      // KHÔNG throw MP_LOW vì effective.mpCost = 9 ≤ 10.
      const view = await combatWithMastery.action(u.userId, enc.id, {
        skillKey: 'kiem_khi_chem',
      });
      expect(view.status).not.toBe(EncounterStatus.LOST);
    });

    it('mastery max-level lookup → no crash khi level vượt curve (clamped)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sect = await prisma.sect.upsert({
        where: { name: 'Thanh Vân Môn' },
        update: {},
        create: { name: 'Thanh Vân Môn' },
      });
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 100,
        hp: 1000,
        hpMax: 1000,
        sectId: sect.id,
      });
      // Tạo row masteryLevel=99 (vượt max basic=5). applyMasteryEffect
      // clamp xuống 5 — không crash.
      await prisma.characterSkill.create({
        data: {
          characterId: u.characterId,
          skillKey: 'kim_quang_tram',
          masteryLevel: 99,
          source: 'admin_grant',
        },
      });
      const enc = await combatWithMastery.start(u.userId, 'son_coc');
      const view = await combatWithMastery.action(u.userId, enc.id, {
        skillKey: 'kim_quang_tram',
      });
      // No throw, action thực thi.
      expect(view).toBeTruthy();
    });
  });

  // — Phase 11.10.C-2 Achievement event listener wire ----------------------
  describe('Achievement event listener wire (Phase 11.10.C-2)', () => {
    let combatWithAchievements: CombatService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const title = new TitleService(prisma);
      const achievements = new AchievementService(prisma, currency, title);
      const missions = makeMissionService(prisma);
      combatWithAchievements = new CombatService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined,
        achievements,
      );
    });

    it('CombatService.action với KILL_MONSTER → achievement progress KILL_MONSTER tăng đúng', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // crit → kill chắc
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 1000, // overkill cho son_thu_lon (HP ~50)
        hp: 1000,
        hpMax: 1000,
      });
      const enc = await combatWithAchievements.start(u.userId, 'son_coc');
      await combatWithAchievements.action(u.userId, enc.id, {});

      const row = await prisma.characterAchievement.findUnique({
        where: {
          characterId_achievementKey: {
            characterId: u.characterId,
            achievementKey: 'first_monster_kill',
          },
        },
      });
      expect(row).not.toBeNull();
      expect(row!.progress).toBeGreaterThanOrEqual(1);
      expect(row!.completedAt).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('CombatService.action với CLEAR_DUNGEON → achievement progress CLEAR_DUNGEON tăng đúng', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const u = await makeUserChar(prisma, {
        stamina: 100,
        power: 100000, // overkill toàn dungeon
        hp: 100000,
        hpMax: 100000,
      });
      const enc = await combatWithAchievements.start(u.userId, 'son_coc');
      // Clear hết toàn bộ monster trong dungeon (3-4 monster).
      let view = enc;
      for (let i = 0; i < 10 && view.status === EncounterStatus.ACTIVE; i++) {
        view = await combatWithAchievements.action(u.userId, enc.id, {});
      }
      expect(view.status).toBe(EncounterStatus.WON);

      const dungeonRow = await prisma.characterAchievement.findUnique({
        where: {
          characterId_achievementKey: {
            characterId: u.characterId,
            achievementKey: 'first_dungeon_clear',
          },
        },
      });
      expect(dungeonRow).not.toBeNull();
      expect(dungeonRow!.progress).toBeGreaterThanOrEqual(1);
      expect(dungeonRow!.completedAt).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  // — Phase 11.7.C Talent wire (passive mods compose vào atk/def/exp/drop) ----
  describe('Talent passive wire (Phase 11.7.C)', () => {
    let combatWithTalents: CombatService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      const talents = new TalentService(prisma);
      combatWithTalents = new CombatService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined,
        undefined,
        talents,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('character ở kim_dan(3) học talent_kim_thien_co (atk*1.1) → effPower lớn hơn baseline → dmg cao hơn', async () => {
      // Math.random pinned 0.5 → variance = 0.85 + 0.5*0.3 = 1.0 (deterministic).
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // Power=20 đủ thấp để KHÔNG 1-shot son_thu_lon (hp=30) → monster vẫn còn
      // sau hit đầu tiên → so sánh được dmg base vs dmg talent qua state.monsterHp.
      const baseUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100, // không chết phản kích
        hp: 1000,
        hpMax: 1000,
      });
      const baseEnc = await combatWithTalents.start(baseUser.userId, 'son_coc');
      await combatWithTalents.action(baseUser.userId, baseEnc.id, {});
      const baseEncAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: baseEnc.id },
      });
      const baseState = baseEncAfter.state as { monsterHp: number };
      const baseDmg = 30 - baseState.monsterHp; // son_thu_lon hp=30
      // baseline: rollDamage(20, 2, 1) = max(1, round((20-1)*1.0)) = 19.
      expect(baseDmg).toBe(19);

      const talentUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      const talentSvc = new TalentService(prisma);
      await talentSvc.learnTalent(talentUser.characterId, 'talent_kim_thien_co');
      const talentEnc = await combatWithTalents.start(
        talentUser.userId,
        'son_coc',
      );
      await combatWithTalents.action(talentUser.userId, talentEnc.id, {});
      const talentEncAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: talentEnc.id },
      });
      const talentState = talentEncAfter.state as { monsterHp: number };
      const talentDmg = 30 - talentState.monsterHp;
      // talent: effPower = 20 * 1.0 * 1.1 = 22 → rollDamage(22, 2, 1)
      // = max(1, round((22-1)*1.0)) = 21.
      expect(talentDmg).toBe(21);
      expect(talentDmg).toBeGreaterThan(baseDmg);
    });

    it('character ở luyen_hu(6) học talent_thien_di (drop*1.2) → linhThach drop = floor(5*1.2)=6 thay vì 5', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        realmKey: 'luyen_hu',
        stamina: 100,
        power: 1000, // đảm bảo 1-shot son_thu_lon (hp=30)
        hp: 1000,
        hpMax: 1000,
        linhThach: 0n,
      });
      const talentSvc = new TalentService(prisma);
      await talentSvc.learnTalent(u.characterId, 'talent_thien_di');

      const enc = await combatWithTalents.start(u.userId, 'son_coc');
      await combatWithTalents.action(u.userId, enc.id, {});

      const ledger = await prisma.currencyLedger.findMany({
        where: { characterId: u.characterId, reason: 'COMBAT_LOOT' },
      });
      // 1 monster killed → 1 ledger row, delta = floor(5 * 1.2) = 6.
      expect(ledger).toHaveLength(1);
      expect(ledger[0].delta).toBe(6n);
    });

    it('character ở luyen_hu(6) học talent_ngo_dao (exp*1.15) → exp drop = floor(12*1.15)=13 thay vì 12', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        realmKey: 'luyen_hu',
        stamina: 100,
        power: 1000, // 1-shot son_thu_lon (hp=30)
        hp: 1000,
        hpMax: 1000,
        exp: 0n,
      });
      const talentSvc = new TalentService(prisma);
      await talentSvc.learnTalent(u.characterId, 'talent_ngo_dao');

      const enc = await combatWithTalents.start(u.userId, 'son_coc');
      await combatWithTalents.action(u.userId, enc.id, {});

      const c = await prisma.character.findUniqueOrThrow({
        where: { id: u.characterId },
      });
      // 1 monster killed → exp gain = floor(12 * 1.15) = 13.
      expect(c.exp).toBe(13n);
    });

    it('không inject TalentService → identity baseline (linhThach drop = 5, exp drop = 12)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // combat (no TalentService) — identity behavior.
      const u = await makeUserChar(prisma, {
        realmKey: 'luyen_hu',
        stamina: 100,
        power: 1000,
        hp: 1000,
        hpMax: 1000,
        exp: 0n,
        linhThach: 0n,
      });

      const enc = await combat.start(u.userId, 'son_coc');
      await combat.action(u.userId, enc.id, {});

      const c = await prisma.character.findUniqueOrThrow({
        where: { id: u.characterId },
      });
      expect(c.exp).toBe(12n);
      const ledger = await prisma.currencyLedger.findMany({
        where: { characterId: u.characterId, reason: 'COMBAT_LOOT' },
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].delta).toBe(5n);
    });
  });

  // — Phase 11.8.C Buff wire (stat mods + element damage compose vào combat) ----
  describe('Buff wire (Phase 11.8.C)', () => {
    let combatWithBuffs: CombatService;
    let buffSvc: BuffService;

    beforeAll(() => {
      const realtime = new RealtimeService();
      const chars = new CharacterService(prisma, realtime);
      const inventory = new InventoryService(prisma, realtime, chars);
      const currency = new CurrencyService(prisma);
      const missions = makeMissionService(prisma);
      buffSvc = new BuffService(prisma);
      combatWithBuffs = new CombatService(
        prisma,
        realtime,
        chars,
        inventory,
        currency,
        missions,
        undefined, // characterSkill
        undefined, // achievements
        undefined, // talents
        buffSvc,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('pill_atk_buff_t1 (atk*1.12) → effPower 20→22.4 → dmg 19→21', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // Baseline — no buff.
      const baseUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      const baseEnc = await combatWithBuffs.start(baseUser.userId, 'son_coc');
      await combatWithBuffs.action(baseUser.userId, baseEnc.id, {});
      const baseEncAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: baseEnc.id },
      });
      const baseState = baseEncAfter.state as { monsterHp: number };
      const baseDmg = 30 - baseState.monsterHp; // son_thu_lon hp=30
      expect(baseDmg).toBe(19);

      // With pill_atk_buff_t1 → atkMul=1.12.
      const buffUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      await buffSvc.applyBuff(buffUser.characterId, 'pill_atk_buff_t1', 'pill');
      const buffEnc = await combatWithBuffs.start(buffUser.userId, 'son_coc');
      await combatWithBuffs.action(buffUser.userId, buffEnc.id, {});
      const buffEncAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: buffEnc.id },
      });
      const buffState = buffEncAfter.state as { monsterHp: number };
      const buffDmg = 30 - buffState.monsterHp;
      // effPower = 20 * 1.12 = 22.4. rollDamage(22.4, 2, 1) = round(21.4) = 21.
      expect(buffDmg).toBe(21);
      expect(buffDmg).toBeGreaterThan(baseDmg);
    });

    it('debuff_boss_atk_down (atk*0.82) → effPower 20→16.4 → dmg 19→15', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      await buffSvc.applyBuff(u.characterId, 'debuff_boss_atk_down', 'boss_skill');
      const enc = await combatWithBuffs.start(u.userId, 'son_coc');
      await combatWithBuffs.action(u.userId, enc.id, {});
      const encAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: enc.id },
      });
      const st = encAfter.state as { monsterHp: number };
      const dmg = 30 - st.monsterHp;
      // effPower = 20 * 0.82 = 16.4. rollDamage(16.4, 2, 1) = round(15.4) = 15.
      expect(dmg).toBe(15);
    });

    it('pill_def_buff_t1 (def*1.15) → incoming monster damage reduced', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // Baseline — no buff, monster hits back. Power low enough so monster
      // survives → counter-attack happens.
      const baseUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 5,
        spirit: 10,
        hp: 1000,
        hpMax: 1000,
      });
      const baseEnc = await combatWithBuffs.start(baseUser.userId, 'son_coc');
      await combatWithBuffs.action(baseUser.userId, baseEnc.id, {});
      const baseChar = await prisma.character.findUniqueOrThrow({
        where: { id: baseUser.characterId },
      });
      const baseHpLost = 1000 - baseChar.hp;

      // With pill_def_buff_t1 → defMul=1.15.
      const buffUser = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 5,
        spirit: 10,
        hp: 1000,
        hpMax: 1000,
      });
      await buffSvc.applyBuff(buffUser.characterId, 'pill_def_buff_t1', 'pill');
      const buffEnc = await combatWithBuffs.start(buffUser.userId, 'son_coc');
      await combatWithBuffs.action(buffUser.userId, buffEnc.id, {});
      const buffChar = await prisma.character.findUniqueOrThrow({
        where: { id: buffUser.characterId },
      });
      const buffHpLost = 1000 - buffChar.hp;
      // Higher effDef → lower incoming damage → HP lost should be ≤ baseline.
      expect(buffHpLost).toBeLessThanOrEqual(baseHpLost);
    });

    it('không inject BuffService → identity baseline (dmg = 19, same as no-buff)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // combat (no BuffService) — identity behavior via main `combat` instance.
      const u = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      const enc = await combat.start(u.userId, 'son_coc');
      await combat.action(u.userId, enc.id, {});
      const encAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: enc.id },
      });
      const st = encAfter.state as { monsterHp: number };
      const dmg = 30 - st.monsterHp;
      expect(dmg).toBe(19);
    });

    it('expired buff is pruned and has no effect', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const u = await makeUserChar(prisma, {
        realmKey: 'kim_dan',
        stamina: 100,
        power: 20,
        spirit: 100,
        hp: 1000,
        hpMax: 1000,
      });
      // Apply buff with a past timestamp so it's already expired.
      const pastDate = new Date(Date.now() - 120_000); // 2 min ago
      await buffSvc.applyBuff(u.characterId, 'pill_atk_buff_t1', 'pill', pastDate);
      const enc = await combatWithBuffs.start(u.userId, 'son_coc');
      await combatWithBuffs.action(u.userId, enc.id, {});
      const encAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: enc.id },
      });
      const st = encAfter.state as { monsterHp: number };
      const dmg = 30 - st.monsterHp;
      // Expired buff pruned → identity baseline → dmg = 19 (same as no-buff).
      expect(dmg).toBe(19);
    });
  });
});
