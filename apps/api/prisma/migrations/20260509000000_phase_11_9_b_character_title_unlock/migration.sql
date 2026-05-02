-- Phase 11.9.B Title (Danh hiệu) MVP runtime — title ownership persistence.
-- 1 row per (characterId, titleKey); composite UNIQUE đảm bảo idempotent
-- unlock. `Character.title String?` đã tồn tại từ phase 0 — đó là field
-- "equipped title" (chỉ 1 title slot tại 1 thời điểm). Bảng này persist DANH
-- SÁCH title đã unlock; runtime equip vẫn dùng `Character.title` cho cosmetic
-- display + composeTitleMods stat bonus tương lai (Phase 11.9.C wire).
--
-- FK cascade: character delete → drop unlock rows.

CREATE TABLE "CharacterTitleUnlock" (
  "id"          TEXT         NOT NULL,
  "characterId" TEXT         NOT NULL,
  "titleKey"    TEXT         NOT NULL,
  "source"      TEXT         NOT NULL,
  "unlockedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterTitleUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterTitleUnlock_characterId_titleKey_key"
  ON "CharacterTitleUnlock"("characterId", "titleKey");

CREATE INDEX "CharacterTitleUnlock_characterId_unlockedAt_idx"
  ON "CharacterTitleUnlock"("characterId", "unlockedAt");

ALTER TABLE "CharacterTitleUnlock" ADD CONSTRAINT "CharacterTitleUnlock_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
