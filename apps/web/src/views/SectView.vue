<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { realmByKey, fullRealmName } from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  contributeSect,
  createSect,
  joinSect,
  leaveSect,
  listSects,
  mySect,
  type SectDetailView,
  type SectListView,
} from '@/api/sect';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();

const tab = ref<'mine' | 'all' | 'create'>('mine');
const submitting = ref(false);
const sects = ref<SectListView[]>([]);
const me = ref<SectDetailView | null>(null);

// Form tạo
const newName = ref('');
const newDesc = ref('');

// Form đóng góp
const contribAmount = ref('100');

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  await refreshAll();
});

async function refreshAll(): Promise<void> {
  try {
    const [s, m] = await Promise.all([listSects(), mySect()]);
    sects.value = s;
    me.value = m;
    if (!m) tab.value = 'all';
  } catch (e) {
    handleErr(e);
  }
}

async function onJoin(s: SectListView): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    me.value = await joinSect(s.id);
    toast.push({ type: 'success', text: `Đã gia nhập ${s.name}.` });
    tab.value = 'mine';
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onLeave(): Promise<void> {
  if (submitting.value || !me.value) return;
  if (!confirm(`Rời khỏi ${me.value.name}? Cống hiến vẫn giữ.`)) return;
  submitting.value = true;
  try {
    await leaveSect();
    toast.push({ type: 'system', text: 'Đã rời tông môn.' });
    me.value = null;
    tab.value = 'all';
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onCreate(): Promise<void> {
  if (submitting.value) return;
  if (!/^[\p{L}\p{N} _-]{2,16}$/u.test(newName.value)) {
    toast.push({ type: 'error', text: 'Tên 2–16 ký tự.' });
    return;
  }
  submitting.value = true;
  try {
    me.value = await createSect(newName.value, newDesc.value);
    toast.push({ type: 'success', text: 'Lập tông thành công.' });
    newName.value = '';
    newDesc.value = '';
    tab.value = 'mine';
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onContribute(): Promise<void> {
  if (submitting.value || !me.value) return;
  submitting.value = true;
  try {
    me.value = await contributeSect(contribAmount.value);
    toast.push({ type: 'success', text: 'Đã đóng góp.' });
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function realmText(key: string, stage: number): string {
  const r = realmByKey(key);
  if (!r) return key;
  return fullRealmName(r, stage);
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  const map: Record<string, string> = {
    NO_CHARACTER: 'Chưa có nhân vật.',
    SECT_NOT_FOUND: 'Tông môn không tồn tại.',
    NOT_IN_SECT: 'Bạn chưa thuộc tông môn nào.',
    ALREADY_IN_SECT: 'Bạn đã thuộc tông môn rồi, hãy rời trước.',
    INVALID_AMOUNT: 'Số linh thạch không hợp lệ (1 – 1.000.000 / lượt).',
    INVALID_NAME: 'Tên 2–16 ký tự (chữ/số/ _-).',
    INSUFFICIENT_LINH_THACH: 'Không đủ linh thạch.',
    NAME_TAKEN: 'Tên này đã có người dùng.',
    UNKNOWN: 'Có lỗi xảy ra, mời thử lại.',
  };
  toast.push({ type: 'error', text: map[code] ?? map.UNKNOWN });
}

const myStash = computed(() => game.character?.linhThach ?? '0');
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">Tông Môn</h2>

    <div class="flex gap-2 mb-4">
      <MButton
        :class="tab === 'mine' ? '!bg-ink-50 !text-ink-900' : ''"
        :disabled="!me"
        @click="tab = 'mine'"
      >
        Tông Của Tôi
      </MButton>
      <MButton
        :class="tab === 'all' ? '!bg-ink-50 !text-ink-900' : ''"
        @click="tab = 'all'"
      >
        Danh Sách
      </MButton>
      <MButton
        :class="tab === 'create' ? '!bg-ink-50 !text-ink-900' : ''"
        :disabled="!!me"
        @click="tab = 'create'"
      >
        Lập Tông
      </MButton>
      <span class="ml-auto text-xs text-ink-300 self-center">
        Linh thạch: ⛀ {{ myStash }}
      </span>
    </div>

    <!-- TÔNG CỦA TÔI -->
    <section v-if="tab === 'mine' && me" class="space-y-4">
      <div class="border border-ink-300/40 rounded p-4 bg-ink-700/30">
        <div class="flex items-start gap-3 flex-wrap">
          <div class="flex-1 min-w-0">
            <div class="text-lg text-ink-50">{{ me.name }}</div>
            <div class="text-xs text-ink-300">
              Cấp {{ me.level }} · {{ me.memberCount }} thành viên
              <span v-if="me.leaderName"> · Tông chủ: {{ me.leaderName }}</span>
            </div>
            <p v-if="me.description" class="text-sm text-ink-200 mt-2 whitespace-pre-line">
              {{ me.description }}
            </p>
          </div>
          <div class="text-xs text-right">
            <div class="text-ink-300">Tông Khố</div>
            <div class="text-amber-300 text-base">⛀ {{ me.treasuryLinhThach }}</div>
          </div>
        </div>
        <div class="mt-3 flex gap-2 items-end">
          <div class="flex-1">
            <label class="block text-xs text-ink-300 mb-1">
              Đóng góp linh thạch (tối đa 1.000.000 / lượt)
            </label>
            <input
              v-model="contribAmount"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="w-40 bg-ink-900/70 border border-ink-300/30 rounded px-2 py-1 text-sm"
            />
            <span class="text-xs text-ink-300 ml-2">→ +{{ contribAmount }} cống hiến</span>
          </div>
          <MButton :loading="submitting" @click="onContribute">Đóng Góp</MButton>
          <MButton
            class="!bg-red-900/40 !border-red-400/40"
            :loading="submitting"
            @click="onLeave"
          >
            Rời Tông
          </MButton>
        </div>
      </div>

      <div class="border border-ink-300/40 rounded">
        <div class="px-4 py-2 text-xs uppercase tracking-widest text-ink-300 border-b border-ink-300/30">
          Đệ Tử ({{ me.members.length }})
        </div>
        <table class="w-full text-sm">
          <thead class="text-xs text-ink-300/70">
            <tr>
              <th class="text-left px-3 py-1">Đạo Hiệu</th>
              <th class="text-left px-3 py-1">Cảnh Giới</th>
              <th class="text-right px-3 py-1">Cống Hiến</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in me.members"
              :key="m.id"
              :class="m.isMe ? 'bg-ink-700/30' : ''"
            >
              <td class="px-3 py-1">
                <span :class="m.isLeader ? 'text-amber-300 font-bold' : ''">
                  {{ m.name }}
                </span>
                <span v-if="m.isLeader" class="ml-1 text-xs text-amber-300/70">[Tông chủ]</span>
                <span v-if="m.isMe" class="ml-1 text-xs text-ink-300/70">(bạn)</span>
              </td>
              <td class="px-3 py-1 text-ink-300">{{ realmText(m.realmKey, m.realmStage) }}</td>
              <td class="px-3 py-1 text-right text-amber-300">{{ m.congHien }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- DANH SÁCH -->
    <section v-else-if="tab === 'all'">
      <div v-if="sects.length === 0" class="text-ink-300 text-sm">
        Chưa có tông môn nào — hãy lập tông đầu tiên.
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="s in sects"
          :key="s.id"
          class="border border-ink-300/40 rounded p-3 bg-ink-700/20"
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="text-base text-ink-50">{{ s.name }}</div>
              <div class="text-xs text-ink-300">
                Cấp {{ s.level }} · {{ s.memberCount }} đệ tử
                <span v-if="s.leaderName"> · Tông chủ: {{ s.leaderName }}</span>
              </div>
              <p v-if="s.description" class="text-xs text-ink-200/80 mt-1 line-clamp-2">
                {{ s.description }}
              </p>
            </div>
            <div class="text-right text-xs">
              <div class="text-ink-300">Tông Khố</div>
              <div class="text-amber-300">⛀ {{ s.treasuryLinhThach }}</div>
            </div>
          </div>
          <div class="mt-2 flex justify-end">
            <MButton
              :disabled="!!me || submitting"
              :title="me ? 'Bạn đã thuộc tông khác' : ''"
              @click="onJoin(s)"
            >
              Gia Nhập
            </MButton>
          </div>
        </div>
      </div>
    </section>

    <!-- LẬP TÔNG -->
    <section v-else-if="tab === 'create'">
      <div v-if="me" class="text-ink-300 text-sm">
        Bạn đang thuộc {{ me.name }} — hãy rời trước nếu muốn lập tông mới.
      </div>
      <form v-else class="max-w-lg space-y-3" @submit.prevent="onCreate">
        <div>
          <label class="block text-xs text-ink-300 mb-1">Tên Tông Môn (2–16 ký tự)</label>
          <input
            v-model="newName"
            type="text"
            maxlength="16"
            class="w-full bg-ink-900/70 border border-ink-300/30 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-ink-300 mb-1">Tông Chỉ (≤ 200 ký tự)</label>
          <textarea
            v-model="newDesc"
            maxlength="200"
            rows="3"
            class="w-full bg-ink-900/70 border border-ink-300/30 rounded px-2 py-1 text-sm"
          />
        </div>
        <MButton type="submit" :loading="submitting">Lập Tông</MButton>
      </form>
    </section>
  </AppShell>
</template>
