-- CreateTable
CREATE TABLE "GiftCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rewardLinhThach" BIGINT NOT NULL DEFAULT 0,
    "rewardTienNgoc" INTEGER NOT NULL DEFAULT 0,
    "rewardExp" BIGINT NOT NULL DEFAULT 0,
    "rewardItems" JSONB NOT NULL DEFAULT '[]',
    "maxRedeems" INTEGER,
    "redeemCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCodeRedemption" (
    "id" TEXT NOT NULL,
    "giftCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_code_key" ON "GiftCode"("code");

-- CreateIndex
CREATE INDEX "GiftCode_expiresAt_idx" ON "GiftCode"("expiresAt");

-- CreateIndex
CREATE INDEX "GiftCode_revokedAt_idx" ON "GiftCode"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCodeRedemption_giftCodeId_userId_key" ON "GiftCodeRedemption"("giftCodeId", "userId");

-- CreateIndex
CREATE INDEX "GiftCodeRedemption_userId_idx" ON "GiftCodeRedemption"("userId");

-- CreateIndex
CREATE INDEX "GiftCodeRedemption_characterId_idx" ON "GiftCodeRedemption"("characterId");

-- AddForeignKey
ALTER TABLE "GiftCodeRedemption" ADD CONSTRAINT "GiftCodeRedemption_giftCodeId_fkey" FOREIGN KEY ("giftCodeId") REFERENCES "GiftCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
