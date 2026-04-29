-- CreateTable
CREATE TABLE "DailyLoginClaim" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "claimDateLocal" TEXT NOT NULL,
    "linhThachDelta" BIGINT NOT NULL,
    "streakAtClaim" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLoginClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLoginClaim_characterId_claimDateLocal_key" ON "DailyLoginClaim"("characterId", "claimDateLocal");

-- CreateIndex
CREATE INDEX "DailyLoginClaim_characterId_createdAt_idx" ON "DailyLoginClaim"("characterId", "createdAt");

-- AddForeignKey
ALTER TABLE "DailyLoginClaim" ADD CONSTRAINT "DailyLoginClaim_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
