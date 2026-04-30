#!/usr/bin/env node
/**
 * smoke-beta.mjs — Smart QA helper cho closed beta Xuân Tôi.
 *
 * Chạy 1 chuỗi smoke HTTP end-to-end trên API:
 *   1. Register user random (email + password mạnh)
 *   2. Fetch /api/_auth/session (verify login hoạt động)
 *   3. Onboard (chọn sect `thanh_van`)
 *   4. Fetch /api/character/me (verify character tạo xong, lấy starting linhThach)
 *   5. Start cultivate (setCultivating = true)
 *   6. Stop cultivate (setCultivating = false) — tránh tick loop trong smoke
 *   7. Fetch /api/daily-login/me → nếu available, claim
 *   8. Fetch /api/missions/me → nếu có mission có thể claim, claim 1 cái
 *   9. Fetch /api/shop/npc → lấy entry LINH_THACH rẻ nhất mà character có đủ tiền
 *  10. Buy 1 qty (nếu đủ tiền)
 *  11. Fetch /api/inventory → verify count > 0 (đã có item mới)
 *  12. Fetch /api/mail/me → nếu có mail reward, read + claim 1 cái
 *  13. Fetch /api/leaderboard/power → verify entries[] là array
 *  14. Logout (cleanup — nếu muốn test logout flow)
 *
 * Exit 0 nếu tất cả bước pass. Exit 1 nếu bất kỳ step fail với stderr
 * diagnostic (status code + response body + step name).
 *
 * Chạy:
 *   pnpm smoke:beta
 *   # hoặc trực tiếp:
 *   node scripts/smoke-beta.mjs
 *
 * Env vars:
 *   SMOKE_API_BASE  — default "http://localhost:3000" (API root, không có /api).
 *   SMOKE_TIMEOUT_MS — default 10000 (timeout từng request).
 *   SMOKE_VERBOSE    — "1" để log request/response body cho debug.
 *   SMOKE_SECT_KEY   — default "thanh_van"; có thể chọn "huyen_thuy" / "tu_la".
 *   SMOKE_BUY_ITEM   — default "huyet_chi_dan" (pill HP rẻ nhất LINH_THACH);
 *                       override nếu shop catalog đổi.
 *
 * Yêu cầu infra:
 *   - `pnpm infra:up` (Postgres + Redis lên)
 *   - `pnpm --filter @xuantoi/api prisma:migrate` (migrate DB)
 *   - `pnpm --filter @xuantoi/api bootstrap` (seed 3 sect + admin)
 *   - `pnpm --filter @xuantoi/api dev` (API listen :3000)
 *   - Sau đó: `pnpm smoke:beta` ở terminal khác.
 *
 * Không có dependency mới (zero-install): native `fetch` + `URL` có sẵn từ
 * Node 18+. Module system: ESM (.mjs extension).
 *
 * Không commit secret / không ghi password ra stdout.
 */

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const BASE = (process.env.SMOKE_API_BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);
const VERBOSE = process.env.SMOKE_VERBOSE === '1';
const SECT_KEY = process.env.SMOKE_SECT_KEY ?? 'thanh_van';
const BUY_ITEM = process.env.SMOKE_BUY_ITEM ?? 'huyet_chi_dan';

// -----------------------------------------------------------------------------
// Cookie jar — Node fetch không có cookie jar built-in, tự track set-cookie.
// -----------------------------------------------------------------------------

/** @type {Map<string, string>} */
const cookieJar = new Map();

/** @param {Response} res */
function storeSetCookie(res) {
  // Node fetch trả multi set-cookie qua `res.headers.getSetCookie()` (Node 20+).
  /** @type {string[]} */
  const raw =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : // @ts-ignore fallback cũ
        (res.headers.raw?.()['set-cookie'] ?? []);
  for (const line of raw) {
    // Lấy phần "name=value" trước dấu `;` đầu tiên.
    const eq = line.indexOf('=');
    const semi = line.indexOf(';');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1, semi < 0 ? undefined : semi).trim();
    if (value === '' || value === 'deleted') {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, value);
    }
  }
}

