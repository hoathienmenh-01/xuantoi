-- Phase 11.10.C-1 Achievement claimReward MVP runtime — add `claimedAt` field
-- + index cho idempotent claim guard.
--
-- Idempotency: row đã `claimedAt != null` → throw `ALREADY_CLAIMED` (CAS
-- update guard `where { id, claimedAt: null }` đảm bảo race-safe). Achievement
-- progress đã có `completedAt` (Phase 11.10.B) — claim chỉ available khi
-- `completedAt != null` (server validate trước khi grant reward).
--
-- Index `(characterId, claimedAt)` cho query "list claimed achievements"
-- (parallel với `(characterId, completedAt)` index hiện có cho `listCompleted`).
--
-- Wire FUTURE PR (Phase 11.10.C-2):
--   - Event listener vào combat/dungeon/breakthrough/cultivate/market để
--     auto-call AchievementService.trackEvent.

ALTER TABLE "CharacterAchievement"
  ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "CharacterAchievement_characterId_claimedAt_idx"
  ON "CharacterAchievement"("characterId", "claimedAt");
