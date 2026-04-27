<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  CHARACTER_ERROR_VI,
  CharacterName,
  type CharacterErrorCode,
  type PublicCharacter,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useCharacterStore } from '@/stores/character';
import { useLogsStore } from '@/stores/logs';
import { useToastStore } from '@/stores/toast';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const charStore = useCharacterStore();
const logsStore = useLogsStore();
const toast = useToastStore();
const router = useRouter();

const newName = ref('');
const creating = ref(false);
const acting = ref(false);

/** EXP hiển thị (đã có pendingExp từ server) — bonus thêm tiếng đếm cho UX. */
const localTickCounter = ref(0);

let pollTimer: number | null = null;
let displayTimer: number | null = null;

function describeError(e: unknown, fallback: string): string {
  const code = (e as { code?: string })?.code;
  if (code && code in CHARACTER_ERROR_VI) {
    return CHARACTER_ERROR_VI[code as CharacterErrorCode];
  }
  return fallback;
}

async function refreshAll(): Promise<void> {
  await Promise.all([charStore.loadMe(), logsStore.load()]);
}

async function onCreate(): Promise<void> {
  const parsed = CharacterName.safeParse(newName.value);
  if (!parsed.success) {
    toast.push({ type: 'warning', text: parsed.error.errors[0]?.message ?? 'Tên không hợp lệ.' });
    return;
  }
  creating.value = true;
  try {
    await charStore.create(parsed.data);
    await logsStore.load();
    toast.push({ type: 'success', text: 'Khai mở đạo đồ thành công.' });
    newName.value = '';
  } catch (e) {
    toast.push({ type: 'error', text: describeError(e, 'Khai mở đạo đồ thất bại.') });
  } finally {
    creating.value = false;
  }
}

async function onStart(): Promise<void> {
  acting.value = true;
  try {
    await charStore.start();
    await logsStore.load();
  } catch (e) {
    toast.push({ type: 'error', text: describeError(e, 'Bắt đầu tu luyện thất bại.') });
  } finally {
    acting.value = false;
  }
}

async function onStop(): Promise<void> {
  acting.value = true;
  try {
    await charStore.stop();
    await logsStore.load();
  } catch (e) {
    toast.push({ type: 'error', text: describeError(e, 'Dừng tu luyện thất bại.') });
  } finally {
    acting.value = false;
  }
}

async function onBreakthrough(): Promise<void> {
  acting.value = true;
  try {
    await charStore.breakthrough();
    await logsStore.load();
    toast.push({ type: 'success', text: 'Đột phá thành công!' });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'NOT_ENOUGH_EXP') {
      // refresh log để thấy entry "thất bại"
      await logsStore.load();
    }
    toast.push({ type: 'warning', text: describeError(e, 'Đột phá thất bại.') });
  } finally {
    acting.value = false;
  }
}

async function onLogout(): Promise<void> {
  await auth.logout();
  charStore.reset();
  logsStore.reset();
  router.push('/auth');
}

const character = computed<PublicCharacter | null>(() => charStore.character);

/**
 * Hiển thị EXP hiện tại = (exp lưu DB) + (pendingExp tính ngay tại server lúc /me),
 * cộng thêm số giây đã trôi từ thời điểm fetch để mượt UI giữa 2 lần poll.
 * Chỉ là display, KHÔNG gửi lên server.
 */
const displayExp = computed<bigint>(() => {
  const c = character.value;
  if (!c) return 0n;
  const baseExp = BigInt(c.exp);
  if (!c.cultivating) return baseExp;
  const tick = localTickCounter.value;
  const extra = BigInt(Math.floor(tick * c.expPerSec));
  return baseExp + extra;
});

const expCost = computed<bigint>(() => {
  const c = character.value;
  if (!c) return 0n;
  return BigInt(c.expToBreakthrough);
});

const progress = computed<number>(() => {
  const cost = expCost.value;
  if (cost <= 0n) return 1;
  const ratio = Number(displayExp.value) / Number(cost);
  return Math.max(0, Math.min(1, ratio));
});

const canBreakthrough = computed<boolean>(() => {
  if (!character.value) return false;
  if (expCost.value === 0n) return false;
  return displayExp.value >= expCost.value;
});

function startPolling(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    if (charStore.isCultivating) {
      void charStore.loadMe();
    }
  }, 5000);
  displayTimer = window.setInterval(() => {
    if (charStore.isCultivating) {
      localTickCounter.value += 1;
    } else {
      localTickCounter.value = 0;
    }
  }, 1000);
}

function stopPolling(): void {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (displayTimer) {
    window.clearInterval(displayTimer);
    displayTimer = null;
  }
}

watch(
  () => character.value?.cultivating,
  () => {
    localTickCounter.value = 0;
  },
);

onMounted(async () => {
  await refreshAll();
  startPolling();
});

onBeforeUnmount(() => stopPolling());
</script>

