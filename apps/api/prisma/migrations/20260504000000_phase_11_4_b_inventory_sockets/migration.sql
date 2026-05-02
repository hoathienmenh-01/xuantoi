-- Phase 11.4.B — Gem MVP runtime schema (server-authoritative socket).
-- `InventoryItem.sockets` lưu danh sách gemKey đã khảm (theo thứ tự slot).
-- Item không phải equipment giữ array rỗng; equipment legacy chưa khảm cũng
-- giữ array rỗng. Capacity tối đa = `socketCapacityForQuality(item.quality)`
-- enforce ở `GemService.socketGem` (server-authoritative).

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "sockets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
