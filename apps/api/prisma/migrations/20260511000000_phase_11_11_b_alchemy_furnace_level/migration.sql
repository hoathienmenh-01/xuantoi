-- Phase 11.11.B Alchemy (Luyện Đan) MVP runtime — furnace level persistence.
--
-- Thêm cột `alchemyFurnaceLevel` vào Character. Default = 1 (lò sơ cấp,
-- mở khoá toàn bộ recipe PHAM tier). Player muốn craft recipe LINH/HUYEN/
-- TIEN/THAN tier phải nâng furnace level (Phase 11.11.C sẽ thêm upgrade
-- cost qua linhThach + nguyên liệu cao cấp).
--
-- Migration an toàn cho legacy character: `DEFAULT 1` áp dụng cho mọi
-- row hiện có (mặc dù NOT NULL). Không cần backfill thủ công.
--
-- KHÔNG thêm bảng `AlchemyAttemptLog` ở MVP — replay/audit dùng `ItemLedger`
-- (reason `ALCHEMY_INPUT` + `ALCHEMY_OUTPUT`) + `CurrencyLedger` (reason
-- `ALCHEMY_COST`). Phase 11.11.C có thể thêm nếu cần per-attempt analytics.

ALTER TABLE "Character"
  ADD COLUMN "alchemyFurnaceLevel" INTEGER NOT NULL DEFAULT 1;
