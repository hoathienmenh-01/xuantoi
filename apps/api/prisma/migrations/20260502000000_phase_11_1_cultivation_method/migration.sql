-- Phase 11.1.B — Cultivation Method runtime schema (server-authoritative).
-- `equippedCultivationMethodKey` nullable cho legacy character pre-11.1.B
-- (multiplier fallback 1.0). Onboard auto-grant + auto-equip starter
-- `khai_thien_quyet` qua CharacterService.onboard.

-- AlterTable
ALTER TABLE "Character"
    ADD COLUMN "equippedCultivationMethodKey" TEXT;

-- CreateTable
CREATE TABLE "CharacterCultivationMethod" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "methodKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterCultivationMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCultivationMethod_characterId_methodKey_key" ON "CharacterCultivationMethod"("characterId", "methodKey");

-- CreateIndex
CREATE INDEX "CharacterCultivationMethod_characterId_idx" ON "CharacterCultivationMethod"("characterId");

-- AddForeignKey
ALTER TABLE "CharacterCultivationMethod" ADD CONSTRAINT "CharacterCultivationMethod_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
