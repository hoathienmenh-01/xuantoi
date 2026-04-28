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
  | 'cultivate:tick'
  | 'logs:append'
  | 'marquee'
  | 'chat:msg'
  | 'boss:spawn'
  | 'boss:update'
  | 'boss:end'
  | 'boss:defeated'
  | 'mail:new'
  | 'mission:progress'
  | 'pong'
  // client → server
  | 'ping'
  | 'chat:send';

export interface CharacterStatePayload {
  id: string;
  name: string;
  realmKey: string;
  realmStage: number;
  level: number;
  exp: string;
  expNext: string;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  stamina: number;
  staminaMax: number;
  power: number;
  spirit: number;
  speed: number;
  luck: number;
  linhThach: string;
  tienNgoc: number;
  cultivating: boolean;
  sectId: string | null;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la' | null;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  banned: boolean;
}

export interface CultivateTickPayload {
  characterId: string;
  expGained: string;
  exp: string;
  expNext: string;
  realmKey: string;
  realmStage: number;
  brokeThrough: boolean;
}

export const WS_HEARTBEAT_INTERVAL_MS = 25_000;
export const WS_HEARTBEAT_TIMEOUT_MS = 8_000;
export const WS_RECONNECT_MAX_DELAY_MS = 30_000;
export const WS_RECONNECT_MAX_ATTEMPTS = 10;

export const CULTIVATION_TICK_MS = 30_000;
export const CULTIVATION_TICK_BASE_EXP = 5;

/**
 * Push throttle khi emit `mission:progress`. Mỗi user nhận tối đa 1 frame
 * trong cửa sổ này — frame thừa bị drop để tránh spam khi nhiều mission
 * được increment liên tiếp (vd cultivation tick + boss attack hit cùng giây).
 */
export const MISSION_PROGRESS_PUSH_THROTTLE_MS = 500;

/**
 * Payload của event `mission:progress`. Mỗi frame là một snapshot delta
 * những mission vừa được track (currentAmount tăng) cho 1 character.
 * FE merge vào store để cập nhật UI mà không cần refetch full list.
 */
export interface MissionProgressFramePayload {
  characterId: string;
  changes: MissionProgressChange[];
}

export interface MissionProgressChange {
  missionKey: string;
  /** 'DAILY' | 'WEEKLY' | 'ONCE' (giữ string để shared không phụ thuộc Prisma). */
  period: string;
  currentAmount: number;
  goalAmount: number;
  /** `currentAmount >= goalAmount && !claimed`. */
  completable: boolean;
}
