import { io, type Socket } from 'socket.io-client';
import type {
  CharacterStatePayload,
  CultivateTickPayload,
  WsFrame,
  WsEventType,
} from '@xuantoi/shared';

let socket: Socket | null = null;

type Handler<T = unknown> = (frame: WsFrame<T>) => void;
const handlers = new Map<WsEventType, Set<Handler>>();

export function on<T>(type: WsEventType, fn: Handler<T>): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(fn as Handler);
  return () => set?.delete(fn as Handler);
}

function dispatch<T>(type: WsEventType, frame: WsFrame<T>): void {
  const set = handlers.get(type);
  if (!set) return;
  for (const fn of set) fn(frame as WsFrame);
}

export function connect(): Socket {
  if (socket) return socket;
  const url =
    (import.meta.env.VITE_WS_URL as string | undefined) ?? window.location.origin;
  socket = io(url, {
    path: '/ws',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelayMax: 30_000,
  });

  // Đăng ký listener cho mỗi loại event ở phía client.
  const events: WsEventType[] = [
    'state:update',
    'cultivate:tick',
    'logs:append',
    'marquee',
    'chat:msg',
    'boss:spawn',
    'boss:update',
    'boss:end',
    'mail:new',
    'pong',
  ];
  for (const ev of events) {
    socket.on(ev, (frame: WsFrame) => dispatch(ev, frame));
  }

  return socket;
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

export function emit<T>(type: WsEventType, payload: T): void {
  socket?.emit(type, payload);
}

export type StateFrame = WsFrame<CharacterStatePayload>;
export type TickFrame = WsFrame<CultivateTickPayload>;
