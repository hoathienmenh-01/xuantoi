-- CreateTable
CREATE TABLE "ItemLedger" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemLedger_characterId_createdAt_idx" ON "ItemLedger"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "ItemLedger_itemKey_createdAt_idx" ON "ItemLedger"("itemKey", "createdAt");

-- CreateIndex
CREATE INDEX "ItemLedger_reason_createdAt_idx" ON "ItemLedger"("reason", "createdAt");

-- CreateIndex
CREATE INDEX "ItemLedger_refType_refId_idx" ON "ItemLedger"("refType", "refId");

-- AddForeignKey
ALTER TABLE "ItemLedger" ADD CONSTRAINT "ItemLedger_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
