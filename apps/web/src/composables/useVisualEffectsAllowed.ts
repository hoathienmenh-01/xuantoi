/**
 * Phase 45.0 — Visual effects feature flag gate composable.
 *
 * Single source of truth cho FE để biết flag `VISUAL_EFFECTS_ENABLED` đang
 * ON hay OFF. Fail-open (mặc định ON) khi store chưa load — tránh ẩn UI
 * khi backend tạm trục trặc. Server vẫn gate cuối cùng cho mutation tốn
 * server-side.
 *
 * Consumer:
 *   - AppShell.vue truyền `visual-effect-level="OFF"` vào ambient layer
 *     khi flag off để giảm CPU/GPU ambient particle.
 *   - SettingsView.vue clamp `visualEffectLevel` về `OFF` khi flag off.
 *   - Bất kỳ component visual-effects/* nào cần short-circuit render.
 *
 * KHÔNG impact gameplay — chỉ ẩn / giảm decorative visual layer.
 */
import { computed, type ComputedRef } from 'vue';
import type { VisualEffectLevel } from '@xuantoi/shared';
import { useFeatureFlagsStore } from '@/stores/featureFlags';

export function useVisualEffectsAllowed(): ComputedRef<boolean> {
  const featureFlags = useFeatureFlagsStore();
  return computed(() => featureFlags.isEnabled('VISUAL_EFFECTS_ENABLED'));
}

/**
 * Clamp `level` về `OFF` nếu feature flag disabled. Trả về reactive
 * computed ref để v-bind tự update khi flag store refresh.
 */
export function useEffectiveVisualEffectLevel(
  level: ComputedRef<VisualEffectLevel> | (() => VisualEffectLevel),
): ComputedRef<VisualEffectLevel> {
  const allowed = useVisualEffectsAllowed();
  return computed<VisualEffectLevel>(() => {
    if (!allowed.value) return 'OFF';
    const v = typeof level === 'function' ? level() : level.value;
    return v;
  });
}
