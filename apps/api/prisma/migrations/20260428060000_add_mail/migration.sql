-- CreateTable
CREATE TABLE "Mail" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL DEFAULT 'Thiên Đạo Sứ Giả',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rewardLinhThach" BIGINT NOT NULL DEFAULT 0,
    "rewardTienNgoc" INTEGER NOT NULL DEFAULT 0,
    "rewardExp" BIGINT NOT NULL DEFAULT 0,
    "rewardItems" JSONB NOT NULL DEFAULT '[]',
    "readAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mail_recipientId_createdAt_idx" ON "Mail"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Mail_recipientId_claimedAt_idx" ON "Mail"("recipientId", "claimedAt");

-- CreateIndex
CREATE INDEX "Mail_recipientId_readAt_idx" ON "Mail"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Mail_expiresAt_idx" ON "Mail"("expiresAt");

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
