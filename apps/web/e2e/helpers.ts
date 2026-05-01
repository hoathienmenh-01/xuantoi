/**
 * E2E helpers — API-driven seeding cho closed beta core loop.
 *
 * Mục đích: cho phép từng spec bypass phần register/onboard UI khi không phải
 * là feature đang test, để tests deterministic + chạy nhanh hơn (UI auth ~3-5s
 * mỗi test → ~150ms qua API).
 *
 * Tất cả request dùng `page.request` (Playwright `APIRequestContext`) nên
 * cookie set-cookie từ `/api/_auth/register` được lưu trực tiếp vào browser
 * context — request UI tiếp theo (page.goto) tự dùng session đó.
 *
 * KHÔNG đụng admin endpoint, KHÔNG seed currency / item — fresh char chỉ có
 * starting linhThach (= 0 theo schema, hoặc số seed nếu economy patch sau).
 */
import type { Page, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const API_BASE_DEFAULT = 'http://localhost:3000';

/** Path tới API origin. Mặc định trùng `pnpm --filter @xuantoi/api dev`. */
export function apiBase(): string {
  return process.env.E2E_API_BASE ?? API_BASE_DEFAULT;
}

export type SectKey = 'thanh_van' | 'huyen_thuy' | 'tu_la';

export interface OnboardOptions {
  /** Override tên character. Default: random `e2e_<rand>` (3–16 chars, regex an toàn). */
  charName?: string;
  /** Override sect. Default: `thanh_van`. */
  sectKey?: SectKey;
  /** Override email prefix. Default: `e2e_<purpose>`. */
  emailPrefix?: string;
  /** Override password. Default: `Pass1234!`. */
  password?: string;
}

export interface SeedResult {
  email: string;
  password: string;
  charName: string;
  sectKey: SectKey;
  characterId: string;
  userId: string;
}

function randSuffix(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

function randCharName(prefix = 'e2e'): string {
  // 3–16 ký tự, regex `^[A-Za-zÀ-ỹ0-9._]+$`. Prefix + 5 random hex = 9 chars.
  return `${prefix}_${randSuffix(5)}`;
}

async function expectOk(res: APIResponse, label: string): Promise<unknown> {
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400 || !body || (body as { ok?: boolean }).ok === false) {
    throw new Error(
      `[e2e helpers] ${label} failed: status=${status} body=${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return (body as { data?: unknown }).data;
}

/**
 * Register fresh user + onboard character. Cookie `xt_access` + `xt_refresh`
 * được set vào browser context của `page` qua `page.request`.
 *
 * Sau khi gọi, caller có thể `await page.goto('/home')` và sẽ thấy session
 * đã đăng nhập, character đã tạo.
 */
export async function registerAndOnboard(page: Page, opts: OnboardOptions = {}): Promise<SeedResult> {
  const email = `${opts.emailPrefix ?? 'e2e_seed'}_${Date.now()}_${randSuffix()}@local.test`;
  const password = opts.password ?? 'Pass1234!';
  const charName = opts.charName ?? randCharName();
  const sectKey: SectKey = opts.sectKey ?? 'thanh_van';

  const base = apiBase();

  const regRes = await page.request.post(`${base}/api/_auth/register`, {
    data: { email, password },
  });
  const regData = (await expectOk(regRes, 'register')) as { user?: { id?: string } } | undefined;
  const userId = regData?.user?.id ?? '';

  const onbRes = await page.request.post(`${base}/api/character/onboard`, {
    data: { name: charName, sectKey },
  });
  const onbData = (await expectOk(onbRes, 'onboard')) as
    | { character?: { id?: string } }
    | undefined;
  const characterId = onbData?.character?.id ?? '';

  if (!userId || !characterId) {
    throw new Error(
      `[e2e helpers] seed missing ids: userId=${userId} characterId=${characterId}`,
    );
  }

  return { email, password, charName, sectKey, characterId, userId };
}

/**
 * Lấy character snapshot qua `/api/character/me`. Dùng để cross-check UI state
 * (vd `cultivating` flag, `linhThach`, `level`).
 */
export async function getCharacterMe(page: Page): Promise<Record<string, unknown>> {
  const base = apiBase();
  const res = await page.request.get(`${base}/api/character/me`);
  const data = (await expectOk(res, 'character/me')) as { character?: Record<string, unknown> };
  if (!data?.character) throw new Error('[e2e helpers] character/me: no character');
  return data.character;
}

/**
 * Wait cho `expectFn` predicate trả `true` qua polling `/api/character/me`.
 * Default 8s, poll mỗi 250ms. Throws nếu timeout.
 */
export async function waitCharacter(
  page: Page,
  expectFn: (char: Record<string, unknown>) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<Record<string, unknown>> {
  const timeout = opts.timeoutMs ?? 8000;
  const interval = opts.intervalMs ?? 250;
  const label = opts.label ?? 'waitCharacter';
  const deadline = Date.now() + timeout;
  let lastChar: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    lastChar = await getCharacterMe(page);
    if (expectFn(lastChar)) return lastChar;
    await page.waitForTimeout(interval);
  }
  throw new Error(`[e2e helpers] ${label}: timeout sau ${timeout}ms. Last char=${JSON.stringify(lastChar).slice(0, 300)}`);
}

/**
 * Flush các Redis key rate-limit auth (register / login / forgot-password) để
 * suite tạo > 5 user/IP/15min không bị 429 RATE_LIMITED. Best-effort: nếu
 * Redis unreachable, log warn + return (suite có thể fail nếu > 5 register).
 *
 * Gọi:
 *   - `globalSetup` (1 lần trước toàn suite, để clear state cũ).
 *   - `test.beforeEach` (cover case suite > 5 register/IP/15min).
 */
const RATE_LIMIT_PATTERNS = ['rl:register:*', 'rl:login:*', 'rl:forgot-password:*'];

export async function flushAuthRateLimits(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const apiPkg = path.resolve(__dirname, '../../api/package.json');
  const requireFromApi = createRequire(apiPkg);
  type IORedisCtor = typeof import('ioredis').default;
  type IORedis = import('ioredis').default;
  const RedisMod = requireFromApi('ioredis') as { default: IORedisCtor };
  const Redis: IORedisCtor =
    RedisMod.default ?? (RedisMod as unknown as IORedisCtor);

  const redis: IORedis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  try {
    await redis.connect();
  } catch (err) {
    console.warn(
      `[e2e helpers] Redis ${redisUrl} unreachable (${(err as Error).message}). ` +
        `Skipping rate-limit flush — > 5 register/IP/15min sẽ fail 429.`,
    );
    redis.disconnect();
    return;
  }

  try {
    for (const pattern of RATE_LIMIT_PATTERNS) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    }
  } finally {
    await redis.quit().catch(() => undefined);
  }
}

/** Re-export expect để spec dùng cùng instance. */
export { expect };
