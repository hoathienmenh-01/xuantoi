-- Phase 11.5.B — Refine MVP runtime schema (server-authoritative refine).
-- `InventoryItem.refineLevel` lưu cấp luyện khí 0..15 (REFINE_MAX_LEVEL).
-- Item non-equipment giữ 0; equipment legacy chưa luyện cũng giữ 0.
-- Stat multiplier áp dụng = `getRefineStatMultiplier(refineLevel)` cộng vào
-- `equipBonus()` server-authoritative qua `RefineService.refineEquipment`.

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "refineLevel" INTEGER NOT NULL DEFAULT 0;
