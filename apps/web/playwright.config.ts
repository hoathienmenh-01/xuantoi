import { defineConfig, devices } from '@playwright/test';

/**
 * Mặc định:
 *  - `PLAYWRIGHT_BASE_URL` không set + không skip webServer → start `vite preview`
 *    trên port 4173 và chạy spec với base URL `http://localhost:4173`.
 *  - User local: nếu đã `pnpm --filter @xuantoi/web dev` ở 5173 → set
 *    `PLAYWRIGHT_BASE_URL=http://localhost:5173 PLAYWRIGHT_SKIP_WEBSERVER=1`.
 *  - CI: chạy nguyên config (webServer auto-start) để không cần manual orchestration.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './e2e',
  // `globalSetup` flush các Redis rate-limit key trước E2E_FULL=1 suite —
  // tránh 429 khi tạo > 5 user/IP/15min. No-op khi `E2E_FULL` chưa set.
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        // `vite preview` serve build output (`dist/`). Dùng `--strictPort` để
        // crash sớm nếu 4173 bị chiếm thay vì silently chuyển port.
        command: 'pnpm vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
