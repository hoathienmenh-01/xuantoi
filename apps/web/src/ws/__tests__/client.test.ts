/**
 * Unit test `apps/web/src/ws/client.ts` pure helpers — `resolveWsOrigin`.
 *
 * Lý do:
 *  - `resolveWsOrigin` là edge case dễ breaking nếu refactor:
 *      - `VITE_WS_URL` rỗng/undefined → fallback (same-origin cho Vite dev).
 *      - URL có path (`https://api.example.com/ws`) → PHẢI strip path,
 *        trả origin (`https://api.example.com`) để socket.io không hiểu
 *        path là namespace.
 *      - URL có port custom → giữ nguyên port (`wss://example.com:8443`).
 *      - URL không hợp lệ (vd `not-a-url`) → fallback.
 *  - `connect()` / `on()` / `dispatch()` phụ thuộc socket.io-client global
 *    state và `import.meta.env` — để test khác (integration/component),
 *    ở đây chỉ cover logic pure vì giá trị coverage vs risk setup cao.
 */
import { describe, expect, it } from 'vitest';
import { resolveWsOrigin } from '../client';

describe('resolveWsOrigin', () => {
  it('fallback khi raw là undefined', () => {
    expect(resolveWsOrigin(undefined, 'https://fallback.example')).toBe(
      'https://fallback.example',
    );
  });

  it('fallback khi raw là rỗng', () => {
    expect(resolveWsOrigin('', 'https://fallback.example')).toBe(
      'https://fallback.example',
    );
  });

  it('fallback khi raw là whitespace thuần', () => {
    expect(resolveWsOrigin('   \t\n  ', 'https://fallback.example')).toBe(
      'https://fallback.example',
    );
  });

  it('giữ origin khi URL không có path (https://host)', () => {
    expect(resolveWsOrigin('https://api.example.com', 'https://fb')).toBe(
      'https://api.example.com',
    );
  });

  it('giữ origin khi URL không có path (wss://host)', () => {
    expect(resolveWsOrigin('wss://api.example.com', 'https://fb')).toBe(
      'wss://api.example.com',
    );
  });

  it('STRIP path khi URL có path — critical để socket.io không hiểu path là namespace', () => {
    // Đây là bug cũ: VITE_WS_URL="https://api.example.com/ws" khiến
    // socket.io-client hiểu "/ws" là namespace thay vì path, gateway
    // server `/ws` không có namespace "/ws" → handshake fail.
    expect(resolveWsOrigin('https://api.example.com/ws', 'https://fb')).toBe(
      'https://api.example.com',
    );
  });

  it('STRIP path nested', () => {
    expect(resolveWsOrigin('https://api.example.com/a/b/c', 'https://fb')).toBe(
      'https://api.example.com',
    );
  });

  it('STRIP query string và fragment', () => {
    expect(
      resolveWsOrigin('https://api.example.com/ws?foo=bar#frag', 'https://fb'),
    ).toBe('https://api.example.com');
  });

  it('giữ port custom', () => {
    expect(resolveWsOrigin('https://api.example.com:8443/ws', 'https://fb')).toBe(
      'https://api.example.com:8443',
    );
  });

  it('giữ wss:// scheme với port', () => {
    expect(resolveWsOrigin('wss://ws.example.com:9001', 'https://fb')).toBe(
      'wss://ws.example.com:9001',
    );
  });

  it('fallback khi raw không parse được thành URL', () => {
    expect(resolveWsOrigin('not-a-url', 'https://fallback.example')).toBe(
      'https://fallback.example',
    );
  });

  it('fallback khi raw chỉ là host thô (không có scheme)', () => {
    // `new URL('api.example.com')` sẽ throw — phải fallback.
    expect(resolveWsOrigin('api.example.com', 'https://fallback.example')).toBe(
      'https://fallback.example',
    );
  });

  it('fallback khi raw có scheme lạ nhưng URL constructor parse được — vẫn trả origin', () => {
    // `new URL('custom://host/path')` HỢP LỆ theo spec, trả 'custom://host'.
    // Test lock-in hành vi: chúng ta KHÔNG filter scheme (để trường hợp
    // production dùng scheme custom, vd reverse proxy override, vẫn đi đúng).
    expect(resolveWsOrigin('custom://host.example/ws', 'https://fb')).toBe(
      'custom://host.example',
    );
  });

  it('trim whitespace xung quanh URL hợp lệ', () => {
    expect(
      resolveWsOrigin('  https://api.example.com/ws  ', 'https://fb'),
    ).toBe('https://api.example.com');
  });

  it('fallback là same-origin hợp lệ — trả về nguyên vẹn (thường là window.location.origin)', () => {
    expect(resolveWsOrigin(undefined, 'http://localhost:5173')).toBe(
      'http://localhost:5173',
    );
  });
});
