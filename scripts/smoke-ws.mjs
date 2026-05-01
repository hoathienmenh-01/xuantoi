#!/usr/bin/env node
/**
 * smoke-ws.mjs — WebSocket realtime safety smoke cho Xuân Tôi.
 *
 * Mục tiêu: trước khi mở rộng Phase 10 content scale, có 1 script "tự bay" 5
 * phút verify các invariant realtime cốt lõi (gateway `apps/api/src/modules/
 * realtime/realtime.gateway.ts` + service `realtime.service.ts`):
 *
 *   1. Cookie auth                    — chỉ cookie `xt_access` hợp lệ mới
 *                                       handshake OK; thiếu cookie → reject.
 *   2. userId mapping isolation       — `emitToUser(uid, …)` chỉ deliver vào
 *                                       socket của uid đó, không leak qua
 *                                       socket của user khác.
 *   3. Chat broadcast contract        — `POST /api/chat/world` → 1 frame
 *                                       `chat:msg` deliver cho TẤT CẢ socket
 *                                       đang online (đúng 1 frame/send/socket
 *                                       — không duplicate).
 *   4. Mission throttle               — `mission:progress` có throttle
 *                                       `MISSION_PROGRESS_PUSH_THROTTLE_MS`
 *                                       (500ms) per user; spam track trong
 *                                       cùng cửa sổ → drop frame thừa.
 *   5. Reconnect/userId persistence   — disconnect rồi reconnect với cùng
 *                                       cookie → userId map vẫn intact, vẫn
 *                                       nhận state:update + chat broadcast
 *                                       sau reconnect (không cần re-auth).
 *   6. Logout clears WS auth          — sau `POST /api/_auth/logout`, cookie
 *                                       xt_access bị clear → reconnect WS
 *                                       phải fail UNAUTHENTICATED.
 *
 * Optional (gated): cultivate:tick — `BullMQ` cron mỗi `CULTIVATION_TICK_MS`
 * (30s). Step bật cultivating + chờ tick chỉ chạy khi
 * `SMOKE_WAIT_TICK_MS > 0` (default 0 = SKIP để smoke nhanh dưới 30s). Khi
 * Phase 10 content PR liên quan cultivation realtime, chạy với
 * `SMOKE_WAIT_TICK_MS=35000` để verify push thực tế.
 *
 * Chạy:
 *   pnpm smoke:ws
 *   # hoặc trực tiếp:
 *   node scripts/smoke-ws.mjs
 *
 *   # bật cultivate:tick check (cộng ~30s):
 *   SMOKE_WAIT_TICK_MS=35000 pnpm smoke:ws
 *
 * Env vars:
 *   SMOKE_API_BASE       — default "http://localhost:3000".
 *   SMOKE_TIMEOUT_MS     — default 10000ms / HTTP request.
 *   SMOKE_VERBOSE        — "1" để log request/response/WS frame (debug).
 *   SMOKE_SECT_KEY       — default "thanh_van".
 *   SMOKE_WS_TIMEOUT_MS  — default 4000ms / WS connect + frame wait.
 *   SMOKE_THROTTLE_MS    — default 500ms (phải khớp shared
 *                          MISSION_PROGRESS_PUSH_THROTTLE_MS).
 *   SMOKE_WAIT_TICK_MS   — default 0 (SKIP cultivate:tick step). Đặt > 0 để
 *                          chờ tick (≥ CULTIVATION_TICK_MS = 30000 + buffer).
 *
 * Yêu cầu môi trường (giống smoke:beta / smoke:economy):
 *   - `pnpm infra:up` (Postgres + Redis)
 *   - `pnpm --filter @xuantoi/api exec prisma migrate deploy`
 *   - `pnpm --filter @xuantoi/api dev` (API listen :3000, WS path /ws)
 *   - Tab khác: `pnpm smoke:ws`
 *
 * Smoke này KHÔNG yêu cầu admin login — chỉ dùng `/api/_auth/*`,
 * `/api/character/*`, `/api/chat/world`. Tự tạo 2 user random + 2 character
 * (A, B) để verify isolation. Cleanup: logout cả 2 user.
 *
 * KHÔNG đụng payment thật, KHÔNG dùng secret thật, KHÔNG mutate DB ngoài 2
 * user mới do chính smoke tạo (random email + character name).
 *
 * Exit code:
 *   0 — toàn bộ invariant OK.
 *   1 — ít nhất 1 invariant fail (stderr in chi tiết step + diagnostic).
 *
 * Zero new dep: `socket.io-client` đã là dep của `@xuantoi/api` (devDep) +
 * `@xuantoi/web` (dep). Smoke load qua `createRequire` từ apps/api/package.json
 * — không thêm dep mới ở root.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const BASE = (process.env.SMOKE_API_BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);
const WS_TIMEOUT_MS = Number(process.env.SMOKE_WS_TIMEOUT_MS ?? 4_000);
const THROTTLE_MS = Number(process.env.SMOKE_THROTTLE_MS ?? 500);
const WAIT_TICK_MS = Number(process.env.SMOKE_WAIT_TICK_MS ?? 0);
const VERBOSE = process.env.SMOKE_VERBOSE === '1';
const SECT_KEY = process.env.SMOKE_SECT_KEY ?? 'thanh_van';

// WS origin: socket.io-client cần origin (scheme://host[:port]) — KHÔNG kèm
// path. Path `/ws` truyền qua opts. Dùng URL-parse để hỗ trợ trường hợp user
// set SMOKE_API_BASE có path (vd `http://api.local/api`).
function resolveWsOrigin(httpBase) {
  try {
    const u = new URL(httpBase);
    return `${u.protocol}//${u.host}`;
  } catch {
    return httpBase;
  }
}
const WS_ORIGIN = resolveWsOrigin(BASE);

// -----------------------------------------------------------------------------
// Load socket.io-client từ workspace (zero new dep ở root).
// -----------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiPkgJson = path.resolve(__dirname, '..', 'apps', 'api', 'package.json');
const requireFromApi = createRequire(apiPkgJson);
/** @type {{ io: (url: string, opts?: Record<string, unknown>) => any }} */
let socketIo;
try {
  socketIo = requireFromApi('socket.io-client');
} catch (e) {
  console.error(
    '[smoke:ws] FATAL: không load được socket.io-client từ apps/api. ' +
      `Hãy chạy 'pnpm install' trước. (${(e instanceof Error ? e.message : String(e))})`,
  );
  process.exit(1);
}
const { io } = socketIo;

