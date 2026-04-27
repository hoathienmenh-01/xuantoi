<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  adminApproveTopup,
  adminBanUser,
  adminGrant,
  adminListAudit,
  adminListTopups,
  adminListUsers,
  adminRejectTopup,
  adminSetRole,
  type AdminAuditRow,
  type AdminUserRow,
  type Role,
} from '@/api/admin';
import type { TopupOrderView } from '@/api/topup';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();

type Tab = 'users' | 'topups' | 'audit';
const tab = ref<Tab>('users');

// Users tab
const userQuery = ref('');
const userPage = ref(0);
const users = ref<AdminUserRow[]>([]);
const userTotal = ref(0);
const grantOpen = ref<string | null>(null);
const grantLinhThach = ref('0');
const grantTienNgoc = ref(0);
const grantReason = ref('');

// Topups tab
const topupStatus = ref<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
const topupPage = ref(0);
const topups = ref<(TopupOrderView & { userEmail: string })[]>([]);
const topupTotal = ref(0);
const topupNote = ref('');

// Audit tab
const auditPage = ref(0);
const audits = ref<AdminAuditRow[]>([]);
const auditTotal = ref(0);

const loading = ref(false);

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  const role = game.character?.role;
  if (role !== 'ADMIN' && role !== 'MOD') {
    toast.push({ type: 'error', text: 'Bạn không có quyền vào khu này.' });
    router.replace('/home');
    return;
  }
  await refreshUsers();
});

watch(tab, async (t) => {
  if (t === 'users') await refreshUsers();
  else if (t === 'topups') await refreshTopups();
  else if (t === 'audit') await refreshAudit();
});

