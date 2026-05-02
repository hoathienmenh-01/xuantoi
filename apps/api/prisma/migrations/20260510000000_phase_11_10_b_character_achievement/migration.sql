-- Phase 11.10.B Achievement (Thành Tựu) MVP runtime — progress + completion
-- persistence (no reward claim — defer to Phase 11.10.C).
--
-- 1 row per (characterId, achievementKey); composite UNIQUE đảm bảo idempotent
-- progress upsert. `completedAt` set một lần khi `progress >= goalAmount`,
-- không bao giờ unset (achievement permanent). Phase 11.10.C sẽ thêm
-- `claimedAt TIMESTAMP(3)` + reason `ACHIEVEMENT_REWARD` cho currency/item
-- ledger + auto-unlock title qua TitleService.
--
-- FK cascade: character delete → drop progress rows.

CREATE TABLE "CharacterAchievement" (
  "id"             TEXT         NOT NULL,
  "characterId"    TEXT         NOT NULL,
  "achievementKey" TEXT         NOT NULL,
  "progress"       INTEGER      NOT NULL DEFAULT 0,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterAchievement_characterId_achievementKey_key"
  ON "CharacterAchievement"("characterId", "achievementKey");

CREATE INDEX "CharacterAchievement_characterId_completedAt_idx"
  ON "CharacterAchievement"("characterId", "completedAt");

ALTER TABLE "CharacterAchievement" ADD CONSTRAINT "CharacterAchievement_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
