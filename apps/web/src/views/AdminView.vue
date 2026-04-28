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
  adminEconomyAlerts,
  adminGrant,
  adminListAudit,
  adminListTopups,
  adminListUsers,
  adminRejectTopup,
  adminSetRole,
  adminSpawnBoss,
  adminStats,
  type AdminAuditRow,
  type AdminEconomyAlerts,
  type AdminStats,
  type AdminUserRow,
  type Role,
} from '@/api/admin';
import { getCurrentBoss, type BossView } from '@/api/boss';
import type { TopupOrderView } from '@/api/topup';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();
const { t } = useI18n();

type Tab = 'stats' | 'users' | 'topups' | 'audit' | 'boss';
const tab = ref<Tab>('stats');
const stats = ref<AdminStats | null>(null);
const alerts = ref<AdminEconomyAlerts | null>(null);

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

// Boss tab
const bossKey = ref('');
const bossLevel = ref<number>(1);
const bossForce = ref(false);
const currentBoss = ref<BossView | null>(null);
const bossSpawning = ref(false);

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
  await refreshStats();
});

watch(tab, async (curTab) => {
  if (curTab === 'stats') await refreshStats();
  else if (curTab === 'users') await refreshUsers();
  else if (curTab === 'boss') await refreshCurrentBoss();
  else if (curTab === 'topups') await refreshTopups();
  else if (curTab === 'audit') await refreshAudit();
});

