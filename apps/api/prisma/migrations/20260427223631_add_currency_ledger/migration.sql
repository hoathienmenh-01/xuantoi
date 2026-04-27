-- CreateEnum
CREATE TYPE "CurrencyKind" AS ENUM ('LINH_THACH', 'TIEN_NGOC');

-- CreateTable
CREATE TABLE "CurrencyLedger" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "currency" "CurrencyKind" NOT NULL,
    "delta" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurrencyLedger_characterId_createdAt_idx" ON "CurrencyLedger"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "CurrencyLedger_reason_createdAt_idx" ON "CurrencyLedger"("reason", "createdAt");

-- CreateIndex
CREATE INDEX "CurrencyLedger_refType_refId_idx" ON "CurrencyLedger"("refType", "refId");

-- AddForeignKey
ALTER TABLE "CurrencyLedger" ADD CONSTRAINT "CurrencyLedger_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