<template>
  <div class="min-h-screen p-6 max-w-4xl mx-auto">
    <header class="border-b border-ink-300/40 pb-3 mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl tracking-widest">Xuân Tôi · Đạo Môn</h1>
        <p class="text-xs text-ink-300 mt-1">{{ auth.user?.email }}</p>
      </div>
      <button class="text-sm text-ink-300 hover:text-ink-50" @click="onLogout">Xuất Quan</button>
    </header>

    <!-- Loading lần đầu -->
    <div v-if="!charStore.loaded && charStore.loading" class="text-ink-300">
      Đang triệu hồi đạo đồ...
    </div>

    <!-- Form khai mở đạo đồ -->
    <section
      v-else-if="!character"
      class="border border-ink-300/40 rounded p-6 bg-ink-700/30 backdrop-blur"
    >
      <h2 class="text-xl tracking-widest mb-2">Khai Mở Đạo Đồ</h2>
      <p class="text-sm text-ink-300 mb-4">
        Đạo hữu chưa có thân phận. Hãy đặt tên cho đạo đồ của mình (3–20 ký tự).
      </p>
      <form class="space-y-3" @submit.prevent="onCreate">
        <input
          v-model="newName"
          type="text"
          maxlength="20"
          minlength="3"
          required
          placeholder="Ví dụ: Lý Thanh Vân"
          class="w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
        />
        <MButton type="submit" :loading="creating" class="w-full">Khai Mở Đạo Đồ</MButton>
      </form>
    </section>

    <!-- Dashboard nhân vật -->
    <section v-else class="space-y-6">
      <div class="border border-ink-300/40 rounded p-5 bg-ink-700/30 backdrop-blur">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-2xl tracking-widest">{{ character.name }}</h2>
          <div class="text-sm text-ink-300">
            <span v-if="character.cultivating" class="text-emerald-300">● Đang tu luyện</span>
            <span v-else class="text-ink-300">○ Đang nghỉ</span>
          </div>
        </div>
        <div class="text-ink-300 text-sm mt-1">{{ character.stageName }}</div>

        <div class="mt-4">
          <div class="flex justify-between text-xs text-ink-300">
            <span>Tu vi (EXP)</span>
            <span>
              {{ displayExp.toString() }} /
              {{ expCost === 0n ? '∞' : expCost.toString() }}
            </span>
          </div>
          <div class="h-2 mt-1 rounded bg-ink-900/60 overflow-hidden">
            <div
              class="h-full bg-ink-300 transition-all"
              :style="{ width: progress * 100 + '%' }"
            />
          </div>
          <div v-if="character.cultivating" class="text-xs text-ink-300/80 mt-1">
            Tốc độ: ~{{ character.expPerSec.toFixed(2) }} EXP/giây
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Sinh Lực</div>
            <div>{{ character.hp }} / {{ character.hpMax }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Linh Lực</div>
            <div>{{ character.mp }} / {{ character.mpMax }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Thể Lực</div>
            <div>{{ character.stamina }} / {{ character.staminaMax }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Lực Chiến</div>
            <div>{{ character.power }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Linh Thạch</div>
            <div>{{ character.linhThach }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Tiên Ngọc</div>
            <div>{{ character.tienNgoc }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Thần Thức</div>
            <div>{{ character.spirit }}</div>
          </div>
          <div class="border border-ink-300/30 rounded px-3 py-2">
            <div class="text-ink-300/80 text-xs">Thân Pháp</div>
            <div>{{ character.speed }}</div>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <MButton
            v-if="!character.cultivating"
            :loading="acting"
            @click="onStart"
          >Bắt Đầu Tu Luyện</MButton>
          <MButton
            v-else
            :loading="acting"
            @click="onStop"
          >Dừng Tu Luyện</MButton>
          <MButton
            :loading="acting"
            :disabled="!canBreakthrough"
            @click="onBreakthrough"
          >Đột Phá</MButton>
        </div>
      </div>

      <div class="border border-ink-300/40 rounded p-5 bg-ink-700/30 backdrop-blur">
        <h3 class="text-lg tracking-widest mb-3">Tâm Lộ Nhật Ký</h3>
        <ul v-if="logsStore.logs.length" class="space-y-1 max-h-96 overflow-y-auto pr-2">
          <li
            v-for="log in logsStore.logs"
            :key="log.id"
            class="text-sm flex gap-2"
          >
            <span class="text-ink-300/70 shrink-0 tabular-nums">
              {{ new Date(log.createdAt).toLocaleTimeString('vi-VN') }}
            </span>
            <span
              :class="{
                'text-emerald-300': log.type === 'success',
                'text-yellow-300': log.type === 'warning',
                'text-red-300': log.type === 'error',
                'text-ink-100': log.type === 'info' || log.type === 'system',
              }"
            >{{ log.text }}</span>
          </li>
        </ul>
        <div v-else class="text-ink-300 text-sm">Chưa có nhật ký.</div>
      </div>
    </section>
  </div>
</template>
