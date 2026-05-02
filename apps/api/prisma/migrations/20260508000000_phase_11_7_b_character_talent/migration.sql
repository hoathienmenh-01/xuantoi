-- Phase 11.7.B Talent (Thần Thông) MVP runtime — passive/active talent persistence.
-- 1 row per (characterId, talentKey). Each character learns each talent at
-- most once; talent point budget computed from realm order via
-- `computeTalentPointBudget(currentRealmOrder)` ÷ 3 milestone rule.
-- Passive talent stat mods composed via `composePassiveTalentMods` (catalog
-- pure helper). Active talent execution (combat tick) deferred Phase 11.7.C.

CREATE TABLE "CharacterTalent" (
  "id"          TEXT         NOT NULL,
  "characterId" TEXT         NOT NULL,
  -- Khoá tham chiếu `TALENTS` trong `packages/shared/src/talents.ts`.
  "talentKey"   TEXT         NOT NULL,
  "learnedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterTalent_pkey" PRIMARY KEY ("id")
);

-- 1 row per (characterId, talentKey) — learnTalent đảm bảo idempotency.
CREATE UNIQUE INDEX "CharacterTalent_characterId_talentKey_key"
  ON "CharacterTalent"("characterId", "talentKey");

-- Index cho `listLearned(characterId)` query.
CREATE INDEX "CharacterTalent_characterId_learnedAt_idx"
  ON "CharacterTalent"("characterId", "learnedAt");

ALTER TABLE "CharacterTalent" ADD CONSTRAINT "CharacterTalent_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
