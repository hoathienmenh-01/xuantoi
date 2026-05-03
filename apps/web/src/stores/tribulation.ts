import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/tribulation';

/**
 * Phase 11.6.D — server-authoritative Tribulation (Thiên Kiếp) store.
 *
 * State:
 *   - `lastOutcome`: outcome của lần attempt gần nhất (success/fail) hoặc
 *     `null` nếu chưa attempt phiên này. Dùng cho UI hiển thị banner
 *     "Vượt kiếp thành công" / "Thất bại — mất X EXP, cooldown đến Y" sau
 *     khi attempt.
 *   - `inFlight`: boolean — `true` khi đang chờ server respond. Disable
 *     button + chống double-click.
 *   - `lastError`: error code string (nếu attempt fail vì server reject —
 *     khác với fail vượt kiếp simulation). Caller dùng key i18n
 *     `tribulation.errors.{code}`.
 *
 * Action `attempt()`:
 *   - Server-authoritative — không optimistic. Trả về `null` (success
 *     attempt — caller xem `lastOutcome.success` để biết kiếp thành công
 *     hay thất bại) hoặc error code (string) nếu server từ chối attempt
 *     (NOT_AT_PEAK / COOLDOWN_ACTIVE / etc.).
 *   - `inFlight` set/clear quanh request để UI disable button.
 *
 * Note: Hai khái niệm fail khác nhau:
 *   1. `s.attempt()` return `'COOLDOWN_ACTIVE'`: server reject attempt, không
 *      ghi log, `lastOutcome` không đổi. Caller hiển thị toast lỗi.
 *   2. `s.attempt()` return `null` + `lastOutcome.success === false`:
 *      attempt được server accept, simulate ra fail, log đã ghi, EXP đã trừ,
 *      cooldown active. Caller hiển thị banner penalty.
 */
