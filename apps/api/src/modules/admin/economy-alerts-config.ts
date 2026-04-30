/**
 * Config cho `GET /admin/economy/alerts?staleHours=N` endpoint.
 *
 * Trước đây default/min/max hard-code trong controller (`24`, `1`,
 * `24 * 30 = 720`). File này tách thành pure helper để:
 *   - Unit test không cần Nest context.
 *   - Ops override được qua env:
 *       ECONOMY_ALERTS_DEFAULT_STALE_HOURS=48
 *       ECONOMY_ALERTS_MAX_STALE_HOURS=2160    # 90 days
 *       ECONOMY_ALERTS_MIN_STALE_HOURS=1       # hiếm khi đổi
 *   - Dễ đọc ý đồ "why 24/720" trong doc comment.
 *
 * Default policy: alert cho topup pending 24h+ (1 day) — hợp lý cho closed
 * beta manual approve. Max 720h (30 day) đủ cho audit dài; set cao hơn
 * chỉ khi thực sự cần.
 */

export type EconomyAlertsBounds = {
  defaultHours: number;
  minHours: number;
  maxHours: number;
};

export const DEFAULT_ECONOMY_ALERTS_BOUNDS: EconomyAlertsBounds = Object.freeze({
  defaultHours: 24,
  minHours: 1,
  maxHours: 24 * 30, // 720
});

/**
 * Parse một env value (string | undefined) sang positive integer hour.
 * `fallback` dùng khi env missing / empty / NaN / <= 0.
 *
 * Pure, no I/O, exported cho test.
 */
export function parseEnvHours(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Đọc `EconomyAlertsBounds` từ một env-like provider (Nest
 * `ConfigService` hoặc `process.env`). Tất cả fallback sang
 * `DEFAULT_ECONOMY_ALERTS_BOUNDS`.
 *
 * Invariant: `minHours >= 1`, `defaultHours >= minHours`,
 * `maxHours >= defaultHours`. Nếu env vi phạm (vd max < default),
 * clamp để giữ invariant thay vì throw — ops set sai không nên brick
 * endpoint. Clamp log qua `onInvalid` (optional) để ops thấy.
 */
export type EnvGetter = (key: string) => string | undefined;

export function resolveEconomyAlertsBounds(
  getEnv: EnvGetter,
  onInvalid?: (msg: string) => void,
): EconomyAlertsBounds {
  const base = DEFAULT_ECONOMY_ALERTS_BOUNDS;
  const defaultHours = parseEnvHours(
    getEnv('ECONOMY_ALERTS_DEFAULT_STALE_HOURS'),
    base.defaultHours,
  );
  const minHoursRaw = parseEnvHours(
    getEnv('ECONOMY_ALERTS_MIN_STALE_HOURS'),
    base.minHours,
  );
  const maxHoursRaw = parseEnvHours(
    getEnv('ECONOMY_ALERTS_MAX_STALE_HOURS'),
    base.maxHours,
  );

  const minHours = Math.max(1, minHoursRaw);

  let maxHours = maxHoursRaw;
  if (maxHours < minHours) {
    onInvalid?.(
      `ECONOMY_ALERTS_MAX_STALE_HOURS (${maxHours}) < MIN (${minHours}); clamp to MIN.`,
    );
    maxHours = minHours;
  }

  let resolvedDefault = defaultHours;
  if (resolvedDefault < minHours) {
    onInvalid?.(
      `ECONOMY_ALERTS_DEFAULT_STALE_HOURS (${resolvedDefault}) < MIN (${minHours}); clamp to MIN.`,
    );
    resolvedDefault = minHours;
  } else if (resolvedDefault > maxHours) {
    onInvalid?.(
      `ECONOMY_ALERTS_DEFAULT_STALE_HOURS (${resolvedDefault}) > MAX (${maxHours}); clamp to MAX.`,
    );
    resolvedDefault = maxHours;
  }

  return {
    defaultHours: resolvedDefault,
    minHours,
    maxHours,
  };
}

/**
 * Normalize query `?staleHours=` param sang integer trong bounds.
 * - Empty / missing / NaN → `bounds.defaultHours`.
 * - `< minHours` → clamp lên `minHours`.
 * - `> maxHours` → clamp xuống `maxHours`.
 *
 * Pure function, exported cho test.
 */
export function clampStaleHours(
  raw: string | undefined,
  bounds: EconomyAlertsBounds,
): number {
  if (raw == null || raw === '') return bounds.defaultHours;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return bounds.defaultHours;
  return Math.max(bounds.minHours, Math.min(bounds.maxHours, parsed));
}
