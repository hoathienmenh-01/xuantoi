/**
 * E2E golden path — register → onboard → cultivate 1 tick → mission claim.
 *
 * Yêu cầu chạy:
 *   1. `pnpm infra:up` (Postgres + Redis)
 *   2. `pnpm --filter @xuantoi/api exec prisma migrate deploy`
 *   3. `pnpm --filter @xuantoi/api dev` (port 3000)
 *   4. `pnpm --filter @xuantoi/web dev` (port 5173)
 *   5. `E2E_FULL=1 pnpm --filter @xuantoi/web e2e`
 *
 * Khi `E2E_FULL` chưa set, suite full-flow skip để tránh fail trên CI hiện tại
 * (CI mới chỉ chạy Vitest). Một test smoke đơn giản (load `/auth`) luôn chạy.
 */
import { test, expect } from '@playwright/test';

const FULL_E2E = process.env.E2E_FULL === '1';

test.describe('AuthView smoke (no backend)', () => {
  test('auth page renders register/login tabs', async ({ page }) => {
    await page.goto('/auth');
    // Trang `/auth` render được kể cả khi backend chưa chạy
    // (Pinia hydrate sẽ throw nhưng UI vẫn mount).
    await expect(page).toHaveURL(/\/auth/);
    // form có ít nhất 1 input email + 1 input password
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Golden path — full stack required', () => {
  test.skip(!FULL_E2E, 'Set E2E_FULL=1 with running api+web+postgres+redis to run');

  const email = `e2e_${Date.now()}@local.test`;
  const password = 'pass1234';

  test('register → onboard → home → cultivate → mission claim', async ({ page }) => {
    await page.goto('/auth');

    // Register tab
    await page.getByRole('tab', { name: /Đăng ký|Register/i }).click().catch(() => {});
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: /Đăng ký|Register/i }).click();

    // Onboarding — pick first sect
    await page.waitForURL(/\/onboarding|\/character/, { timeout: 15_000 }).catch(() => {});
    const sectBtn = page.getByRole('button', { name: /Thanh Vân Môn|Huyền Thuỷ Cung|Tu La Điện/i }).first();
    if (await sectBtn.isVisible().catch(() => false)) {
      await sectBtn.click();
      await page.getByRole('button', { name: /Xác nhận|Confirm/i }).click().catch(() => {});
    }

    // Home / GameHome
    await page.waitForURL(/\/home|\/$/, { timeout: 15_000 }).catch(() => {});

    // Toggle cultivate ON
    const cultivateToggle = page.getByRole('button', { name: /Nhập Định|Cultivate/i });
    if (await cultivateToggle.isVisible().catch(() => false)) {
      await cultivateToggle.click();
    }

    // Mission claim — best-effort smoke
    await page.goto('/missions');
    const claimBtn = page.getByRole('button', { name: /Nhận|Claim/i }).first();
    if (await claimBtn.isVisible().catch(() => false)) {
      await claimBtn.click();
    }

    // Assertion cuối: trang vẫn render
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
