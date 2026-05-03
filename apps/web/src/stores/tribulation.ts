import { ref } from 'vue';
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

  function reset(): void {
    lastOutcome.value = null;
    inFlight.value = false;
    lastError.value = null;
  }

  return {
    lastOutcome,
    inFlight,
    lastError,
    clearLastOutcome,
    attempt,
    reset,
  };
});