async function refreshStats(): Promise<void> {
  loading.value = true;
  try {
    const [s, a] = await Promise.all([adminStats(), adminEconomyAlerts()]);
    stats.value = s;
    alerts.value = a;
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

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

async function refreshCurrentBoss(): Promise<void> {
  try {
    currentBoss.value = await getCurrentBoss();
  } catch {
    currentBoss.value = null;
  }
}

async function spawnBoss(): Promise<void> {
  if (bossSpawning.value) return;
  bossSpawning.value = true;
  try {
    const r = await adminSpawnBoss({
      bossKey: bossKey.value.trim() || undefined,
      level: bossLevel.value,
      force: bossForce.value,
    });
    toast.push({
      type: 'success',
      text: t('admin.boss.spawned', { name: r.bossKey, level: r.level }),
    });
    await refreshCurrentBoss();
  } catch (e) {
    handleErr(e);
  } finally {
    bossSpawning.value = false;
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
          v-for="tk in (['stats','users','topups','audit','boss'] as const)"
          :key="tk"
          class="px-3 py-2"
          :class="tab === tk ? 'border-b-2 border-amber-300 text-ink-50' : 'text-ink-300'"
          @click="tab = tk"
        >
          {{ t(`admin.tab.${tk}`) }}
        </button>
      </nav>

      <!-- STATS TAB -->
      <section v-if="tab === 'stats'" class="space-y-4">
        <div v-if="!stats" class="text-ink-300 text-sm">{{ t('common.loading') }}</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="bg-ink-700/30 border border-ink-300/20 rounded p-3">
            <h3 class="text-sm text-amber-200">{{ t('admin.stats.users') }}</h3>
            <dl class="text-sm mt-2 space-y-1">
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.total') }}</dt><dd>{{ stats.users.total }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.admins') }}</dt><dd>{{ stats.users.admins }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.banned') }}</dt><dd>{{ stats.users.banned }}</dd></div>
            </dl>
          </div>
          <div class="bg-ink-700/30 border border-ink-300/20 rounded p-3">
            <h3 class="text-sm text-amber-200">{{ t('admin.stats.characters') }}</h3>
            <dl class="text-sm mt-2 space-y-1">
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.total') }}</dt><dd>{{ stats.characters.total }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.cultivating') }}</dt><dd>{{ stats.characters.cultivating }}</dd></div>
            </dl>
            <h4 class="text-xs text-ink-300 mt-3 mb-1">{{ t('admin.stats.bySect') }}</h4>
            <ul class="text-xs space-y-0.5">
              <li v-for="s in stats.characters.bySect" :key="s.sectId ?? 'none'" class="flex justify-between">
                <span>{{ s.name }}</span>
                <span>{{ s.count }}</span>
              </li>
            </ul>
          </div>
          <div class="bg-ink-700/30 border border-ink-300/20 rounded p-3">
            <h3 class="text-sm text-amber-200">{{ t('admin.stats.economy') }}</h3>
            <dl class="text-sm mt-2 space-y-1">
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.linhThach') }}</dt><dd>{{ stats.economy.linhThachCirculating }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.tienNgoc') }}</dt><dd>{{ stats.economy.tienNgocCirculating }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.topupPending') }}</dt><dd>{{ stats.economy.topupPending }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.topupApproved') }}</dt><dd>{{ stats.economy.topupApproved }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.topupRejected') }}</dt><dd>{{ stats.economy.topupRejected }}</dd></div>
            </dl>
          </div>
          <div class="bg-ink-700/30 border border-ink-300/20 rounded p-3 md:col-span-3">
            <h3 class="text-sm text-amber-200">{{ t('admin.stats.activity') }}</h3>
            <dl class="text-sm mt-2 grid grid-cols-2 gap-2">
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.last24hLogins') }}</dt><dd>{{ stats.activity.last24hLogins }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-300">{{ t('admin.stats.last7dRegistrations') }}</dt><dd>{{ stats.activity.last7dRegistrations }}</dd></div>
            </dl>
          </div>
        </div>

        <!-- ECONOMY ALERTS -->
        <div v-if="alerts" class="bg-ink-700/30 border border-amber-500/30 rounded p-3">
          <h3 class="text-sm text-amber-200 font-semibold">{{ t('admin.alerts.title') }}</h3>
          <p class="text-xs text-ink-300 mt-1">{{ t('admin.alerts.subtitle', { hours: alerts.staleHours }) }}</p>

          <div v-if="alerts.negativeCurrency.length === 0 && alerts.negativeInventory.length === 0 && alerts.stalePendingTopups.length === 0" class="text-emerald-300 text-sm mt-2">
            {{ t('admin.alerts.allClear') }}
          </div>

          <div v-else class="mt-3 space-y-3">
            <!-- negative currency -->
            <div v-if="alerts.negativeCurrency.length > 0">
              <h4 class="text-xs text-rose-300 uppercase tracking-wide">{{ t('admin.alerts.negativeCurrency') }} ({{ alerts.negativeCurrency.length }})</h4>
              <ul class="text-xs space-y-0.5 mt-1">
                <li v-for="row in alerts.negativeCurrency" :key="row.characterId" class="flex justify-between gap-2">
                  <span class="truncate">{{ row.name }} <span class="text-ink-300">({{ row.userEmail }})</span></span>
                  <span class="text-rose-300 font-mono">LT={{ row.linhThach }} · TN={{ row.tienNgoc }} · TNK={{ row.tienNgocKhoa }}</span>
                </li>
              </ul>
            </div>

            <!-- negative inventory -->
            <div v-if="alerts.negativeInventory.length > 0">
              <h4 class="text-xs text-rose-300 uppercase tracking-wide">{{ t('admin.alerts.negativeInventory') }} ({{ alerts.negativeInventory.length }})</h4>
              <ul class="text-xs space-y-0.5 mt-1">
                <li v-for="row in alerts.negativeInventory" :key="row.inventoryItemId" class="flex justify-between gap-2">
                  <span class="truncate">{{ row.characterName }} · <span class="text-ink-300">{{ row.itemKey }}</span></span>
                  <span class="text-rose-300 font-mono">qty={{ row.qty }}</span>
                </li>
              </ul>
            </div>

            <!-- stale topups -->
            <div v-if="alerts.stalePendingTopups.length > 0">
              <h4 class="text-xs text-amber-300 uppercase tracking-wide">{{ t('admin.alerts.stalePendingTopups') }} ({{ alerts.stalePendingTopups.length }})</h4>
              <ul class="text-xs space-y-0.5 mt-1">
                <li v-for="row in alerts.stalePendingTopups" :key="row.id" class="flex justify-between gap-2">
                  <span class="truncate">{{ row.userEmail }} · <span class="text-ink-300">{{ row.packageKey }}</span> · {{ row.tienNgocAmount }} TN</span>
                  <span class="text-amber-300 font-mono">{{ row.ageHours }}h</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <MButton @click="refreshStats()">{{ t('common.refresh') }}</MButton>
      </section>

      <!-- USERS TAB -->
      <section v-else-if="tab === 'users'" class="space-y-3">
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
      <section v-else-if="tab === 'audit'" class="space-y-3">
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

      <!-- BOSS TAB -->
      <section v-else class="space-y-3 max-w-xl">
        <h2 class="text-lg text-amber-200">{{ t('admin.boss.title') }}</h2>
        <p class="text-xs text-ink-300">{{ t('admin.boss.hint') }}</p>
        <div v-if="currentBoss" class="text-sm text-ink-200 bg-ink-700/30 border border-ink-300/20 rounded p-2">
          {{ t('admin.boss.currentlyActive', { name: currentBoss.name, level: currentBoss.level }) }}
        </div>
        <div class="space-y-2 text-sm">
          <label class="block">
            <span class="text-ink-300">{{ t('admin.boss.bossKey') }}</span>
            <input
              v-model="bossKey"
              class="w-full bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1 mt-1"
              placeholder="huyet_ma"
            />
          </label>
          <label class="block">
            <span class="text-ink-300">{{ t('admin.boss.level') }}</span>
            <input
              v-model.number="bossLevel"
              type="number"
              min="1"
              max="10"
              class="w-32 bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1 mt-1"
            />
          </label>
          <label class="flex items-center gap-2 text-ink-200">
            <input v-model="bossForce" type="checkbox" />
            <span>{{ t('admin.boss.force') }}</span>
          </label>
        </div>
        <MButton :disabled="bossSpawning || !isAdmin()" @click="spawnBoss()">
          {{ t('admin.boss.spawn') }}
        </MButton>
      </section>
    </div>
  </AppShell>
</template>
