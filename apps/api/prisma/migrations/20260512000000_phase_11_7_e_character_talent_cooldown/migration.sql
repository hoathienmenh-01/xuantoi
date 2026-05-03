-- Phase 11.7.E Talent active cooldown persist — track remaining cooldown
-- turns per active talent learned by character. Default 0 (talent ready
-- to cast). After successful cast in CombatService.actionViaActiveTalent,
-- this column is set to talent.activeEffect.cooldownTurns (3..10). Each
-- subsequent combat action decrements all > 0 cooldowns by 1.
--
-- Backfill: ADD COLUMN ... NOT NULL DEFAULT 0 — backward-compat với
-- character đã học talent active từ Phase 11.7.D pre-cooldown (treat as
-- ready to cast).

ALTER TABLE "CharacterTalent"
  ADD COLUMN "cooldownTurnsRemaining" INTEGER NOT NULL DEFAULT 0;
