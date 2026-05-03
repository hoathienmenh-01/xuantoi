import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.6.D — Tribulation (Thiên Kiếp) UI API client.
 *
 * Wire `POST /character/tribulation` (Phase 11.6.B server endpoint) cho
 * Pinia `useTribulationStore` + `TribulationView.vue`.
 *
 * Server-authoritative:
 *   - Body rỗng — server resolve `c.realmKey → nextRealm(c.realmKey)` từ
 *     character state (avoid client spoof `toRealmKey`).
 *   - Server validate peak gate (stage 9 + đủ EXP cost) + cooldown +
 *     `getTribulationForBreakthrough(c.realmKey, next.key)` def.
 *   - Server simulate kiếp deterministic + ghi `TribulationAttemptLog`.
 *
 * `TribulationAttemptOutcome` cấu trúc: `success` boolean + reward (linhThach
 * + expBonus + titleKey nếu success) | penalty (expLoss + cooldownAt +
 * taoMaActive + taoMaExpiresAt nếu fail).
 *
 * BigInt fields (`expBonus`/`expBefore`/`expAfter`/`expLoss`) auto-stringify
 * qua Prisma JSON serializer → expose `string` ở frontend type.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

/** Reward branch của outcome — chỉ populated khi `success=true`. */
export interface TribulationRewardView {
  /** Linh thạch reward (server cấp qua CurrencyLedger TRIBULATION_REWARD). */
  linhThach: number;
  /** EXP bonus thêm trên EXP cảnh giới mới (server cộng vào `c.exp`). */
  expBonus: string;
  /** Title key (e.g. `do_kiep_thanh_cong`). Optional. */
  titleKey: string | null;
}

/** Penalty branch của outcome — chỉ populated khi `success=false`. */
export interface TribulationPenaltyView {
  /** EXP trước khi fail. */
  expBefore: string;
  /** EXP sau khi fail (deducted). */
  expAfter: string;
  /** EXP rớt (`expBefore - expAfter`). */
  expLoss: string;
  /** Cooldown timestamp ISO (server tính `now + cooldownMinutes`). */
  cooldownAt: string;
  /** Có bị Tâm Ma debuff không (rolled với `taoMaDebuffChance`). */
  taoMaActive: boolean;
  /** Tâm Ma expires ISO. Null nếu `taoMaActive=false`. */
  taoMaExpiresAt: string | null;
}

/** Outcome trả về sau 1 attempt. Mirror `TribulationAttemptOutcome` server. */
export interface TribulationOutcomeView {
  success: boolean;
  tribulationKey: string;
  fromRealmKey: string;
  toRealmKey: string;
  /** 'minor' | 'major' | 'heavenly' | 'saint' */
  severity: string;
  /** 'lei' | 'hoa' | 'bang' | 'phong' | 'tam' */
  type: string;
  wavesCompleted: number;
  totalDamage: number;
  finalHp: number;
  attemptIndex: number;
  reward: TribulationRewardView | null;
  penalty: TribulationPenaltyView | null;
  /** Audit log id (`TribulationAttemptLog.id`). */
  logId: string;
}

/**
 * POST /character/tribulation — server-authoritative tribulation attempt.
 *
 * Throw object preserving `code` từ envelope (test fixture compat) hoặc
 * fallback Error nếu data vắng.
 */
export async function attemptTribulation(): Promise<TribulationOutcomeView> {
  const { data } = await apiClient.post<
    Envelope<{ tribulation: TribulationOutcomeView }>
  >('/character/tribulation', {});
  if (!data.ok || !data.data) throw data.error ?? fallbackError('tribulation');
  return data.data.tribulation;
}
