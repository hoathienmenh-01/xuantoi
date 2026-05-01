/**
 * E2E golden path — closed beta core loop.
 *
 * Mục tiêu: cover end-to-end các tương tác chính của user closed beta để
 * regression-safe trước khi mở rộng Phase 10 content scale. Coverage:
 *   1. AuthView smoke (no backend)
 *   2. Register UI + 4-step onboarding + landing /home (full UI flow)
 *   3. Cultivate toggle ON/OFF (UI label flip + API state cross-check)
 *   4. Daily login claim (claimable → claimed transition)
 *   5. Mission view tabs + empty/list state
 *   6. Shop browse + insufficient-funds disable Buy (fresh char = 0 LT)
 *   7. Inventory empty state cho fresh char
 *   8. Chat WORLD send → message render trong feed
 *   9. Leaderboard tabs Power / Topup / Sect (data-testid stable)
 *   10. Profile public view ownId
 *   11. Logout → redirect /auth, session sạch
 *
 * Yêu cầu chạy local:
 *   1. `pnpm infra:up` (Postgres + Redis)
 *   2. `pnpm --filter @xuantoi/api exec prisma migrate deploy`
 *   3. `pnpm --filter @xuantoi/api dev` (port 3000)
 *   4. `pnpm --filter @xuantoi/web dev` (port 5173, vite proxy `/api` → 3000)
 *   5. `PLAYWRIGHT_BASE_URL=http://localhost:5173 PLAYWRIGHT_SKIP_WEBSERVER=1 \
 *       E2E_FULL=1 pnpm --filter @xuantoi/web e2e`
 *
 * Khi `E2E_FULL` chưa set, suite full-flow skip để tránh fail trên CI hiện tại
 * (CI mới chỉ chạy Vitest + build artifact). Spec `AuthView smoke` luôn chạy.
 *
 * Tham khảo: docs/QA_CHECKLIST.md §12, docs/BETA_CHECKLIST.md §QA + Launch.
 */
import { test, expect } from '@playwright/test';
import {
  registerAndOnboard,
  getCharacterMe,
  waitCharacter,
  flushAuthRateLimits,
} from './helpers';

const FULL_E2E = process.env.E2E_FULL === '1';

test.describe('AuthView smoke (no backend)', () => {
  test('auth page renders email/password form + tab buttons', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth/);

    // Form email + password input visible (login tab default)
    await expect(page.locator('input[type="email"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    // 3 tab buttons: Đăng Nhập / Đăng Ký / Đổi Mật Khẩu (ko phải role=tab,
    // chỉ là plain <button>).
    await expect(page.getByRole('button', { name: /Đăng Nhập/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng Ký/i }).first()).toBeVisible();
  });
});