async function refreshUsers(): Promise<void> {
  loading.value = true;
  try {
    const r = await adminListUsers(userQuery.value, userPage.value);
    users.value = r.rows;
    userTotal.value = r.total;
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

async function refreshTopups(): Promise<void> {
  loading.value = true;
  try {
    const r = await adminListTopups(topupStatus.value, topupPage.value);
    topups.value = r.rows;
    topupTotal.value = r.total;
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

async function refreshAudit(): Promise<void> {
  loading.value = true;
  try {
    const r = await adminListAudit(auditPage.value);
    audits.value = r.rows;
    auditTotal.value = r.total;
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

async function toggleBan(u: AdminUserRow): Promise<void> {
  if (!confirm(`${u.banned ? 'Mở khoá' : 'Khoá'} tài khoản ${u.email}?`)) return;
  try {
    await adminBanUser(u.id, !u.banned);
    toast.push({ type: 'success', text: 'Đã cập nhật.' });
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

async function changeRole(u: AdminUserRow, role: Role): Promise<void> {
  if (u.role === role) return;
  if (!confirm(`Đổi role ${u.email} → ${role}?`)) return;
  try {
    await adminSetRole(u.id, role);
    toast.push({ type: 'success', text: 'Đã đổi role.' });
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

function openGrant(u: AdminUserRow): void {
  grantOpen.value = u.id;
  grantLinhThach.value = '0';
  grantTienNgoc.value = 0;
  grantReason.value = '';
}

async function submitGrant(): Promise<void> {
  if (!grantOpen.value) return;
  try {
    await adminGrant(grantOpen.value, grantLinhThach.value, grantTienNgoc.value, grantReason.value);
    toast.push({ type: 'success', text: 'Đã cộng/trừ tài sản.' });
    grantOpen.value = null;
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

async function approveTopup(o: TopupOrderView): Promise<void> {
  if (!confirm(`Duyệt đơn ${o.transferCode} cộng ${o.tienNgocAmount} tiên ngọc?`)) return;
  try {
    await adminApproveTopup(o.id, topupNote.value);
    toast.push({ type: 'success', text: 'Đã duyệt.' });
    await refreshTopups();
  } catch (e) {
    handleErr(e);
  }
}

async function rejectTopup(o: TopupOrderView): Promise<void> {
  if (!confirm(`Từ chối đơn ${o.transferCode}?`)) return;
  try {
    await adminRejectTopup(o.id, topupNote.value);
    toast.push({ type: 'success', text: 'Đã từ chối.' });
    await refreshTopups();
  } catch (e) {
    handleErr(e);
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string }).code ?? 'ERR';
  const msg: Record<string, string> = {
    UNAUTHENTICATED: 'Hết phiên, hãy đăng nhập lại.',
    FORBIDDEN: 'Không đủ quyền.',
    NOT_FOUND: 'Không tìm thấy.',
    ALREADY_PROCESSED: 'Đơn đã được xử lý.',
    INVALID_INPUT: 'Tham số không hợp lệ (vượt giới hạn / âm quá mức).',
    CANNOT_TARGET_SELF: 'Không thể tự thao tác lên bản thân.',
  };
  toast.push({ type: 'error', text: msg[code] ?? `Lỗi: ${code}` });
}

const isAdmin = () => game.character?.role === 'ADMIN';
</script>

<template>
  <AppShell>
    <div class="max-w-6xl mx-auto space-y-4">
      <header class="flex items-center gap-3">
        <h1 class="text-2xl tracking-widest font-bold">Quản Trị</h1>
        <span class="text-amber-200 text-xs">Role: {{ game.character?.role ?? '?' }}</span>
      </header>

      <nav class="flex gap-1 border-b border-ink-300/30 text-sm">
        <button
          v-for="t in (['users','topups','audit'] as const)"
          :key="t"
          class="px-3 py-2"
          :class="tab === t ? 'border-b-2 border-amber-300 text-ink-50' : 'text-ink-300'"
          @click="tab = t"
        >
          {{ t === 'users' ? 'Người dùng' : t === 'topups' ? 'Đơn nạp' : 'Audit' }}
        </button>
      </nav>

      <!-- USERS TAB -->
      <section v-if="tab === 'users'" class="space-y-3">
        <div class="flex gap-2 items-center text-sm">
          <input
            v-model="userQuery"
            placeholder="Tìm email hoặc đạo hiệu…"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded flex-1"
            @keydown.enter="userPage = 0; refreshUsers()"
          />
          <MButton @click="userPage = 0; refreshUsers()">Tìm</MButton>
        </div>

        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">Email</th>
              <th>Đạo Hiệu</th>
              <th>Cảnh giới</th>
              <th>Linh Thạch</th>
              <th>Tiên Ngọc</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-t border-ink-300/20">
              <td class="py-1 truncate max-w-[14rem]">{{ u.email }}</td>
              <td>{{ u.character?.name ?? '—' }}</td>
              <td>{{ u.character ? `${u.character.realmKey} ${u.character.realmStage}` : '—' }}</td>
              <td>{{ u.character?.linhThach ?? '—' }}</td>
              <td>{{ u.character?.tienNgoc ?? '—' }}</td>
              <td>
                <select
                  :value="u.role"
                  :disabled="!isAdmin()"
                  class="bg-ink-700/40 border border-ink-300/30 rounded text-xs px-1"
                  @change="changeRole(u, ($event.target as HTMLSelectElement).value as Role)"
                >
                  <option value="PLAYER">PLAYER</option>
                  <option value="MOD">MOD</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td>
                <span
                  class="px-1.5 py-0.5 rounded text-[10px]"
                  :class="u.banned ? 'bg-red-700/40 text-red-200' : 'bg-emerald-700/40 text-emerald-200'"
                >
                  {{ u.banned ? 'BANNED' : 'OK' }}
                </span>
              </td>
              <td class="space-x-1">
                <button class="text-xs text-amber-200 underline" @click="openGrant(u)">
                  Cộng/Trừ
                </button>
                <button class="text-xs text-red-200 underline" @click="toggleBan(u)">
                  {{ u.banned ? 'Mở' : 'Khoá' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="flex justify-between text-xs text-ink-300">
          <span>Tổng: {{ userTotal }}</span>
          <div class="space-x-2">
            <button :disabled="userPage === 0" @click="userPage--; refreshUsers()">‹ Trước</button>
            <span>Trang {{ userPage + 1 }}</span>
            <button @click="userPage++; refreshUsers()">Sau ›</button>
          </div>
        </div>

        <!-- Grant modal -->
        <div
          v-if="grantOpen"
          class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          @click.self="grantOpen = null"
        >
          <div class="bg-ink-700 border border-ink-300/40 rounded p-4 w-full max-w-md space-y-3">
            <h3 class="text-lg">Cộng/Trừ tài sản</h3>
            <label class="block text-xs">
              Linh thạch (có thể âm)
              <input
                v-model="grantLinhThach"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block text-xs">
              Tiên ngọc (số nguyên, có thể âm)
              <input
                v-model.number="grantTienNgoc"
                type="number"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block text-xs">
              Lý do (lưu vào audit log)
              <input
                v-model="grantReason"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button class="text-xs text-ink-300" @click="grantOpen = null">Huỷ</button>
              <MButton @click="submitGrant">Xác nhận</MButton>
            </div>
          </div>
        </div>
      </section>

      <!-- TOPUPS TAB -->
      <section v-else-if="tab === 'topups'" class="space-y-3">
        <div class="flex gap-2 items-center text-sm">
          <select
            v-model="topupStatus"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @change="topupPage = 0; refreshTopups()"
          >
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
            <option value="">Tất cả</option>
          </select>
          <input
            v-model="topupNote"
            placeholder="Ghi chú khi duyệt/từ chối…"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded flex-1"
          />
        </div>

        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">Mã</th>
              <th>User</th>
              <th>Gói</th>
              <th>Tiền</th>
              <th>Tiên Ngọc</th>
              <th>Status</th>
              <th>Tạo lúc</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in topups" :key="o.id" class="border-t border-ink-300/20">
              <td class="py-1 font-mono text-amber-200">{{ o.transferCode }}</td>
              <td class="truncate max-w-[12rem]">{{ o.userEmail }}</td>
              <td>{{ o.packageName }}</td>
              <td>{{ o.priceVND.toLocaleString('vi-VN') }} ₫</td>
              <td>{{ o.tienNgocAmount }}</td>
              <td>{{ o.status }}</td>
              <td class="text-ink-300">{{ new Date(o.createdAt).toLocaleString('vi-VN') }}</td>
              <td class="text-ink-300">{{ o.note || '—' }}</td>
              <td v-if="o.status === 'PENDING'" class="space-x-1">
                <button class="text-xs text-emerald-200 underline" @click="approveTopup(o)">
                  Duyệt
                </button>
                <button class="text-xs text-red-200 underline" @click="rejectTopup(o)">
                  Từ chối
                </button>
              </td>
              <td v-else class="text-ink-300 text-xs">{{ o.approvedByEmail ?? '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="flex justify-between text-xs text-ink-300">
          <span>Tổng: {{ topupTotal }}</span>
          <div class="space-x-2">
            <button :disabled="topupPage === 0" @click="topupPage--; refreshTopups()">‹ Trước</button>
            <span>Trang {{ topupPage + 1 }}</span>
            <button @click="topupPage++; refreshTopups()">Sau ›</button>
          </div>
        </div>
      </section>

      <!-- AUDIT TAB -->
      <section v-else class="space-y-3">
        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">Lúc</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in audits" :key="a.id" class="border-t border-ink-300/20">
              <td class="py-1 text-ink-300">{{ new Date(a.createdAt).toLocaleString('vi-VN') }}</td>
              <td>{{ a.actorEmail ?? a.actorUserId }}</td>
              <td><b>{{ a.action }}</b></td>
              <td class="text-xs text-ink-300 font-mono">{{ JSON.stringify(a.meta) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="flex justify-between text-xs text-ink-300">
          <span>Tổng: {{ auditTotal }}</span>
          <div class="space-x-2">
            <button :disabled="auditPage === 0" @click="auditPage--; refreshAudit()">‹ Trước</button>
            <span>Trang {{ auditPage + 1 }}</span>
            <button @click="auditPage++; refreshAudit()">Sau ›</button>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>