// -----------------------------------------------------------------------------
// Cookie jar — 1 jar / user. Node fetch không có jar built-in, tự track.
// -----------------------------------------------------------------------------

class CookieJar {
  constructor() {
    /** @type {Map<string, string>} */
    this.store = new Map();
  }
  /** @param {Response} res */
  storeFromResponse(res) {
    /** @type {string[]} */
    const raw =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : // @ts-ignore fallback
          (res.headers.raw?.()['set-cookie'] ?? []);
    for (const line of raw) {
      const eq = line.indexOf('=');
      const semi = line.indexOf(';');
      if (eq < 0) continue;
      const name = line.slice(0, eq).trim();
      const value = line.slice(eq + 1, semi < 0 ? undefined : semi).trim();
      if (value === '' || value === 'deleted') {
        this.store.delete(name);
      } else {
        this.store.set(name, value);
      }
    }
  }
  header() {
    if (this.store.size === 0) return undefined;
    return Array.from(this.store, ([k, v]) => `${k}=${v}`).join('; ');
  }
  get(name) {
    return this.store.get(name);
  }
  clear() {
    this.store.clear();
  }
}

// -----------------------------------------------------------------------------
// HTTP helper với timeout + cookie persistence (per jar).
// -----------------------------------------------------------------------------

/**
 * @param {CookieJar} jar
 * @param {string} pathname  — `/api/...`
 * @param {{ method?: string; body?: unknown }} [opts]
 * @returns {Promise<{ status: number; body: any }>}
 */
