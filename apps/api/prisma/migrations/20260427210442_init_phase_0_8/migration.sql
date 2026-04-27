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
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('WORLD', 'SECT');

-- CreateEnum
CREATE TYPE "BossStatus" AS ENUM ('ACTIVE', 'DEFEATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'ABANDONED');

-- CreateTable
CREATE TABLE "TopupOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageKey" TEXT NOT NULL,
    "tienNgocAmount" INTEGER NOT NULL,
    "priceVND" INTEGER NOT NULL,
    "transferCode" TEXT NOT NULL,
    "status" "TopupStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

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
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "passwordVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "realmKey" TEXT NOT NULL,
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
    "sectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "equippedSlot" "EquipSlot",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemKind" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "pricePerUnit" BIGINT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "buyerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "treasuryLinhThach" BIGINT NOT NULL DEFAULT 0,
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "channel" "ChatChannel" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldBoss" (
    "id" TEXT NOT NULL,
    "bossKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "maxHp" BIGINT NOT NULL,
    "currentHp" BIGINT NOT NULL,
    "status" "BossStatus" NOT NULL DEFAULT 'ACTIVE',
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "defeatedAt" TIMESTAMP(3),
    "rewardTotal" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "WorldBoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BossDamage" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "totalDamage" BIGINT NOT NULL DEFAULT 0,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "dungeonKey" TEXT NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'ACTIVE',
    "state" JSONB NOT NULL DEFAULT '{}',
    "log" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopupOrder_transferCode_key" ON "TopupOrder"("transferCode");

-- CreateIndex
CREATE INDEX "TopupOrder_userId_status_createdAt_idx" ON "TopupOrder"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TopupOrder_status_createdAt_idx" ON "TopupOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_ip_createdAt_idx" ON "LoginAttempt"("email", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_characterId_itemKey_idx" ON "InventoryItem"("characterId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_characterId_equippedSlot_key" ON "InventoryItem"("characterId", "equippedSlot");

-- CreateIndex
CREATE INDEX "Listing_status_itemKind_idx" ON "Listing"("status", "itemKind");

-- CreateIndex
CREATE INDEX "Listing_status_itemKey_idx" ON "Listing"("status", "itemKey");

-- CreateIndex
CREATE INDEX "Listing_sellerId_status_idx" ON "Listing"("sellerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Sect_name_key" ON "Sect"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sect_leaderId_key" ON "Sect"("leaderId");

-- CreateIndex
CREATE INDEX "ChatMessage_channel_scopeKey_createdAt_idx" ON "ChatMessage"("channel", "scopeKey", "createdAt");

-- CreateIndex
CREATE INDEX "WorldBoss_status_spawnedAt_idx" ON "WorldBoss"("status", "spawnedAt");

-- CreateIndex
CREATE INDEX "BossDamage_bossId_totalDamage_idx" ON "BossDamage"("bossId", "totalDamage");

-- CreateIndex
CREATE UNIQUE INDEX "BossDamage_bossId_characterId_key" ON "BossDamage"("bossId", "characterId");

-- CreateIndex
CREATE INDEX "Encounter_characterId_status_idx" ON "Encounter"("characterId", "status");

-- AddForeignKey
ALTER TABLE "TopupOrder" ADD CONSTRAINT "TopupOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopupOrder" ADD CONSTRAINT "TopupOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BossDamage" ADD CONSTRAINT "BossDamage_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "WorldBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