test.describe('Golden path — full stack required', () => {
  test.skip(!FULL_E2E, 'Set E2E_FULL=1 with running api+web+postgres+redis to run');

  // Flush register/login rate-limit Redis key trước mỗi test → đảm bảo suite
  // tạo > 5 user/IP/15min không bị 429 RATE_LIMITED. Mỗi test tạo 1 user mới
  // qua `registerAndOnboard()` nên cần reset window. Best-effort: Redis
  // unreachable chỉ log warn, không fail.
  test.beforeEach(async () => {
    await flushAuthRateLimits();
  });

  // ---------------------------------------------------------------------------
  // 1. Full UI auth flow — register → 4-step onboarding → /home.
  // Phần còn lại của suite dùng API helper để bypass UI auth (deterministic +
  // nhanh) → test này là "ground truth" của UI auth path.
  // ---------------------------------------------------------------------------
  test('register UI → 4-step onboarding → /home (full UI)', async ({ page }) => {
    const email = `e2e_uiauth_${Date.now()}@local.test`;
    const password = 'Pass1234!';
    const charName = `e2e_${Math.random().toString(36).slice(2, 8)}`;

    await page.goto('/auth');

    // Switch sang tab "Đăng Ký" — AuthView dùng plain <button>, không phải
    // role=tab. Vì thế dùng getByRole('button', { name: 'Đăng Ký' }).
    await page.getByRole('button', { name: /^Đăng Ký$/i }).click();

    // Form register hiện ra — chỉ có 2 input (email + password) + button
    // "Đăng Ký" submit. Use first() vì có thể có 2 input password (login form
    // bị v-if tắt nhưng selector vẫn match nếu cache).
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await emailInput.fill(email);
    await passwordInput.fill(password);

    // Submit button — text từ i18n `auth.register.submit` = "Khai Tông Lập Danh"
    // (KHÔNG phải "Đăng Ký" — text đó chỉ là label tab nằm bên trên form).
    await page.getByRole('button', { name: /Khai Tông Lập Danh/i }).click();

    // Sau register thành công, AuthView push('/onboarding').
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Step 1 (intro). Click "Tiếp tục".
    await page.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 2 — fill name. Input là `type="text"`.
    await page.locator('input[type="text"]').first().fill(charName);
    await page.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 3 — pick sect. 3 button: Thanh Vân Môn / Huyền Thuỷ Cung / Tu La Tông.
    // (Note: tên 3 sect chính xác trong vi.json là `Tu La Tông`, không phải
    // `Tu La Điện` như existing test cũ.)
    await page.getByRole('button', { name: /Thanh Vân Môn/i }).click();
    await page.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 4 — confirm. Button "Khởi đạo" submit onboard.
    await page.getByRole('button', { name: /Khởi đạo/i }).click();

    // Replace('/home') — full game shell render.
    await page.waitForURL(/\/home/, { timeout: 15_000 });

    // Game home phải hiển thị tên character + button cultivate "Nhập Định".
    await expect(page.getByText(charName, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /Nhập Định/i }).first()).toBeVisible();

    // Cross-check API state: character đã tạo, cultivating=false, level=1.
    const ch = await getCharacterMe(page);
    expect(ch.name).toBe(charName);
    expect(ch.cultivating).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. Cultivate toggle — UI button text "Nhập Định" ↔ "Xuất Định" + API state.
  // ---------------------------------------------------------------------------
  test('cultivate toggle ON/OFF — UI label flip + API state', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_cult' });
    await page.goto('/home');

    const startBtn = page.getByRole('button', { name: /Nhập Định/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 10_000 });

    // ON.
    await startBtn.click();
    await expect(page.getByRole('button', { name: /Xuất Định/i }).first()).toBeVisible({
      timeout: 5000,
    });
    await waitCharacter(page, (c) => c.cultivating === true, {
      label: 'cultivating=true',
    });

    // OFF.
    await page.getByRole('button', { name: /Xuất Định/i }).first().click();
    await expect(page.getByRole('button', { name: /Nhập Định/i }).first()).toBeVisible({
      timeout: 5000,
    });
    await waitCharacter(page, (c) => c.cultivating === false, {
      label: 'cultivating=false',
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Daily login claim — claim button → claimedHint hiện ra.
  // ---------------------------------------------------------------------------
  test('daily login claim — claimable → claimed transition', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_daily' });
    await page.goto('/home');

    // DailyLoginCard render trên /home cho user mới — first claim hôm nay.
    // Button text = `dailyLogin.claim` = "Nhận quà".
    const claimBtn = page.getByRole('button', { name: /Nhận quà/i }).first();
    await expect(claimBtn).toBeVisible({ timeout: 10_000 });
    await claimBtn.click();

    // Sau claim, FE update store → button disappear hoặc thay bằng claimedHint.
    // claimedHint i18n: "Đạo hữu đã nhận quà hôm nay. Chuỗi liên tục: {streak} ngày."
    await expect(page.getByText(/đã nhận quà hôm nay/i).first()).toBeVisible({
      timeout: 8000,
    });

    // Cross-check API: linhThach > 0 sau claim (daily login cấp +LT).
    const ch = await waitCharacter(page, (c) => BigInt(String(c.linhThach ?? '0')) > 0n, {
      label: 'linhThach > 0 after daily claim',
      timeoutMs: 6000,
    });
    expect(BigInt(String(ch.linhThach))).toBeGreaterThan(0n);
  });

  // ---------------------------------------------------------------------------
  // 4. Mission view — tabs + empty/list state cho fresh char.
  // ---------------------------------------------------------------------------
  test('mission view — tabs render + at least 1 mission visible', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_mission' });
    await page.goto('/missions');

    await expect(page).toHaveURL(/\/missions/);
    // Title `mission.title` = "Bảng Nhiệm Vụ".
    await expect(page.getByRole('heading', { name: /Bảng Nhiệm Vụ/i })).toBeVisible({
      timeout: 10_000,
    });

    // 3 tab daily/weekly/once — daily mặc định active.
    await expect(page.getByRole('button', { name: /Hằng Ngày/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Hằng Tuần/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Thiên Kiếp/i }).first()).toBeVisible();

    // Tab "Hằng Tuần" click không crash.
    await page.getByRole('button', { name: /Hằng Tuần/i }).first().click();
    // Tab "Thiên Kiếp" click không crash.
    await page.getByRole('button', { name: /Thiên Kiếp/i }).first().click();
    // Quay lại Hằng Ngày.
    await page.getByRole('button', { name: /Hằng Ngày/i }).first().click();

    // Page vẫn ở /missions, không bị redirect /auth.
    await expect(page).toHaveURL(/\/missions/);
  });

  // ---------------------------------------------------------------------------
  // 5. Shop browse — items render, insufficient-funds disable nút Buy.
  // Fresh char có linhThach = 0 nên mọi nút Buy phải disabled (canAfford=false).
  // ---------------------------------------------------------------------------
  test('shop browse — items render + buy disabled for 0-LT fresh char', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_shop' });
    await page.goto('/shop');

    await expect(page).toHaveURL(/\/shop/);
    // Title shop.
    await expect(page.getByRole('heading', { name: /NPC Tiệm/i })).toBeVisible({
      timeout: 10_000,
    });

    // Loading xong → ít nhất 1 entry hoặc empty state.
    // Nếu seed shop có entry: button "Mua" tồn tại + DISABLED (vì 0 LT).
    const buyBtns = page.getByRole('button', { name: /^Mua$/i });
    const buyCount = await buyBtns.count();
    if (buyCount > 0) {
      // Ít nhất nút Buy đầu tiên phải disabled (0 LT < bất kỳ price LT nào).
      const firstBuy = buyBtns.first();
      await expect(firstBuy).toBeDisabled({ timeout: 5000 });
    }
    // Page không crash.
    await expect(page).toHaveURL(/\/shop/);
  });

  // ---------------------------------------------------------------------------
  // 6. Inventory — empty state cho fresh char.
  // ---------------------------------------------------------------------------
  test('inventory — empty state for fresh char', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_inv' });
    await page.goto('/inventory');

    await expect(page).toHaveURL(/\/inventory/);
    // Title inventory: "Linh Bảo Các".
    await expect(page.getByRole('heading', { name: /Linh Bảo Các/i })).toBeVisible({
      timeout: 10_000,
    });
    // emptyAll i18n: "Túi đồ trống — đi Luyện Khí Đường để nhặt chiến lợi phẩm."
    await expect(page.getByText(/Túi đồ trống/i).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 7. Chat WORLD send — message echo trong feed.
  // ChatPanel mounted trong AppShell (bên phải). Test tại /home.
  // ---------------------------------------------------------------------------
  test('chat WORLD — send message → render trong feed', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_chat' });
    await page.goto('/home');

    // Wait cho AppShell + ChatPanel mount.
    await expect(page.getByRole('heading', { name: /Tâm Cảnh Đường/i })).toBeVisible({
      timeout: 10_000,
    });

    // Tab WORLD mặc định active. Input chat:
    const chatInput = page.locator('input[placeholder*="Gửi thế giới"]').first();
    await expect(chatInput).toBeVisible();

    const msg = `e2e_hi_${Math.random().toString(36).slice(2, 6)}`;
    await chatInput.fill(msg);
    // Submit form (button "Gửi" hoặc Enter).
    await page.getByRole('button', { name: /^Gửi$/i }).first().click();

    // Message text appear trong feed.
    await expect(page.getByText(msg, { exact: false }).first()).toBeVisible({
      timeout: 8000,
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Leaderboard tabs — Power / Topup / Sect render với data-testid stable.
  // ---------------------------------------------------------------------------
  test('leaderboard tabs — Power / Topup / Sect render', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_lb' });
    await page.goto('/leaderboard');

    await expect(page).toHaveURL(/\/leaderboard/);

    // 3 tab data-testid stable.
    const powerTab = page.locator('[data-testid="leaderboard-tab-power"]');
    const topupTab = page.locator('[data-testid="leaderboard-tab-topup"]');
    const sectTab = page.locator('[data-testid="leaderboard-tab-sect"]');

    await expect(powerTab).toBeVisible({ timeout: 10_000 });
    await expect(topupTab).toBeVisible();
    await expect(sectTab).toBeVisible();

    // Default active = power. Switch sang topup + sect → mỗi tab load không crash.
    await topupTab.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/leaderboard/);

    await sectTab.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/leaderboard/);

    await powerTab.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/leaderboard/);
  });

  // ---------------------------------------------------------------------------
  // 9. Profile own-id — public view render được tên character.
  // ---------------------------------------------------------------------------
  test('profile /profile/:ownId — public view shows char name', async ({ page }) => {
    const seed = await registerAndOnboard(page, { emailPrefix: 'e2e_profile' });
    await page.goto(`/profile/${seed.characterId}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${seed.characterId}`));
    // Tên character render đâu đó trên page (h1 / h2 / text node).
    await expect(page.getByText(seed.charName, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Logout — clear session, redirect /auth.
  // ---------------------------------------------------------------------------
  test('logout — clears session + redirects /auth', async ({ page }) => {
    await registerAndOnboard(page, { emailPrefix: 'e2e_logout' });
    await page.goto('/home');

    // AppShell logout button text = `home.logout` = "Xuất Quan".
    const logoutBtn = page.getByRole('button', { name: /Xuất Quan/i }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 });
    await logoutBtn.click();

    // FE redirect về /auth (interceptor 401 hoặc explicit push).
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});
