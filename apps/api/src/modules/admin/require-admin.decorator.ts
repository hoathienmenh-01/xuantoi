import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key được `AdminGuard` đọc qua `Reflector` để force ADMIN-only.
 *
 * Default `AdminGuard` chấp nhận cả ADMIN và MOD. Khi method/controller được
 * đánh dấu `@RequireAdmin()`, MOD sẽ bị reject với `FORBIDDEN`.
 *
 * Dùng cho các action có ảnh hưởng tài sản / kinh tế / chính sách (M8):
 * - `POST /admin/users/:id/grant` (cộng/trừ linh thạch + tiên ngọc)
 * - `POST /admin/users/:id/role` (đổi role)
 * - `POST /admin/topups/:id/approve|reject`
 * - `POST /admin/giftcodes` + `POST /admin/giftcodes/:code/revoke`
 * - `POST /admin/mail/send` + `POST /admin/mail/broadcast`
 * - `POST /boss/admin/spawn`
 *
 * MOD vẫn được phép: GET (read), `POST /admin/users/:id/ban` (đã có
 * hierarchy ở service: MOD chỉ ban được PLAYER), chat moderation.
 */
export const REQUIRE_ADMIN_KEY = 'requireAdmin';

export const RequireAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_ADMIN_KEY, true);
