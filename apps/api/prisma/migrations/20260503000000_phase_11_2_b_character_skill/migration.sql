-- Phase 11.2.B — Skill Template runtime schema (server-authoritative).
-- `CharacterSkill` ghi nhận skill character đã học + masteryLevel + isEquipped.
-- Legacy character không có row nào → masteryLevel=0 → combat fallback dùng
-- baseline `SkillDef.atkScale / mpCost / cooldownTurns` (no bonus).
-- Idempotency: `@@unique([characterId, skillKey])` chống double-learn.

-- CreateTable
CREATE TABLE "CharacterSkill" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "masteryLevel" INTEGER NOT NULL DEFAULT 1,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSkill_characterId_skillKey_key" ON "CharacterSkill"("characterId", "skillKey");

-- CreateIndex
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");

-- CreateIndex
CREATE INDEX "CharacterSkill_characterId_isEquipped_idx" ON "CharacterSkill"("characterId", "isEquipped");

-- AddForeignKey
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