export const useTribulationStore = defineStore('tribulation', () => {
  const lastOutcome = ref<api.TribulationOutcomeView | null>(null);
  const inFlight = ref(false);
  const lastError = ref<string | null>(null);

  /**
   * Phase 11.6.G — history of past attempts. `null` = chưa fetch (initial),
   * `[]` = fetched but empty (chưa attempt lần nào). `historyLoading`/
   * `historyError` cho UI loading + retry banner.
   */
  const history = ref<api.TribulationAttemptLogView[] | null>(null);
  const historyLoading = ref(false);
  const historyError = ref<string | null>(null);

  /**
   * Phase 11.6.H — current pagination limit (server `?limit=N`). Mirror
   * `TRIBULATION_LOG_DEFAULT_LIMIT` (20) initially. `loadMoreHistory()`
   * tăng dần (+DEFAULT) cho tới khi đạt `TRIBULATION_LOG_MAX_LIMIT` (100).
   * Server responds DESC by `createdAt` → mỗi lần fetch lại với limit lớn
   * hơn sẽ trả về cả rows cũ + thêm rows cũ hơn nữa (replace, không append
   * client-side; cần re-fetch để consistent với server snapshot).
   */
  const historyLimit = ref<number>(api.TRIBULATION_LOG_DEFAULT_LIMIT);

  /**
   * Phase 11.6.H — true khi có khả năng còn rows cũ hơn để load thêm.
   * Heuristic: rows hiện tại đã đầy `historyLimit` (server trả đủ) AND
   * `historyLimit` chưa chạm MAX. Nếu rows < limit → server đã trả hết
   * (no more rows). Nếu limit === MAX → đã đạt giới hạn server cap.
   */
  const historyHasMore = computed<boolean>(() => {
    const rows = history.value;
    if (!rows) return false;
    if (rows.length < historyLimit.value) return false;
    return historyLimit.value < api.TRIBULATION_LOG_MAX_LIMIT;
  });

  /**
   * Phase 11.6.H — true khi đã đạt MAX limit và rows lấp đầy — không thể
   * load thêm dù còn rows cũ hơn ở server. UI hiển thị hint "Đã đạt giới
   * hạn 100 lượt" thay vì button.
   */
  const historyMaxReached = computed<boolean>(() => {
    const rows = history.value;
    if (!rows) return false;
    if (historyLimit.value < api.TRIBULATION_LOG_MAX_LIMIT) return false;
    return rows.length >= api.TRIBULATION_LOG_MAX_LIMIT;
  });

  function clearLastOutcome(): void {
    lastOutcome.value = null;
  }

  /**
   * Server-authoritative attempt. Returns error code (string) on failure,
   * `null` on success (caller phải xem `lastOutcome.success` để biết kiếp
   * thành công hay thất bại).
   */
  async function attempt(): Promise<string | null> {
    if (inFlight.value) return 'IN_FLIGHT';
    inFlight.value = true;
    lastError.value = null;
    try {
      const outcome = await api.attemptTribulation();
      lastOutcome.value = outcome;
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      lastError.value = code;
      return code;
    } finally {
      inFlight.value = false;
    }
  }

  /**
   * Phase 11.6.G — fetch history from `GET /character/tribulation/log`.
   * Idempotent. Race-protected via `historyLoading` (chống double-fetch khi
   * mount nhanh nhiều lần). Trả về error code string hoặc `null` thành công.
   *
   * Phase 11.6.H — `limit?` arg semantics:
   *   - Provided: clamp về [1, MAX] → store thành `historyLimit` (cho phép
   *     post-attempt refetch dùng cùng size đã expand) → call API với clamp.
   *   - Omitted: dùng `historyLimit.value` hiện tại (preserve user expand).
   */
  async function fetchHistory(limit?: number): Promise<string | null> {
    if (historyLoading.value) return 'IN_FLIGHT';
    historyLoading.value = true;
    historyError.value = null;
    if (limit !== undefined) {
      historyLimit.value = clampLimit(limit);
    }
    try {
      const res = await api.fetchAttemptLog(historyLimit.value);
      history.value = res.rows;
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      historyError.value = code;
      return code;
    } finally {
      historyLoading.value = false;
    }
  }

  /**
   * Phase 11.6.H — load more history rows bằng cách tăng `historyLimit`
   * thêm `TRIBULATION_LOG_DEFAULT_LIMIT` (20) rồi re-fetch. Trả về:
   *   - `'IN_FLIGHT'`: đang fetch, caller phải đợi.
   *   - `'MAX_REACHED'`: đã đạt MAX limit, không thể load thêm.
   *   - `null`: success, `history` đã được replace với rows mới (nhiều hơn).
   *   - `<error_code>`: fetch fail, caller xử lý (e.g. show toast).
   *
   * Race-safe — gọi nhiều lần liên tiếp vẫn chỉ 1 fetch chạy nhờ
   * `historyLoading` guard.
   */
  async function loadMoreHistory(): Promise<string | null> {
    if (historyLoading.value) return 'IN_FLIGHT';
    if (historyLimit.value >= api.TRIBULATION_LOG_MAX_LIMIT) {
      return 'MAX_REACHED';
    }
    const newLimit = clampLimit(
      historyLimit.value + api.TRIBULATION_LOG_DEFAULT_LIMIT,
    );
    return fetchHistory(newLimit);
  }

  function reset(): void {
    lastOutcome.value = null;
    inFlight.value = false;
    lastError.value = null;
    history.value = null;
    historyLoading.value = false;
    historyError.value = null;
    historyLimit.value = api.TRIBULATION_LOG_DEFAULT_LIMIT;
  }

  return {
    lastOutcome,
    inFlight,
    lastError,
    history,
    historyLoading,
    historyError,
    historyLimit,
    historyHasMore,
    historyMaxReached,
    clearLastOutcome,
    attempt,
    fetchHistory,
    loadMoreHistory,
    reset,
  };
});

/**
 * Phase 11.6.H — clamp limit về [1, MAX] (mirror server-side clamp trong
 * `TribulationService.listAttemptLogs`). Tránh gửi `?limit=999999` qua API.
 */
function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return api.TRIBULATION_LOG_DEFAULT_LIMIT;
  return Math.max(
    1,
    Math.min(api.TRIBULATION_LOG_MAX_LIMIT, Math.floor(limit)),
  );
}
