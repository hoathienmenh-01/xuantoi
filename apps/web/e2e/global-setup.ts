/**
 * Playwright global setup — chạy 1 lần trước toàn bộ E2E suite.
 *
 * Mục đích: flush các Redis key rate-limit auth (register / login /
 * forgot-password) để E2E_FULL=1 suite tạo > 5 user/IP/15min không bị 429.
 * Pattern key tham chiếu trong:
 *   - apps/api/src/modules/auth/auth.module.ts (`rl:register`, `rl:login`,
 *     `rl:forgot-password`)
 *   - docs/QA_CHECKLIST.md §10/§11 ghi nhận constraint này — manual
 *     workaround `redis-cli DEL` trước rerun.
 *
 * Setup chỉ chạy khi `E2E_FULL=1`. Khi suite mặc định (no backend smoke),
 * setup no-op nhanh để CI không cần Redis.
 *
 * Re-use ioredis từ `apps/api/node_modules` qua `createRequire` (cùng pattern
 * với `scripts/smoke-ws.mjs`) → không thêm dep mới cho `@xuantoi/web`.
 *
 * Chú ý: spec dùng `flushAuthRateLimits()` từ `helpers.ts` trong
 * `test.beforeEach` để cover cả case suite > 5 register/IP/15min (mỗi test
 * tạo 1 user mới).
 */
import { flushAuthRateLimits } from './helpers';

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_FULL !== '1') return;
  await flushAuthRateLimits();
}
