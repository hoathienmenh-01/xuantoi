-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'MOD', 'ADMIN');

-- CreateEnum
CREATE TYPE "Quality" AS ENUM ('PHAM', 'LINH', 'HUYEN', 'TIEN', 'THAN');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('WEAPON', 'ARMOR', 'BELT', 'BOOTS', 'HAT', 'TRAM', 'PILL', 'HERB', 'ORE', 'KEY', 'ARTIFACT', 'MISC');

-- CreateEnum
CREATE TYPE "EquipSlot" AS ENUM ('WEAPON', 'ARMOR', 'BELT', 'BOOTS', 'HAT', 'TRAM', 'ARTIFACT_1', 'ARTIFACT_2', 'ARTIFACT_3');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('THUONG', 'KHO', 'AC_MONG', 'BAO_TAU');

-- CreateEnum
CREATE TYPE "TopupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GameLogType" AS ENUM ('info', 'success', 'warning', 'error', 'system');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordVersion" INTEGER NOT NULL DEFAULT 1,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "realmKey" TEXT NOT NULL DEFAULT 'luyen_khi',
    "realmStage" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "exp" BIGINT NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "hp" INTEGER NOT NULL DEFAULT 100,
    "hpMax" INTEGER NOT NULL DEFAULT 100,
    "mp" INTEGER NOT NULL DEFAULT 50,
    "mpMax" INTEGER NOT NULL DEFAULT 50,
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "staminaMax" INTEGER NOT NULL DEFAULT 100,
    "power" INTEGER NOT NULL DEFAULT 10,
    "spirit" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 10,
    "luck" INTEGER NOT NULL DEFAULT 5,
    "daoVan" INTEGER NOT NULL DEFAULT 0,
    "linhThach" BIGINT NOT NULL DEFAULT 0,
    "tienNgoc" INTEGER NOT NULL DEFAULT 0,
    "tienNgocKhoa" INTEGER NOT NULL DEFAULT 0,
    "tienTe" INTEGER NOT NULL DEFAULT 0,
    "nguyenThach" INTEGER NOT NULL DEFAULT 0,
    "congHien" INTEGER NOT NULL DEFAULT 0,
    "congDuc" INTEGER NOT NULL DEFAULT 0,
    "chienCongTongMon" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "cultivating" BOOLEAN NOT NULL DEFAULT false,
    "cultivationStartedAt" TIMESTAMP(3),
    "lastCultivationAt" TIMESTAMP(3),
    "sectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "treasuryLinhThach" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameLog" (
    "id" TEXT NOT NULL,
    "charId" TEXT NOT NULL,
    "type" "GameLogType" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyLedger" (
    "id" TEXT NOT NULL,
    "charId" TEXT NOT NULL,
    "currencyKey" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaimLog" (
    "id" TEXT NOT NULL,
    "charId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaimLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sect_name_key" ON "Sect"("name");

-- CreateIndex
CREATE INDEX "GameLog_charId_createdAt_idx" ON "GameLog"("charId", "createdAt");

-- CreateIndex
CREATE INDEX "CurrencyLedger_charId_createdAt_idx" ON "CurrencyLedger"("charId", "createdAt");

-- CreateIndex
CREATE INDEX "CurrencyLedger_currencyKey_createdAt_idx" ON "CurrencyLedger"("currencyKey", "createdAt");

-- CreateIndex
CREATE INDEX "RewardClaimLog_charId_createdAt_idx" ON "RewardClaimLog"("charId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaimLog_charId_rewardType_rewardKey_refId_key" ON "RewardClaimLog"("charId", "rewardType", "rewardKey", "refId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLog" ADD CONSTRAINT "GameLog_charId_fkey" FOREIGN KEY ("charId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyLedger" ADD CONSTRAINT "CurrencyLedger_charId_fkey" FOREIGN KEY ("charId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaimLog" ADD CONSTRAINT "RewardClaimLog_charId_fkey" FOREIGN KEY ("charId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