async function http(jar, pathname, opts = {}) {
  const url = `${BASE}${pathname}`;
  const method = opts.method ?? 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  /** @type {Record<string,string>} */
  const headers = { Accept: 'application/json' };
  const cookieH = jar.header();
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
    jar.storeFromResponse(res);
    let body;
    const ctype = res.headers.get('content-type') ?? '';
    if (ctype.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }
    if (VERBOSE) console.log(`← ${res.status} ${method} ${pathname}`);
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// Step runner.
// -----------------------------------------------------------------------------

/** @type {{ name: string; ok: boolean; note?: string }[]} */
const results = [];

/**
 * @param {string} name
 * @param {() => Promise<void | { skip: true; note: string }>} fn
 */
async function step(name, fn) {
  process.stdout.write(`[smoke:ws] ${name} ... `);
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

/** @param {unknown} cond @param {string} msg */
function assert(cond, msg) {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

// -----------------------------------------------------------------------------
// WS helpers.
// -----------------------------------------------------------------------------

/**
 * Tạo client socket. Truyền cookie qua extraHeaders (giống browser
 * `withCredentials`). `forceNew` để tránh share connection giữa user A/B.
 *
 * @param {CookieJar | null} jar  null = no cookie (test reject path).
 * @returns {any} ClientSocket
 */
function newSock(jar) {
  /** @type {Record<string, string>} */
  const headers = {};
  const cookieH = jar?.header();
  if (cookieH) headers.cookie = cookieH;
  return io(WS_ORIGIN, {
    path: '/ws',
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: headers,
    timeout: WS_TIMEOUT_MS,
  });
}

/**
 * @param {any} sock
 * @returns {Promise<void>}
 */
function waitConnect(sock) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS connect timeout')), WS_TIMEOUT_MS);
    sock.once('connect', () => {
      clearTimeout(t);
      resolve();
    });
    sock.once('connect_error', (err) => {
      clearTimeout(t);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Đợi socket đóng. Pattern khớp realtime.gateway.test.ts: server-side
 * `client.emit('error', …); client.disconnect(true)` không trigger
 * `connect_error` ở client (vì handshake transport đã thành công), nó
 * trigger `disconnect` event. Smoke phải accept cả 2 path:
 *   - connect_error (handshake fail trước khi connect, vd CORS/timeout)
 *   - connect → disconnect (server reject sau handshake — pattern Nest gateway).
 *
 * @param {any} sock
 * @param {number} [timeoutMs]
 * @returns {Promise<{ connected: boolean; reason?: string; error?: any }>}
 *   trạng thái cuối — connected=true chỉ khi vẫn online sau timeout.
 */
function waitClosed(sock, timeoutMs = WS_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      resolve({ connected: !!sock.connected });
    }, timeoutMs);
    sock.once('connect_error', (err) => {
      clearTimeout(t);
      resolve({ connected: false, error: err });
    });
    sock.once('disconnect', (reason) => {
      clearTimeout(t);
      resolve({ connected: false, reason: String(reason) });
    });
  });
}

/**
 * Đợi đúng 1 frame của event `name` trong `timeoutMs`. Trả về frame body (đã
 * unwrap WsFrame nếu server emit dạng frame).
 *
 * @param {any} sock
 * @param {string} name
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
function waitEvent(sock, name, timeoutMs = WS_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`WS event "${name}" timeout`)), timeoutMs);
    sock.once(name, (frame) => {
      clearTimeout(t);
      if (VERBOSE) console.log(`◀ ${name}`, JSON.stringify(frame).slice(0, 200));
      resolve(frame);
    });
  });
}

/**
 * Bật listener đếm frame của event `name` cho đến khi gọi `stop()`. Trả về
 * mảng các frame đã nhận.
 *
 * @param {any} sock
 * @param {string} name
 * @returns {{ frames: any[]; stop: () => void }}
 */
function captureEvents(sock, name) {
  /** @type {any[]} */
  const frames = [];
  const handler = (frame) => {
    frames.push(frame);
    if (VERBOSE) console.log(`◀ capture ${name}`, JSON.stringify(frame).slice(0, 160));
  };
  sock.on(name, handler);
  return {
    frames,
    stop: () => sock.off(name, handler),
  };
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Verify shape của WsFrame: { type, payload, ts }. Trả về payload.
 * @param {any} frame
 * @param {string} expectedType
 * @returns {any}
 */
function assertFrame(frame, expectedType) {
  assert(frame && typeof frame === 'object', `frame phải là object, got ${typeof frame}`);
  assert(frame.type === expectedType, `frame.type = "${frame.type}" ≠ "${expectedType}"`);
  assert(typeof frame.ts === 'number' && frame.ts > 0, `frame.ts phải là epoch number > 0, got ${frame.ts}`);
  assert(frame.payload !== undefined, `frame.payload phải có`);
  return frame.payload;
}

// -----------------------------------------------------------------------------
// Random helpers.
// -----------------------------------------------------------------------------

function randomEmail(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `smoke-ws-${prefix}-${ts}-${rand}@smoke.invalid`;
}
function randomPassword() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `Smoke${rand}1!`;
}
function randomCharName(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ws_${prefix}_${rand}`;
}

// -----------------------------------------------------------------------------
// Main flow.
// -----------------------------------------------------------------------------

/**
 * @type {{
 *   userA?: { jar: CookieJar; email: string; userId?: string; characterId?: string };
 *   userB?: { jar: CookieJar; email: string; userId?: string; characterId?: string };
 *   sockA?: any;
 *   sockB?: any;
 * }}
 */
const state = {};

async function setupUser(jar, prefix) {
  const email = randomEmail(prefix);
  const password = randomPassword();
  const reg = await http(jar, '/api/_auth/register', {
    method: 'POST',
    body: { email, password },
  });
  assertStatus(reg, [200, 201], `register ${prefix}`);
  if (!reg.body?.ok) throw new Error(`register ${prefix}: ok=false`);
  const userId = reg.body?.data?.user?.id;
  const onb = await http(jar, '/api/character/onboard', {
    method: 'POST',
    body: { name: randomCharName(prefix), sectKey: SECT_KEY },
  });
  assertStatus(onb, 200, `onboard ${prefix}`);
  if (!onb.body?.ok) throw new Error(`onboard ${prefix}: ok=false`);
  const me = await http(jar, '/api/character/me');
  assertStatus(me, 200, `character/me ${prefix}`);
  const ch = me.body?.data?.character;
  if (!ch?.id) throw new Error(`character/me ${prefix}: missing character.id`);
  return { jar, email, userId, characterId: ch.id };
}

async function main() {
  console.log(
    `[smoke:ws] API base = ${BASE}, WS origin = ${WS_ORIGIN}, ws timeout = ${WS_TIMEOUT_MS}ms, ` +
      `throttle = ${THROTTLE_MS}ms, wait-tick = ${WAIT_TICK_MS}ms`,
  );

  // 0. Health check — fail sớm nếu API không lên.
  await step('healthz', async () => {
    const r = await http(new CookieJar(), '/api/healthz');
    assertStatus(r, 200, 'healthz');
  });

  // 1. Tạo 2 user (A, B) + 2 character → cookie jar độc lập.
  await step('setup user A (register + onboard + me)', async () => {
    const jar = new CookieJar();
    state.userA = await setupUser(jar, 'A');
  });
  await step('setup user B (register + onboard + me)', async () => {
    const jar = new CookieJar();
    state.userB = await setupUser(jar, 'B');
  });

  // 2. WS auth: thiếu cookie → server emit error + disconnect (pattern Nest
  //    gateway). Khớp test "không có cookie + không có handshake.auth → bị
  //    disconnect ngay" trong realtime.gateway.test.ts.
  await step('WS auth: missing cookie → server disconnect (UNAUTHENTICATED)', async () => {
    const sock = newSock(null);
    try {
      const status = await waitClosed(sock, 1500);
      assert(
        status.connected === false,
        `INVARIANT vi phạm: WS không cookie phải bị disconnect, nhưng vẫn connected sau 1.5s (sock.connected=${sock.connected})`,
      );
    } finally {
      sock.removeAllListeners();
      sock.disconnect();
    }
  });

  // 3. WS auth: cookie hợp lệ → connect OK + map đúng userId.
  await step('WS connect A with cookie xt_access — handshake OK', async () => {
    const a = state.userA;
    if (!a) throw new Error('userA chưa setup');
    state.sockA = newSock(a.jar);
    await waitConnect(state.sockA);
    assert(state.sockA.connected === true, `sockA.connected phải true sau connect`);
    assert(typeof state.sockA.id === 'string' && state.sockA.id.length > 0, `sockA.id phải string`);
  });
  await step('WS connect B with cookie xt_access — handshake OK', async () => {
    const b = state.userB;
    if (!b) throw new Error('userB chưa setup');
    state.sockB = newSock(b.jar);
    await waitConnect(state.sockB);
    assert(state.sockB.connected === true, `sockB.connected phải true sau connect`);
  });

  // 4. ping → pong roundtrip (basic protocol sanity).
  //    Nest gateway @SubscribeMessage('ping') return value → socket.io ack.
  //    Client emit với 3rd arg = ack callback nhận frame trả về.
  await step('ping → pong roundtrip on sockA (ack callback)', async () => {
    const frame = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ping ack timeout')), WS_TIMEOUT_MS);
      state.sockA.emit('ping', {}, (response) => {
        clearTimeout(t);
        resolve(response);
      });
    });
    assertFrame(frame, 'pong');
  });

  // 5. state:update push isolation: trigger cultivate trên A → A nhận, B KHÔNG.
  await step('state:update isolation — emitToUser deliver đúng user (A only)', async () => {
    const recvA = waitEvent(state.sockA, 'state:update', WS_TIMEOUT_MS);
    const capB = captureEvents(state.sockB, 'state:update');
    try {
      const r = await http(state.userA.jar, '/api/character/cultivate', {
        method: 'POST',
        body: { cultivating: true },
      });
      assertStatus(r, 200, 'character/cultivate(true)');
      const frame = await recvA;
      const payload = assertFrame(frame, 'state:update');
      assert(
        payload.id === state.userA.characterId,
        `state:update.payload.id = ${payload.id} ≠ userA.characterId = ${state.userA.characterId}`,
      );
      assert(
        payload.cultivating === true,
        `state:update.payload.cultivating phải true, got ${payload.cultivating}`,
      );
      // Đợi 1 chút để frame leak (nếu có) đi tới B.
      await sleep(150);
      assert(
        capB.frames.length === 0,
        `INVARIANT vi phạm: emitToUser leak qua user khác — B nhận ${capB.frames.length} state:update của A`,
      );
    } finally {
      capB.stop();
    }
  });

  // 6. chat:msg broadcast: A gửi → cả A và B đều nhận đúng 1 frame mỗi socket.
  await step('chat:msg broadcast — A send → both A & B receive exactly 1 frame', async () => {
    const text = `smoke-${Date.now().toString(36)}`;
    const recvA = waitEvent(state.sockA, 'chat:msg', WS_TIMEOUT_MS);
    const recvB = waitEvent(state.sockB, 'chat:msg', WS_TIMEOUT_MS);
    const r = await http(state.userA.jar, '/api/chat/world', {
      method: 'POST',
      body: { text },
    });
    assertStatus(r, 200, 'chat/world');
    const [frameA, frameB] = await Promise.all([recvA, recvB]);
    const payloadA = assertFrame(frameA, 'chat:msg');
    const payloadB = assertFrame(frameB, 'chat:msg');
    assert(payloadA.text === text, `chat:msg.text(A) = "${payloadA.text}" ≠ "${text}"`);
    assert(payloadB.text === text, `chat:msg.text(B) = "${payloadB.text}" ≠ "${text}"`);
    assert(
      payloadA.senderId === state.userA.characterId,
      `chat:msg.senderId(A) = ${payloadA.senderId} ≠ characterId A = ${state.userA.characterId}`,
    );
    assert(
      payloadB.senderId === state.userA.characterId,
      `chat:msg.senderId(B) = ${payloadB.senderId} ≠ characterId A (broadcast nguồn) = ${state.userA.characterId}`,
    );
    assert(payloadA.id === payloadB.id, `chat:msg.id A vs B khác nhau (broadcast phải cùng row)`);
    assert(payloadA.channel === 'WORLD', `chat:msg.channel = ${payloadA.channel} ≠ WORLD`);
  });

  // 7. chat:msg no duplicate: 1 send → đúng 1 frame trong window 600ms.
  await step('chat:msg no duplicate — 1 send → exactly 1 frame per socket', async () => {
    const cap = captureEvents(state.sockA, 'chat:msg');
    try {
      const r = await http(state.userA.jar, '/api/chat/world', {
        method: 'POST',
        body: { text: `smoke-once-${Date.now().toString(36)}` },
      });
      assertStatus(r, 200, 'chat/world dedup');
      await sleep(600);
      assert(
        cap.frames.length === 1,
        `INVARIANT vi phạm: 1 chat send phải produce đúng 1 frame, got ${cap.frames.length}`,
      );
    } finally {
      cap.stop();
    }
  });

  // 8. mission:progress throttle: spam N chat trong cửa sổ < THROTTLE_MS → drop frame thừa.
  await step(
    `mission:progress throttle — 5 chats trong < ${THROTTLE_MS}ms → frames ≤ 1`,
    async () => {
      // Đợi window cũ trôi qua trước khi đo.
      await sleep(THROTTLE_MS + 100);
      const cap = captureEvents(state.sockA, 'mission:progress');
      try {
        const t0 = Date.now();
        // 5 send tuần tự — fire-and-forget để tận dụng cùng cửa sổ; nếu HTTP
        // chậm vượt THROTTLE_MS thì step sẽ skip với note.
        const sends = [];
        for (let i = 0; i < 5; i++) {
          sends.push(
            http(state.userA.jar, '/api/chat/world', {
              method: 'POST',
              body: { text: `throttle-${i}-${Date.now().toString(36)}` },
            }),
          );
        }
        const responses = await Promise.all(sends);
        for (const r of responses) {
          // Chấp nhận 200 (gửi OK) hoặc 429 (rate-limited bởi chat slid window
          // 8 tin / 30s — không ảnh hưởng invariant throttle WS).
          assert(
            r.status === 200 || r.status === 429,
            `chat/world spam: unexpected status ${r.status}`,
          );
        }
        const elapsed = Date.now() - t0;
        await sleep(150);
        if (elapsed >= THROTTLE_MS) {
          // Server quá chậm — không thể assert throttle chính xác. Log để
          // operator biết nhưng không fail invariant.
          return {
            skip: true,
            note: `5 chat send mất ${elapsed}ms ≥ throttle ${THROTTLE_MS}ms — env quá chậm để verify`,
          };
        }
        // Ít nhất phải có 0 hoặc 1 frame trong cửa sổ throttle. Nếu > 1 → throttle vỡ.
        assert(
          cap.frames.length <= 1,
          `INVARIANT vi phạm: throttle ${THROTTLE_MS}ms vỡ — nhận ${cap.frames.length} frame mission:progress trong ${elapsed}ms`,
        );
        // Verify shape nếu có frame.
        if (cap.frames.length === 1) {
          const payload = assertFrame(cap.frames[0], 'mission:progress');
          assert(
            payload.characterId === state.userA.characterId,
            `mission:progress.characterId = ${payload.characterId} ≠ ${state.userA.characterId}`,
          );
          assert(Array.isArray(payload.changes), `mission:progress.changes phải array`);
        }
      } finally {
        cap.stop();
      }
    },
  );

  // 9. mission:progress next window: chờ > throttle → 1 send → tối đa 1 frame.
  await step('mission:progress next window — wait > throttle → frames ≤ 1', async () => {
    await sleep(THROTTLE_MS + 200);
    const cap = captureEvents(state.sockA, 'mission:progress');
    try {
      const r = await http(state.userA.jar, '/api/chat/world', {
        method: 'POST',
        body: { text: `throttle-next-${Date.now().toString(36)}` },
      });
      assert(r.status === 200 || r.status === 429, `chat/world next: status ${r.status}`);
      await sleep(THROTTLE_MS + 200);
      assert(
        cap.frames.length <= 1,
        `INVARIANT vi phạm: 1 send 1 cửa sổ phải produce ≤ 1 frame, got ${cap.frames.length}`,
      );
    } finally {
      cap.stop();
    }
  });

  // 10. Reconnect: drop sockA → reconnect với cùng cookie → vẫn nhận state:update +
  //     vẫn nhận chat broadcast (userId map intact). Verify KHÔNG có frame buffered
  //     duplicate từ session cũ leak qua session mới.
  await step('reconnect A — disconnect + reconnect with same cookie', async () => {
    const a = state.userA;
    if (!a) throw new Error('userA chưa setup');
    const oldSid = state.sockA.id;
    state.sockA.removeAllListeners();
    state.sockA.disconnect();
    await sleep(150);
    state.sockA = newSock(a.jar);
    await waitConnect(state.sockA);
    assert(state.sockA.connected === true, `reconnect A: connected phải true`);
    assert(state.sockA.id !== oldSid, `reconnect A: socket.id mới phải khác old (${oldSid})`);
  });

  await step('reconnect A — state:update vẫn deliver (userId map intact)', async () => {
    const recv = waitEvent(state.sockA, 'state:update', WS_TIMEOUT_MS);
    const r = await http(state.userA.jar, '/api/character/cultivate', {
      method: 'POST',
      body: { cultivating: false },
    });
    assertStatus(r, 200, 'character/cultivate(false)');
    const frame = await recv;
    const payload = assertFrame(frame, 'state:update');
    assert(
      payload.id === state.userA.characterId,
      `state:update sau reconnect: id = ${payload.id} ≠ ${state.userA.characterId}`,
    );
    assert(
      payload.cultivating === false,
      `state:update sau reconnect: cultivating phải false, got ${payload.cultivating}`,
    );
  });

  await step('reconnect A — chat:msg broadcast vẫn deliver, không duplicate', async () => {
    const cap = captureEvents(state.sockA, 'chat:msg');
    try {
      const text = `reconnect-${Date.now().toString(36)}`;
      const r = await http(state.userB.jar, '/api/chat/world', {
        method: 'POST',
        body: { text },
      });
      assertStatus(r, 200, 'chat/world from B');
      await sleep(600);
      assert(
        cap.frames.length === 1,
        `INVARIANT vi phạm: sau reconnect, 1 broadcast phải produce 1 frame, got ${cap.frames.length}`,
      );
      const payload = assertFrame(cap.frames[0], 'chat:msg');
      assert(payload.text === text, `chat:msg.text mismatch sau reconnect`);
      assert(
        payload.senderId === state.userB.characterId,
        `chat:msg.senderId = ${payload.senderId} ≠ characterId B = ${state.userB.characterId}`,
      );
    } finally {
      cap.stop();
    }
  });

  // 11. cultivate:tick (gated). BullMQ cron CULTIVATION_TICK_MS = 30000ms — chỉ
  //     verify khi user opt-in qua SMOKE_WAIT_TICK_MS > 0.
  await step('cultivate:tick (gated, BullMQ cron 30s)', async () => {
    if (WAIT_TICK_MS <= 0) {
      return {
        skip: true,
        note: 'SMOKE_WAIT_TICK_MS=0 (default). Set ≥ 35000 để verify cultivate:tick.',
      };
    }
    // Bật cultivating + chờ tick processor emit.
    const r = await http(state.userA.jar, '/api/character/cultivate', {
      method: 'POST',
      body: { cultivating: true },
    });
    assertStatus(r, 200, 'character/cultivate(true) trước wait-tick');
    const frame = await waitEvent(state.sockA, 'cultivate:tick', WAIT_TICK_MS);
    const payload = assertFrame(frame, 'cultivate:tick');
    assert(
      payload.characterId === state.userA.characterId,
      `cultivate:tick.characterId = ${payload.characterId} ≠ ${state.userA.characterId}`,
    );
    assert(
      typeof payload.expGained === 'string' && /^\d+$/.test(payload.expGained),
      `cultivate:tick.expGained phải numeric string, got ${JSON.stringify(payload.expGained)}`,
    );
    assert(typeof payload.realmKey === 'string', `cultivate:tick.realmKey phải string`);
    assert(typeof payload.realmStage === 'number', `cultivate:tick.realmStage phải number`);
    assert(typeof payload.brokeThrough === 'boolean', `cultivate:tick.brokeThrough phải boolean`);
    // Cleanup: tắt cultivating trước khi end smoke.
    await http(state.userA.jar, '/api/character/cultivate', {
      method: 'POST',
      body: { cultivating: false },
    });
  });

  // 12. Logout A → cookie clear → re-connect WS phải fail UNAUTHENTICATED.
  await step('logout A — POST /_auth/logout clears xt_access cookie', async () => {
    const r = await http(state.userA.jar, '/api/_auth/logout', { method: 'POST' });
    assertStatus(r, [200, 201], 'logout A');
    // Sau khi logout, cookie xt_access phải bị clear (Set-Cookie: xt_access=; …).
    assert(
      !state.userA.jar.get('xt_access'),
      `INVARIANT vi phạm: logout không clear cookie xt_access (jar còn ${state.userA.jar.get('xt_access')})`,
    );
  });

  await step('after logout — WS reconnect phải bị disconnect (UNAUTHENTICATED)', async () => {
    const sock = newSock(state.userA.jar);
    try {
      const status = await waitClosed(sock, 1500);
      assert(
        status.connected === false,
        `INVARIANT vi phạm: WS reconnect sau logout phải bị disconnect, nhưng vẫn connected (sock.connected=${sock.connected})`,
      );
    } finally {
      sock.removeAllListeners();
      sock.disconnect();
    }
  });

  // 13. Cleanup B + clean disconnect cả 2 socket.
  await step('logout B + clean disconnect both sockets', async () => {
    if (state.userB) {
      const r = await http(state.userB.jar, '/api/_auth/logout', { method: 'POST' });
      assertStatus(r, [200, 201], 'logout B');
    }
    state.sockA?.removeAllListeners();
    state.sockA?.disconnect();
    state.sockB?.removeAllListeners();
    state.sockB?.disconnect();
    await sleep(50);
  });
}

// -----------------------------------------------------------------------------
// Entrypoint.
// -----------------------------------------------------------------------------

const startedAt = Date.now();
main()
  .catch((err) => {
    console.error('[smoke:ws] FATAL:', err);
    results.push({ name: 'fatal', ok: false, note: String(err) });
  })
  .finally(() => {
    const elapsed = Date.now() - startedAt;
    const pass = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    console.log(
      `\n[smoke:ws] done: ${pass} pass / ${fail} fail / ${results.length} total in ${elapsed}ms`,
    );
    if (fail > 0) {
      console.error('[smoke:ws] failed steps:');
      for (const r of results.filter((x) => !x.ok)) {
        console.error(`  - ${r.name}: ${r.note}`);
      }
      process.exit(1);
    }
    process.exit(0);
  });
