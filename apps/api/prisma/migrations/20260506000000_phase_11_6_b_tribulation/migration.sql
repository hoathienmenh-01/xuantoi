-- Phase 11.6.B Tribulation runtime — additive schema (zero-downtime).
--
-- Character fields:
--   - taoMaActive: Tâm Ma debuff active flag (cultivating gating + atk -10%
--     wire vào CharacterService.setCultivating() + future combat).
--   - taoMaExpiresAt: thời điểm hết debuff (server-side timer).
--   - tribulationCooldownAt: thời điểm có thể retry kiếp sau khi fail.
--
-- TribulationAttempt log: 1 row per attempt, audit-only, không xoá. Cho phép
-- retry sau khi cooldown hết hạn — query findFirst({ characterId,
-- tribulationKey, success: true }) để gate breakthrough.
--
-- Backward-compat: row Character cũ mặc định taoMaActive=false, các
-- DateTime field nullable, không break legacy users.

ALTER TABLE "Character"
  ADD COLUMN "taoMaActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taoMaExpiresAt" TIMESTAMP(3),
  ADD COLUMN "tribulationCooldownAt" TIMESTAMP(3);

CREATE TABLE "TribulationAttempt" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "tribulationKey" TEXT NOT NULL,
  "fromRealmKey" TEXT NOT NULL,
  "toRealmKey" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "wavesCompleted" INTEGER NOT NULL,
  "totalDamage" INTEGER NOT NULL,
  "finalHp" INTEGER NOT NULL,
  "taoMaTriggered" BOOLEAN NOT NULL DEFAULT false,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TribulationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TribulationAttempt_characterId_success_idx"
  ON "TribulationAttempt"("characterId", "success");

CREATE INDEX "TribulationAttempt_characterId_tribulationKey_idx"
  ON "TribulationAttempt"("characterId", "tribulationKey");

ALTER TABLE "TribulationAttempt"
  ADD CONSTRAINT "TribulationAttempt_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
