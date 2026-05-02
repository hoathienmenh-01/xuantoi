-- Phase 11.8.B Buff MVP runtime — duration-based buff/debuff persistence.
-- 1 row per (characterId, buffKey). Stackable buff increment `stacks`
-- (capped tại catalog `maxStacks`); non-stackable refresh `expiresAt`.
-- `pruneExpired(now)` xóa row có `expiresAt <= now`.
-- Wire FUTURE: tribulation FAIL → applyBuff('debuff_taoma'), pill consume,
-- skill DOT/CC, sect aura, event, equipment, talent (active utility).

CREATE TABLE "CharacterBuff" (
  "id"          TEXT         NOT NULL,
  "characterId" TEXT         NOT NULL,
  -- Khoá tham chiếu `BUFFS` trong `packages/shared/src/buffs.ts`.
  "buffKey"     TEXT         NOT NULL,
  -- Stack count hiện tại (1..def.maxStacks). Non-stackable buff luôn = 1.
  "stacks"      INTEGER      NOT NULL DEFAULT 1,
  -- `BuffSource` ∈ {pill, sect_aura, event, equipment, skill, talent, boss_skill, tribulation}.
  "source"      TEXT         NOT NULL,
  -- Khi buff expire, row cleanup qua `pruneExpired(now)`.
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterBuff_pkey" PRIMARY KEY ("id")
);

-- 1 row per (characterId, buffKey) — applyBuff dùng upsert pattern.
CREATE UNIQUE INDEX "CharacterBuff_characterId_buffKey_key"
  ON "CharacterBuff"("characterId", "buffKey");

-- Index cho `pruneExpired(now)` cron sweep batch.
CREATE INDEX "CharacterBuff_expiresAt_idx" ON "CharacterBuff"("expiresAt");

-- Index cho `listActive(charId)` query.
CREATE INDEX "CharacterBuff_characterId_expiresAt_idx"
  ON "CharacterBuff"("characterId", "expiresAt");

ALTER TABLE "CharacterBuff" ADD CONSTRAINT "CharacterBuff_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
