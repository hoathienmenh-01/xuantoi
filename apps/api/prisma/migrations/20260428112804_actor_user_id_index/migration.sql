-- CreateIndex
CREATE INDEX "CurrencyLedger_actorUserId_createdAt_idx" ON "CurrencyLedger"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ItemLedger_actorUserId_createdAt_idx" ON "ItemLedger"("actorUserId", "createdAt");
