<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

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
    toast.push({ type: 'error', text: t('admin.noPermission') });
    router.replace('/home');
    return;
  }
  await refreshUsers();
});

watch(tab, async (curTab) => {
  if (curTab === 'users') await refreshUsers();
  else if (curTab === 'topups') await refreshTopups();
  else if (curTab === 'audit') await refreshAudit();
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
  const action = u.banned ? t('admin.users.actionUnlock') : t('admin.users.actionLock');
  if (!confirm(t('admin.users.banConfirm', { action, email: u.email }))) return;
  try {
    await adminBanUser(u.id, !u.banned);
    toast.push({ type: 'success', text: t('admin.users.updatedToast') });
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

async function changeRole(u: AdminUserRow, role: Role): Promise<void> {
  if (u.role === role) return;
  if (!confirm(t('admin.users.roleChangeConfirm', { email: u.email, role }))) return;
  try {
    await adminSetRole(u.id, role);
    toast.push({ type: 'success', text: t('admin.users.roleChangedToast') });
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
    toast.push({ type: 'success', text: t('admin.users.grantedToast') });
    grantOpen.value = null;
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

async function approveTopup(o: TopupOrderView): Promise<void> {
  if (!confirm(t('admin.topups.approveConfirm', { code: o.transferCode, ngoc: o.tienNgocAmount }))) return;
  try {
    await adminApproveTopup(o.id, topupNote.value);
    toast.push({ type: 'success', text: t('admin.topups.approvedToast') });
    await refreshTopups();
  } catch (e) {
    handleErr(e);
  }
}

async function rejectTopup(o: TopupOrderView): Promise<void> {
  if (!confirm(t('admin.topups.rejectConfirm', { code: o.transferCode }))) return;
  try {
    await adminRejectTopup(o.id, topupNote.value);
    toast.push({ type: 'success', text: t('admin.topups.rejectedToast') });
    await refreshTopups();
  } catch (e) {
    handleErr(e);
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string }).code ?? 'ERR';
  const text = t(`admin.errors.${code}`, '__missing__');
  toast.push({
    type: 'error',
    text: text === '__missing__' ? t('admin.errors.UNKNOWN') : text,
  });
}

const isAdmin = () => game.character?.role === 'ADMIN';
</script>

<template>
  <AppShell>
    <div class="max-w-6xl mx-auto space-y-4">
      <header class="flex items-center gap-3">
        <h1 class="text-2xl tracking-widest font-bold">{{ t('admin.title') }}</h1>
        <span class="text-amber-200 text-xs">{{ t('admin.roleLabel', { role: game.character?.role ?? '?' }) }}</span>
      </header>

      <nav class="flex gap-1 border-b border-ink-300/30 text-sm">
        <button
          v-for="tk in (['users','topups','audit'] as const)"
          :key="tk"
          class="px-3 py-2"
          :class="tab === tk ? 'border-b-2 border-amber-300 text-ink-50' : 'text-ink-300'"
          @click="tab = tk"
        >
          {{ t(`admin.tab.${tk}`) }}
        </button>
      </nav>

      <!-- USERS TAB -->
      <section v-if="tab === 'users'" class="space-y-3">
        <div class="flex gap-2 items-center text-sm">
          <input
            v-model="userQuery"
            :placeholder="t('admin.users.searchPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded flex-1"
            @keydown.enter="userPage = 0; refreshUsers()"
          />
          <MButton @click="userPage = 0; refreshUsers()">{{ t('common.search') }}</MButton>
        </div>

        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">{{ t('admin.users.col.email') }}</th>
              <th>{{ t('admin.users.col.name') }}</th>
              <th>{{ t('admin.users.col.realm') }}</th>
              <th>{{ t('admin.users.col.linhThach') }}</th>
              <th>{{ t('admin.users.col.tienNgoc') }}</th>
              <th>{{ t('admin.users.col.role') }}</th>
              <th>{{ t('admin.users.col.status') }}</th>
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
                  {{ u.banned ? t('admin.users.banned') : t('admin.users.ok') }}
                </span>
              </td>
              <td class="space-x-1">
                <button class="text-xs text-amber-200 underline" @click="openGrant(u)">
                  {{ t('admin.users.grantBtn') }}
                </button>
                <button class="text-xs text-red-200 underline" @click="toggleBan(u)">
                  {{ u.banned ? t('admin.users.unlock') : t('admin.users.lock') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="flex justify-between text-xs text-ink-300">
          <span>{{ t('common.total') }}: {{ userTotal }}</span>
          <div class="space-x-2">
            <button :disabled="userPage === 0" @click="userPage--; refreshUsers()">{{ t('common.pagePrev') }}</button>
            <span>{{ t('common.page') }} {{ userPage + 1 }}</span>
            <button @click="userPage++; refreshUsers()">{{ t('common.pageNext') }}</button>
          </div>
        </div>

        <!-- Grant modal -->
        <div
          v-if="grantOpen"
          class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          @click.self="grantOpen = null"
        >
          <div class="bg-ink-700 border border-ink-300/40 rounded p-4 w-full max-w-md space-y-3">
            <h3 class="text-lg">{{ t('admin.users.grantTitle') }}</h3>
            <label class="block text-xs">
              {{ t('admin.users.grantLinh') }}
              <input
                v-model="grantLinhThach"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block text-xs">
              {{ t('admin.users.grantNgoc') }}
              <input
                v-model.number="grantTienNgoc"
                type="number"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block text-xs">
              {{ t('admin.users.grantReason') }}
              <input
                v-model="grantReason"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button class="text-xs text-ink-300" @click="grantOpen = null">{{ t('common.cancel') }}</button>
              <MButton @click="submitGrant">{{ t('common.confirm') }}</MButton>
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
            <option value="PENDING">{{ t('admin.topups.filter.PENDING') }}</option>
            <option value="APPROVED">{{ t('admin.topups.filter.APPROVED') }}</option>
            <option value="REJECTED">{{ t('admin.topups.filter.REJECTED') }}</option>
            <option value="">{{ t('common.all') }}</option>
          </select>
          <input
            v-model="topupNote"
            :placeholder="t('admin.topups.notePlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded flex-1"
          />
        </div>

        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">{{ t('admin.topups.col.code') }}</th>
              <th>{{ t('admin.topups.col.user') }}</th>
              <th>{{ t('admin.topups.col.package') }}</th>
              <th>{{ t('admin.topups.col.price') }}</th>
              <th>{{ t('admin.topups.col.tienNgoc') }}</th>
              <th>{{ t('admin.topups.col.status') }}</th>
              <th>{{ t('admin.topups.col.createdAt') }}</th>
              <th>{{ t('admin.topups.col.note') }}</th>
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
                  {{ t('admin.topups.approve') }}
                </button>
                <button class="text-xs text-red-200 underline" @click="rejectTopup(o)">
                  {{ t('admin.topups.reject') }}
                </button>
              </td>
              <td v-else class="text-ink-300 text-xs">{{ o.approvedByEmail ?? '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="flex justify-between text-xs text-ink-300">
          <span>{{ t('common.total') }}: {{ topupTotal }}</span>
          <div class="space-x-2">
            <button :disabled="topupPage === 0" @click="topupPage--; refreshTopups()">{{ t('common.pagePrev') }}</button>
            <span>{{ t('common.page') }} {{ topupPage + 1 }}</span>
            <button @click="topupPage++; refreshTopups()">{{ t('common.pageNext') }}</button>
          </div>
        </div>
      </section>

      <!-- AUDIT TAB -->
      <section v-else class="space-y-3">
        <table class="w-full text-sm">
          <thead class="text-ink-300 text-xs">
            <tr class="text-left">
              <th class="py-1">{{ t('admin.audit.col.at') }}</th>
              <th>{{ t('admin.audit.col.actor') }}</th>
              <th>{{ t('admin.audit.col.action') }}</th>
              <th>{{ t('admin.audit.col.meta') }}</th>
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
          <span>{{ t('common.total') }}: {{ auditTotal }}</span>
          <div class="space-x-2">
            <button :disabled="auditPage === 0" @click="auditPage--; refreshAudit()">{{ t('common.pagePrev') }}</button>
            <span>{{ t('common.page') }} {{ auditPage + 1 }}</span>
            <button @click="auditPage++; refreshAudit()">{{ t('common.pageNext') }}</button>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>
