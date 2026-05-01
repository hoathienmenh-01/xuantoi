-- Phase 11.3.A — Linh căn / Spiritual Root runtime schema (server-authoritative).
-- Field nullable + safe default cho legacy character pre-Phase 11.3.

-- AlterTable
ALTER TABLE "Character"
    ADD COLUMN "spiritualRootGrade" TEXT,
    ADD COLUMN "primaryElement"     TEXT,
    ADD COLUMN "secondaryElements"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "rootPurity"         INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN "rootRerollCount"    INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SpiritualRootRollLog" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "previousGrade" TEXT,
    "newGrade" TEXT NOT NULL,
    "previousElement" TEXT,
    "newElement" TEXT NOT NULL,
    "previousSecondaryElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "newSecondaryElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previousPurity" INTEGER,
    "newPurity" INTEGER NOT NULL,
    "rngSeed" TEXT,
    "rolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpiritualRootRollLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpiritualRootRollLog_characterId_source_idx" ON "SpiritualRootRollLog"("characterId", "source");

-- CreateIndex
CREATE INDEX "SpiritualRootRollLog_rolledAt_idx" ON "SpiritualRootRollLog"("rolledAt");

-- AddForeignKey
ALTER TABLE "SpiritualRootRollLog" ADD CONSTRAINT "SpiritualRootRollLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
