-- CreateEnum
CREATE TYPE "MissionPeriod" AS ENUM ('DAILY', 'WEEKLY', 'ONCE');

-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "period" "MissionPeriod" NOT NULL,
    "currentAmount" INTEGER NOT NULL DEFAULT 0,
    "goalAmount" INTEGER NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowEnd" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionProgress_characterId_claimed_idx" ON "MissionProgress"("characterId", "claimed");

-- CreateIndex
CREATE INDEX "MissionProgress_period_windowEnd_idx" ON "MissionProgress"("period", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_characterId_missionKey_key" ON "MissionProgress"("characterId", "missionKey");

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