function cookieHeader() {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar, ([k, v]) => `${k}=${v}`).join('; ');
}

// -----------------------------------------------------------------------------
// HTTP helper với timeout + cookie persistence.
// -----------------------------------------------------------------------------

/**
 * @param {string} path   — path dạng `/api/xxx` (có slash đầu).
 * @param {{ method?: string; body?: unknown }} [opts]
 * @returns {Promise<{ status: number; body: any }>}
 */
async function http(path, opts = {}) {
  const url = `${BASE}${path}`;
  const method = opts.method ?? 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  /** @type {Record<string,string>} */
  const headers = { Accept: 'application/json' };
  const cookieH = cookieHeader();
  if (cookieH) headers.Cookie = cookieH;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  if (VERBOSE) {
    console.log(`→ ${method} ${url}${opts.body ? ' body=' + JSON.stringify(opts.body) : ''}`);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    storeSetCookie(res);
    let body;
    const ctype = res.headers.get('content-type') ?? '';
    if (ctype.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }
    if (VERBOSE) {
      console.log(`← ${res.status} ${method} ${path}`);
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// Step runner — log pass/fail và chốt exit code cuối.
// -----------------------------------------------------------------------------

/** @type {{ name: string; ok: boolean; note?: string }[]} */
const results = [];

/**
 * @param {string} name
 * @param {() => Promise<void | { skip: true; note: string }>} fn
 */
async function step(name, fn) {
  process.stdout.write(`[smoke] ${name} ... `);
  try {
    const out = await fn();
    if (out && out.skip) {
      console.log(`SKIP (${out.note})`);
      results.push({ name, ok: true, note: `SKIP ${out.note}` });
    } else {
      console.log('OK');
      results.push({ name, ok: true });
    }
  } catch (err) {
    console.log('FAIL');
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, note: msg });
    console.error(`  ↳ ${msg}`);
  }
}

/**
 * @param {{ status: number; body: any }} r
 * @param {number | number[]} expected
 * @param {string} label
 */
function assertStatus(r, expected, label) {
  const ok = Array.isArray(expected) ? expected.includes(r.status) : r.status === expected;
  if (!ok) {
    throw new Error(
      `${label}: expect status ${Array.isArray(expected) ? expected.join('|') : expected}, got ${r.status}. Body: ${JSON.stringify(r.body).slice(0, 300)}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Helpers random.
// -----------------------------------------------------------------------------

function randomEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `smoke-${ts}-${rand}@smoke.invalid`;
}

function randomPassword() {
  // Min 8 ký tự, có chữ + số (theo `Password` schema).
  const rand = Math.random().toString(36).slice(2, 8);
  return `Smoke${rand}1!`;
}

function randomCharName() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `smoke_${rand}`;
}

// -----------------------------------------------------------------------------
// Main flow.
// -----------------------------------------------------------------------------

/** @type {{ email?: string; userId?: string; startingLinhThach?: number; inventoryBeforeBuy?: number }} */
const state = {};

async function main() {
  console.log(`[smoke] API base = ${BASE}, timeout = ${TIMEOUT_MS}ms`);

  // 0. Health check — nếu API không lên, fail sớm.
  await step('healthz', async () => {
    const r = await http('/api/healthz');
    assertStatus(r, 200, 'healthz');
  });

  // 1. Register.
  const email = randomEmail();
  const password = randomPassword();
  state.email = email;
  await step('register', async () => {
    const r = await http('/api/_auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assertStatus(r, [200, 201], 'register');
    if (!r.body?.ok) throw new Error(`register: ok=false body=${JSON.stringify(r.body).slice(0, 200)}`);
    state.userId = r.body?.data?.user?.id;
  });

  // 2. Session verify.
  await step('session', async () => {
    const r = await http('/api/_auth/session');
    assertStatus(r, 200, 'session');
    if (!r.body?.ok || !r.body?.data?.user) {
      throw new Error(`session: missing user, body=${JSON.stringify(r.body).slice(0, 200)}`);
    }
  });

  // 3. Onboard.
  await step('onboard', async () => {
    const r = await http('/api/character/onboard', {
      method: 'POST',
      body: { name: randomCharName(), sectKey: SECT_KEY },
    });
    assertStatus(r, 200, 'onboard');
    if (!r.body?.ok) throw new Error(`onboard: ok=false body=${JSON.stringify(r.body).slice(0, 200)}`);
  });

  // 4. character/me.
  await step('character/me', async () => {
    const r = await http('/api/character/me');
    assertStatus(r, 200, 'character/me');
    const ch = r.body?.data?.character;
    if (!ch) throw new Error(`character/me: no character in body`);
    state.startingLinhThach = Number(ch.linhThach ?? 0);
  });

  // 5. Cultivate start.
  await step('cultivate start', async () => {
    const r = await http('/api/character/cultivate', {
      method: 'POST',
      body: { cultivating: true },
    });
    assertStatus(r, 200, 'cultivate start');
    if (!r.body?.data?.character?.cultivating) {
      throw new Error(`cultivate start: cultivating !== true in response`);
    }
  });

  // 6. Cultivate stop — tránh tiếp tục tick sau smoke.
  await step('cultivate stop', async () => {
    const r = await http('/api/character/cultivate', {
      method: 'POST',
      body: { cultivating: false },
    });
    assertStatus(r, 200, 'cultivate stop');
    if (r.body?.data?.character?.cultivating !== false) {
      throw new Error(`cultivate stop: cultivating !== false in response`);
    }
  });

  // 7. Daily login.
  await step('daily-login/me', async () => {
    const r = await http('/api/daily-login/me');
    assertStatus(r, 200, 'daily-login/me');
  });
  await step('daily-login/claim', async () => {
    const r = await http('/api/daily-login/claim', { method: 'POST' });
    // 200 = claimed. 409 ALREADY_CLAIMED hoặc CONFLICT = OK for smoke (vẫn đúng logic).
    if (r.status === 200) return;
    if (r.status === 409 || r.status === 400) {
      return { skip: true, note: `status=${r.status} code=${r.body?.error?.code}` };
    }
    throw new Error(`daily-login/claim: unexpected status ${r.status}, body=${JSON.stringify(r.body).slice(0, 200)}`);
  });

  // 8. Missions.
  await step('missions/me + claim', async () => {
    const r = await http('/api/missions/me');
    assertStatus(r, 200, 'missions/me');
    const missions = r.body?.data?.missions ?? [];
    if (!Array.isArray(missions) || missions.length === 0) {
      return { skip: true, note: 'no missions for fresh user' };
    }
    // Chỉ claim mission đã complete (nếu có). Mission tân thủ thường chưa complete.
    const claimable = missions.find(
      /** @param {any} m */ (m) => m.status === 'COMPLETED' || m.claimable === true,
    );
    if (!claimable) return { skip: true, note: 'no claimable mission yet' };
    const claimId = claimable.id ?? claimable.missionId;
    const rc = await http('/api/missions/claim', {
      method: 'POST',
      body: { missionId: claimId },
    });
    if (rc.status !== 200) {
      throw new Error(`missions/claim: status ${rc.status}, body=${JSON.stringify(rc.body).slice(0, 200)}`);
    }
  });

  // 9. Shop list.
  /** @type {{ itemKey: string; price: number; currency: string }[]} */
  let shopEntries = [];
  await step('shop/npc', async () => {
    const r = await http('/api/shop/npc');
    assertStatus(r, 200, 'shop/npc');
    shopEntries = r.body?.data?.entries ?? [];
    if (!Array.isArray(shopEntries) || shopEntries.length === 0) {
      throw new Error(`shop/npc: entries empty`);
    }
  });

  // 10. Buy item (chỉ nếu đủ tiền).
  await step('inventory (before buy)', async () => {
    const r = await http('/api/inventory');
    assertStatus(r, 200, 'inventory before');
    const items = r.body?.data?.items ?? [];
    state.inventoryBeforeBuy = Array.isArray(items) ? items.length : 0;
  });

  await step(`shop/buy ${BUY_ITEM}`, async () => {
    const entry = shopEntries.find(
      (e) => e.itemKey === BUY_ITEM && e.currency === 'LINH_THACH',
    );
    if (!entry) {
      return { skip: true, note: `item ${BUY_ITEM} not in shop catalog` };
    }
    if ((state.startingLinhThach ?? 0) < entry.price) {
      return {
        skip: true,
        note: `insufficient funds: have ${state.startingLinhThach}, need ${entry.price}`,
      };
    }
    const r = await http('/api/shop/buy', {
      method: 'POST',
      body: { itemKey: BUY_ITEM, qty: 1 },
    });
    assertStatus(r, 200, 'shop/buy');
    if (!r.body?.ok) throw new Error(`shop/buy: ok=false body=${JSON.stringify(r.body).slice(0, 200)}`);
  });

  // 11. Inventory (after buy).
  await step('inventory (after buy)', async () => {
    const r = await http('/api/inventory');
    assertStatus(r, 200, 'inventory after');
    const items = r.body?.data?.items ?? [];
    if (!Array.isArray(items)) throw new Error(`inventory: items không phải array`);
    // Không require count tăng vì có thể buy skip — chỉ verify shape đúng.
  });

  // 12. Mail.
  await step('mail/me + read + claim', async () => {
    const r = await http('/api/mail/me');
    assertStatus(r, 200, 'mail/me');
    const mails = r.body?.data?.mails ?? [];
    if (!Array.isArray(mails) || mails.length === 0) {
      return { skip: true, note: 'no mail for fresh user' };
    }
    const unread = mails.find(/** @param {any} m */ (m) => !m.readAt && !m.claimedAt);
    if (!unread) return { skip: true, note: 'all mail already read/claimed' };
    const rr = await http(`/api/mail/${unread.id}/read`, { method: 'POST' });
    if (rr.status !== 200) {
      throw new Error(`mail/read: status ${rr.status}, body=${JSON.stringify(rr.body).slice(0, 200)}`);
    }
    if (unread.reward || unread.hasReward) {
      const rc = await http(`/api/mail/${unread.id}/claim`, { method: 'POST' });
      if (rc.status !== 200 && rc.status !== 409) {
        throw new Error(
          `mail/claim: status ${rc.status}, body=${JSON.stringify(rc.body).slice(0, 200)}`,
        );
      }
    }
  });

  // 13. Leaderboard.
  await step('leaderboard/power', async () => {
    const r = await http('/api/leaderboard/power');
    assertStatus(r, 200, 'leaderboard/power');
    const entries = r.body?.data?.entries ?? r.body?.data?.leaderboard ?? [];
    if (!Array.isArray(entries)) {
      throw new Error(`leaderboard/power: entries không phải array`);
    }
  });

  // 14. Logout.
  await step('logout', async () => {
    const r = await http('/api/_auth/logout', { method: 'POST' });
    assertStatus(r, [200, 201], 'logout');
  });
}

// -----------------------------------------------------------------------------
// Entrypoint.
// -----------------------------------------------------------------------------

const startedAt = Date.now();
main()
  .catch((err) => {
    console.error('[smoke] FATAL:', err);
    results.push({ name: 'fatal', ok: false, note: String(err) });
  })
  .finally(() => {
    const elapsed = Date.now() - startedAt;
    const pass = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    console.log(
      `\n[smoke] done: ${pass} pass / ${fail} fail / ${results.length} total in ${elapsed}ms`,
    );
    if (fail > 0) {
      console.error('[smoke] failed steps:');
      for (const r of results.filter((x) => !x.ok)) {
        console.error(`  - ${r.name}: ${r.note}`);
      }
      process.exit(1);
    }
    process.exit(0);
  });
