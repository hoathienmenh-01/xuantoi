/**
 * WebSocket frame protocol — file 04 §5.
 *   { type, payload, ts }
 */
export interface WsFrame<T = unknown> {
  type: WsEventType;
  payload: T;
  ts: number;
}

export type WsEventType =
  // server → client
  | 'state:update'
  | 'logs:append'
  | 'marquee'
  | 'chat:msg'
  | 'boss:spawn'
  | 'boss:update'
  | 'boss:end'
  | 'mail:new'
  | 'pong'
  // client → server
  | 'ping'
  | 'cultivate:tick'
  | 'chat:send';

export const WS_HEARTBEAT_INTERVAL_MS = 25_000;
export const WS_HEARTBEAT_TIMEOUT_MS = 8_000;
export const WS_RECONNECT_MAX_DELAY_MS = 30_000;
export const WS_RECONNECT_MAX_ATTEMPTS = 10;
