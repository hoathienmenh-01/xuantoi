-- Phase 11.6.B — Tribulation/Tâm Ma MVP runtime schema (server-authoritative).
--
-- `TribulationAttemptLog`: 1 row per attempt. Audit replay: capture sim outcome
-- (`wavesCompleted`/`totalDamage`/`finalHp`), pre/post EXP, debuff state, RNG
-- roll for taoMa-debuff trigger so a future replay can verify determinism.
--
-- `Character.tribulationCooldownAt`: nullable. Set on FAIL — block retry until
-- `now >= tribulationCooldownAt`. Cleared on SUCCESS (realm advanced).
--
-- `Character.taoMaUntil`: nullable. Set on FAIL when `taoMaRoll <
-- failurePenalty.taoMaDebuffChance` — Tâm Ma debuff active until that point.
-- Cleared on SUCCESS. Combat runtime (Phase 11.8 Buff system future) sẽ đọc
-- field này để áp dụng debuff. MVP chỉ persist + audit.
--
-- Reason cho `CurrencyLedger`: `TRIBULATION_REWARD` (linhThach grant on
-- success); thêm vào `LedgerReason` union ở `currency.service.ts`.

-- AlterTable Character: thêm 2 nullable timestamp fields cho cooldown + Tâm Ma.
ALTER TABLE "Character" ADD COLUMN "tribulationCooldownAt" TIMESTAMP(3);
ALTER TABLE "Character" ADD COLUMN "taoMaUntil" TIMESTAMP(3);

-- CreateTable TribulationAttemptLog
CREATE TABLE "TribulationAttemptLog" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "tribulationKey" TEXT NOT NULL,
    "fromRealmKey" TEXT NOT NULL,
    "toRealmKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "wavesCompleted" INTEGER NOT NULL,
    "totalDamage" INTEGER NOT NULL,
    "finalHp" INTEGER NOT NULL,
    "hpInitial" INTEGER NOT NULL,
    "expBefore" BIGINT NOT NULL,
    "expAfter" BIGINT NOT NULL,
    "expLoss" BIGINT NOT NULL DEFAULT 0,
    "taoMaActive" BOOLEAN NOT NULL DEFAULT false,
    "taoMaExpiresAt" TIMESTAMP(3),
    "cooldownAt" TIMESTAMP(3),
    "linhThachReward" INTEGER NOT NULL DEFAULT 0,
    "expBonusReward" BIGINT NOT NULL DEFAULT 0,
    "titleKeyReward" TEXT,
    "attemptIndex" INTEGER NOT NULL,
    "taoMaRoll" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TribulationAttemptLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TribulationAttemptLog_characterId_createdAt_idx" ON "TribulationAttemptLog"("characterId", "createdAt");
CREATE INDEX "TribulationAttemptLog_tribulationKey_createdAt_idx" ON "TribulationAttemptLog"("tribulationKey", "createdAt");

-- AddForeignKey
ALTER TABLE "TribulationAttemptLog" ADD CONSTRAINT "TribulationAttemptLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
