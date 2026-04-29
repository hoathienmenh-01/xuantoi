<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import { isSelfTarget, canChangeRole, canTargetUser } from '@/lib/adminGuards';
import { countEconomyAlerts } from '@/lib/adminAlerts';
import {
  adminApproveTopup,
  adminAuditLedger,
  adminBanUser,
  adminCreateGiftcode,
  adminEconomyAlerts,
  adminGrant,
  adminListAudit,
  adminListGiftcodes,
  adminListTopups,
  adminListUsers,
  adminRejectTopup,
  adminRevokeGiftcode,
  adminRevokeInventory,
  adminSetRole,
  adminSpawnBoss,
  adminStats,
  giftCodeStatusOf,
  type AdminAuditRow,
  type AdminEconomyAlerts,
  type AdminGiftCodeRow,
  type AdminLedgerAudit,
  type AdminStats,
  type AdminUserRow,
  type GiftCodeStatus,
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

type Tab = 'stats' | 'users' | 'topups' | 'audit' | 'giftcodes' | 'boss';
const tab = ref<Tab>('stats');
const stats = ref<AdminStats | null>(null);
const alerts = ref<AdminEconomyAlerts | null>(null);

/**
 * Smart admin alerts badge: tổng số bất thường economy hiện tại.
 * Hiển thị red dot trên nav button Stats khi > 0 — admin biết ngay
 * có vấn đề cần xử lý mà không cần mở từng tab.
 */
const alertsCount = computed(() => countEconomyAlerts(alerts.value));

let alertsPollTimer: ReturnType<typeof setInterval> | null = null;

// Smart economy safety: ledger audit on-demand
const ledgerAudit = ref<AdminLedgerAudit | null>(null);
const ledgerAuditRunning = ref(false);
const ledgerAuditTotal = computed(() => {
  if (!ledgerAudit.value) return 0;
  return (
    ledgerAudit.value.currencyDiscrepancies.length +
    ledgerAudit.value.inventoryDiscrepancies.length
  );
});

// Users tab
const userQuery = ref('');
const userPage = ref(0);
const userRoleFilter = ref<'' | Role>('');
const userBannedFilter = ref<'' | 'true' | 'false'>('');
const users = ref<AdminUserRow[]>([]);
const userTotal = ref(0);
const grantOpen = ref<string | null>(null);
const grantLinhThach = ref('0');
const grantTienNgoc = ref(0);
const grantReason = ref('');

const revokeOpen = ref<string | null>(null);
const revokeItemKey = ref('');
const revokeQty = ref(1);
const revokeReason = ref('');

// Topups tab
const topupStatus = ref<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
const topupPage = ref(0);
const topupFromDate = ref('');
const topupToDate = ref('');
const topupEmailFilter = ref('');
const topups = ref<(TopupOrderView & { userEmail: string })[]>([]);
const topupTotal = ref(0);
const topupNote = ref('');

// Audit tab
const auditPage = ref(0);
const auditActionFilter = ref('');
const auditEmailFilter = ref('');
const audits = ref<AdminAuditRow[]>([]);
const auditTotal = ref(0);

// Giftcodes tab
const giftQuery = ref('');
const giftStatusFilter = ref<'' | GiftCodeStatus>('');
const giftcodes = ref<AdminGiftCodeRow[]>([]);
const giftCreateOpen = ref(false);
const giftCreateCode = ref('');
const giftCreateLinhThach = ref('0');
const giftCreateTienNgoc = ref(0);
const giftCreateExp = ref('0');
const giftCreateMaxRedeems = ref<number | ''>('');
const giftCreateExpiresDays = ref<number | ''>('');
const giftCreating = ref(false);

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
  // Smart polling: re-fetch alerts mỗi 60s để badge stats luôn cập nhật
  // dù admin đang ở tab khác. Stats panel chính chỉ refresh khi đóng/mở tab.
  alertsPollTimer = setInterval(() => {
    void refreshAlertsOnly();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (alertsPollTimer !== null) {
    clearInterval(alertsPollTimer);
    alertsPollTimer = null;
  }
});

watch(tab, async (curTab) => {
  if (curTab === 'stats') await refreshStats();
  else if (curTab === 'users') await refreshUsers();
  else if (curTab === 'boss') await refreshCurrentBoss();
  else if (curTab === 'topups') await refreshTopups();
  else if (curTab === 'audit') await refreshAudit();
  else if (curTab === 'giftcodes') await refreshGiftcodes();
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

/**
 * Refresh chỉ alerts — dùng cho polling 60s, không đổi `loading` để tránh
 * nhấp nháy UI khi admin đang thao tác ở tab khác. Lỗi im lặng (next poll sẽ retry).
 */
async function refreshAlertsOnly(): Promise<void> {
  try {
    alerts.value = await adminEconomyAlerts();
  } catch {
    // ignore — next 60s poll sẽ retry
  }
}

/**
 * Smart economy safety: chạy ledger audit on-demand. Kết quả hiển thị trong
 * Stats tab. Endpoint có thể hai nặng (groupBy 4 query) → disable button khi
 * đang chạy.
 */
async function runLedgerAudit(): Promise<void> {
  ledgerAuditRunning.value = true;
  try {
    ledgerAudit.value = await adminAuditLedger();
  } catch (e) {
    handleErr(e);
  } finally {
    ledgerAuditRunning.value = false;
  }
}

async function refreshUsers(): Promise<void> {
  loading.value = true;
  try {
    const filters: { role?: Role; banned?: boolean } = {};
    if (userRoleFilter.value) filters.role = userRoleFilter.value;
    if (userBannedFilter.value === 'true') filters.banned = true;
    else if (userBannedFilter.value === 'false') filters.banned = false;
    const r = await adminListUsers(userQuery.value, userPage.value, filters);
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
    const filters: { from?: string; to?: string; email?: string } = {};
    // Cả `from` và `to` đều dùng local timezone (consistent). `new Date("YYYY-MM-DD")`
    // mặc định parse UTC midnight → admin múi giờ +7 chọn from=10/4 sẽ bỏ sót đơn
    // tạo trong khoảng 0h–7h local 10/4. Fix: setHours theo local cho cả 2 đầu.
    if (topupFromDate.value) {
      const d = new Date(topupFromDate.value);
      d.setHours(0, 0, 0, 0);
      filters.from = d.toISOString();
    }
    if (topupToDate.value) {
      const d = new Date(topupToDate.value);
      d.setHours(23, 59, 59, 999);
      filters.to = d.toISOString();
    }
    if (topupEmailFilter.value) filters.email = topupEmailFilter.value;
    const r = await adminListTopups(topupStatus.value, topupPage.value, filters);
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
    const filters: { action?: string; email?: string } = {};
    if (auditActionFilter.value) filters.action = auditActionFilter.value;
    if (auditEmailFilter.value) filters.email = auditEmailFilter.value;
    const r = await adminListAudit(auditPage.value, filters);
    audits.value = r.rows;
    auditTotal.value = r.total;
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

async function toggleBan(u: AdminUserRow): Promise<void> {
  if (!canTargetUser({ actorUserId: auth.user?.id, targetUserId: u.id }).allowed) {
    toast.push({ type: 'error', text: t('errors.CANNOT_TARGET_SELF') });
    return;
  }
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
  const guard = canChangeRole({
    actorRole: game.character?.role,
    actorUserId: auth.user?.id,
    targetUserId: u.id,
  });
  if (!guard.allowed) {
    toast.push({
      type: 'error',
      text:
        guard.reason === 'SELF_TARGET'
          ? t('errors.CANNOT_TARGET_SELF')
          : t('admin.noPermission'),
    });
    // Force-refresh để revert select về role cũ trên UI.
    await refreshUsers();
    return;
  }
  if (!confirm(t('admin.users.roleChangeConfirm', { email: u.email, role }))) {
    await refreshUsers();
    return;
  }
  try {
    await adminSetRole(u.id, role);
    toast.push({ type: 'success', text: t('admin.users.roleChangedToast') });
    await refreshUsers();
  } catch (e) {
    handleErr(e);
  }
}

function openGrant(u: AdminUserRow): void {
  if (!canTargetUser({ actorUserId: auth.user?.id, targetUserId: u.id }).allowed) {
    toast.push({ type: 'error', text: t('errors.CANNOT_TARGET_SELF') });
    return;
  }
  grantOpen.value = u.id;
  grantLinhThach.value = '0';
  grantTienNgoc.value = 0;
  grantReason.value = '';
}

/** Chính tài khoản đang đăng nhập? Dùng cho `:disabled` ở UI. */
function isSelfRow(u: AdminUserRow): boolean {
  return isSelfTarget(auth.user?.id, u.id);
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

function openRevoke(u: AdminUserRow): void {
  if (isSelfTarget(auth.user?.id, u.id)) {
    toast.push({ type: 'error', text: t('errors.CANNOT_TARGET_SELF') });
    return;
  }
  revokeOpen.value = u.id;
  revokeItemKey.value = '';
  revokeQty.value = 1;
  revokeReason.value = '';
}

async function submitRevoke(): Promise<void> {
  if (!revokeOpen.value) return;
  const itemKey = revokeItemKey.value.trim();
  if (!itemKey) {
    toast.push({ type: 'error', text: t('admin.users.revokeMissingItemKey') });
    return;
  }
  if (!Number.isInteger(revokeQty.value) || revokeQty.value < 1 || revokeQty.value > 999) {
    toast.push({ type: 'error', text: t('admin.users.revokeInvalidQty') });
    return;
  }
  try {
    await adminRevokeInventory(revokeOpen.value, itemKey, revokeQty.value, revokeReason.value);
    toast.push({ type: 'success', text: t('admin.users.revokedToast') });
    revokeOpen.value = null;
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

async function refreshGiftcodes(): Promise<void> {
  loading.value = true;
  try {
    const filters: { q?: string; status?: GiftCodeStatus | '' } = {};
    if (giftQuery.value) filters.q = giftQuery.value.trim();
    if (giftStatusFilter.value) filters.status = giftStatusFilter.value;
    giftcodes.value = await adminListGiftcodes(filters);
  } catch (e) {
    handleErr(e);
  } finally {
    loading.value = false;
  }
}

function openGiftCreate(): void {
  giftCreateOpen.value = true;
  giftCreateCode.value = '';
  giftCreateLinhThach.value = '0';
  giftCreateTienNgoc.value = 0;
  giftCreateExp.value = '0';
  giftCreateMaxRedeems.value = '';
  giftCreateExpiresDays.value = '';
}

async function submitGiftCreate(): Promise<void> {
  if (giftCreating.value) return;
  giftCreating.value = true;
  try {
    const input: Parameters<typeof adminCreateGiftcode>[0] = {
      code: giftCreateCode.value.trim(),
      rewardLinhThach: giftCreateLinhThach.value || '0',
      rewardTienNgoc: giftCreateTienNgoc.value || 0,
      rewardExp: giftCreateExp.value || '0',
    };
    if (typeof giftCreateMaxRedeems.value === 'number' && giftCreateMaxRedeems.value > 0) {
      input.maxRedeems = giftCreateMaxRedeems.value;
    }
    if (typeof giftCreateExpiresDays.value === 'number' && giftCreateExpiresDays.value > 0) {
      const d = new Date();
      d.setDate(d.getDate() + giftCreateExpiresDays.value);
      input.expiresAt = d.toISOString();
    }
    await adminCreateGiftcode(input);
    toast.push({ type: 'success', text: t('admin.giftcodes.createdToast') });
    giftCreateOpen.value = false;
    await refreshGiftcodes();
  } catch (e) {
    handleErr(e);
  } finally {
    giftCreating.value = false;
  }
}

async function revokeGiftcode(row: AdminGiftCodeRow): Promise<void> {
  if (!confirm(t('admin.giftcodes.revokeConfirm', { code: row.code }))) return;
  try {
    await adminRevokeGiftcode(row.code);
    toast.push({ type: 'success', text: t('admin.giftcodes.revokedToast') });
    await refreshGiftcodes();
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
          v-for="tk in (['stats','users','topups','audit','giftcodes','boss'] as const)"
          :key="tk"
          class="px-3 py-2 relative"
          :class="tab === tk ? 'border-b-2 border-amber-300 text-ink-50' : 'text-ink-300'"
          @click="tab = tk"
        >
          {{ t(`admin.tab.${tk}`) }}
          <span
            v-if="tk === 'stats' && alertsCount > 0"
            data-testid="admin-tab-stats-alerts-badge"
            class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-ink-50 text-[10px] font-bold align-middle"
            :title="t('admin.alerts.badgeTooltip', { count: alertsCount })"
          >{{ alertsCount }}</span>
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

        <!-- LEDGER AUDIT (smart economy safety) -->
        <div class="bg-ink-700/30 border border-violet-500/30 rounded p-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-sm text-violet-200 font-semibold">{{ t('admin.ledgerAudit.title') }}</h3>
              <p class="text-xs text-ink-300 mt-1">{{ t('admin.ledgerAudit.subtitle') }}</p>
            </div>
            <MButton :disabled="ledgerAuditRunning" @click="runLedgerAudit()">
              {{ ledgerAuditRunning ? t('admin.ledgerAudit.running') : t('admin.ledgerAudit.run') }}
            </MButton>
          </div>

          <div v-if="ledgerAudit" class="mt-3 text-xs space-y-2">
            <div class="text-ink-300">
              {{ t('admin.ledgerAudit.scanned', { chars: ledgerAudit.charactersScanned, pairs: ledgerAudit.itemKeysScanned }) }}
            </div>
            <div
              v-if="ledgerAuditTotal === 0"
              data-testid="admin-ledger-audit-clean"
              class="text-emerald-300"
            >
              {{ t('admin.ledgerAudit.clean') }}
            </div>
            <div v-else class="space-y-2">
              <div
                data-testid="admin-ledger-audit-fail"
                class="text-rose-300 font-semibold"
              >
                {{ t('admin.ledgerAudit.fail', { count: ledgerAuditTotal }) }}
              </div>

              <div v-if="ledgerAudit.currencyDiscrepancies.length > 0">
                <h4 class="text-rose-300 uppercase tracking-wide">{{ t('admin.ledgerAudit.currencyHeading') }} ({{ ledgerAudit.currencyDiscrepancies.length }})</h4>
                <ul class="space-y-0.5 mt-1">
                  <li v-for="d in ledgerAudit.currencyDiscrepancies" :key="`${d.characterId}:${d.field}`" class="flex justify-between gap-2">
                    <span class="truncate font-mono">char={{ d.characterId.slice(0, 8) }} · {{ d.field }}</span>
                    <span class="text-rose-300 font-mono">ledger={{ d.ledgerSum }} · char={{ d.characterValue }} · diff={{ d.diff }}</span>
                  </li>
                </ul>
              </div>

              <div v-if="ledgerAudit.inventoryDiscrepancies.length > 0">
                <h4 class="text-rose-300 uppercase tracking-wide">{{ t('admin.ledgerAudit.inventoryHeading') }} ({{ ledgerAudit.inventoryDiscrepancies.length }})</h4>
                <ul class="space-y-0.5 mt-1">
                  <li v-for="d in ledgerAudit.inventoryDiscrepancies" :key="`${d.characterId}:${d.itemKey}`" class="flex justify-between gap-2">
                    <span class="truncate font-mono">char={{ d.characterId.slice(0, 8) }} · {{ d.itemKey }}</span>
                    <span class="text-rose-300 font-mono">ledger={{ d.ledgerSum }} · inv={{ d.inventorySum }} · diff={{ d.diff }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <MButton @click="refreshStats()">{{ t('common.refresh') }}</MButton>
      </section>

      <!-- USERS TAB -->
      <section v-else-if="tab === 'users'" class="space-y-3">
        <div class="flex gap-2 items-center text-sm flex-wrap">
          <input
            v-model="userQuery"
            :placeholder="t('admin.users.searchPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded flex-1 min-w-[200px]"
            @keydown.enter="userPage = 0; refreshUsers()"
          />
          <select
            v-model="userRoleFilter"
            data-testid="admin-users-role-filter"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @change="userPage = 0; refreshUsers()"
          >
            <option value="">{{ t('admin.users.filter.allRoles') }}</option>
            <option value="PLAYER">PLAYER</option>
            <option value="MOD">MOD</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select
            v-model="userBannedFilter"
            data-testid="admin-users-banned-filter"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @change="userPage = 0; refreshUsers()"
          >
            <option value="">{{ t('admin.users.filter.allStatus') }}</option>
            <option value="false">{{ t('admin.users.filter.active') }}</option>
            <option value="true">{{ t('admin.users.filter.banned') }}</option>
          </select>
          <MButton @click="userPage = 0; refreshUsers()">{{ t('common.search') }}</MButton>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[640px]">
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
              <tr
                v-for="u in users"
                :key="u.id"
                class="border-t border-ink-300/20"
                :class="isSelfRow(u) ? 'bg-amber-500/5' : ''"
                :data-self="isSelfRow(u) ? 'true' : 'false'"
              >
                <td class="py-1 truncate max-w-[14rem]">
                  {{ u.email }}
                  <span
                    v-if="isSelfRow(u)"
                    class="ml-1 rounded bg-amber-500/20 px-1 text-[10px] uppercase tracking-widest text-amber-200"
                  >{{ t('admin.users.selfBadge') }}</span>
                </td>
                <td>{{ u.character?.name ?? '—' }}</td>
                <td>{{ u.character ? `${u.character.realmKey} ${u.character.realmStage}` : '—' }}</td>
                <td>{{ u.character?.linhThach ?? '—' }}</td>
                <td>{{ u.character?.tienNgoc ?? '—' }}</td>
                <td>
                  <select
                    :value="u.role"
                    :disabled="!isAdmin() || isSelfRow(u)"
                    :data-testid="`admin-users-role-select-${u.id}`"
                    :title="isSelfRow(u) ? t('admin.users.selfDemoteBlocked') : ''"
                    class="bg-ink-700/40 border border-ink-300/30 rounded text-xs px-1 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <button
                    class="text-xs text-amber-200 underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
                    :disabled="isSelfRow(u)"
                    :title="isSelfRow(u) ? t('admin.users.selfDemoteBlocked') : ''"
                    :data-testid="`admin-users-grant-btn-${u.id}`"
                    @click="openGrant(u)"
                  >
                    {{ t('admin.users.grantBtn') }}
                  </button>
                  <button
                    class="text-xs text-red-200 underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
                    :disabled="isSelfRow(u)"
                    :title="isSelfRow(u) ? t('admin.users.selfDemoteBlocked') : ''"
                    :data-testid="`admin-users-ban-btn-${u.id}`"
                    @click="toggleBan(u)"
                  >
                    {{ u.banned ? t('admin.users.unlock') : t('admin.users.lock') }}
                  </button>
                  <button
                    v-if="isAdmin()"
                    class="text-xs text-orange-200 underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
                    :disabled="isSelfRow(u)"
                    :title="isSelfRow(u) ? t('admin.users.selfDemoteBlocked') : t('admin.users.revokeTitle')"
                    :data-testid="`admin-users-revoke-btn-${u.id}`"
                    @click="openRevoke(u)"
                  >
                    {{ t('admin.users.revokeBtn') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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

        <!-- Revoke inventory modal (admin-only, consume PR #66 BE) -->
        <div
          v-if="revokeOpen"
          class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          data-testid="admin-users-revoke-modal"
          @click.self="revokeOpen = null"
        >
          <div class="bg-ink-700 border border-ink-300/40 rounded p-4 w-full max-w-md space-y-3">
            <h3 class="text-lg">{{ t('admin.users.revokeTitle') }}</h3>
            <p class="text-xs text-ink-300">{{ t('admin.users.revokeHint') }}</p>
            <label class="block text-xs">
              {{ t('admin.users.revokeItemKey') }}
              <input
                v-model="revokeItemKey"
                data-testid="admin-users-revoke-itemkey"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1 font-mono"
                placeholder="VD: BINH_KHI_BAC"
              />
            </label>
            <label class="block text-xs">
              {{ t('admin.users.revokeQty') }}
              <input
                v-model.number="revokeQty"
                data-testid="admin-users-revoke-qty"
                type="number"
                min="1"
                max="999"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block text-xs">
              {{ t('admin.users.revokeReason') }}
              <input
                v-model="revokeReason"
                data-testid="admin-users-revoke-reason"
                class="w-full px-2 py-1 bg-ink-900/40 border border-ink-300/30 rounded mt-1"
                :placeholder="t('admin.users.revokeReasonPlaceholder')"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button class="text-xs text-ink-300" @click="revokeOpen = null">{{ t('common.cancel') }}</button>
              <MButton data-testid="admin-users-revoke-submit" @click="submitRevoke">{{ t('common.confirm') }}</MButton>
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
        <div class="flex gap-2 items-center text-xs flex-wrap">
          <label class="flex items-center gap-1">
            {{ t('admin.topups.filter.from') }}
            <input
              v-model="topupFromDate"
              data-testid="admin-topup-from-date"
              type="date"
              class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
              @change="topupPage = 0; refreshTopups()"
            />
          </label>
          <label class="flex items-center gap-1">
            {{ t('admin.topups.filter.to') }}
            <input
              v-model="topupToDate"
              data-testid="admin-topup-to-date"
              type="date"
              class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
              @change="topupPage = 0; refreshTopups()"
            />
          </label>
          <input
            v-model="topupEmailFilter"
            data-testid="admin-topup-email-filter"
            :placeholder="t('admin.topups.filter.emailPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @keydown.enter="topupPage = 0; refreshTopups()"
          />
          <MButton @click="topupPage = 0; refreshTopups()">{{ t('common.search') }}</MButton>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[640px]">
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
        </div>

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
        <div class="flex gap-2 items-center text-sm flex-wrap">
          <input
            v-model="auditActionFilter"
            data-testid="admin-audit-action-filter"
            :placeholder="t('admin.audit.filter.actionPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @keydown.enter="auditPage = 0; refreshAudit()"
          />
          <input
            v-model="auditEmailFilter"
            data-testid="admin-audit-email-filter"
            :placeholder="t('admin.audit.filter.emailPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @keydown.enter="auditPage = 0; refreshAudit()"
          />
          <MButton @click="auditPage = 0; refreshAudit()">{{ t('common.search') }}</MButton>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[560px]">
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
        </div>
        <div class="flex justify-between text-xs text-ink-300">
          <span>{{ t('common.total') }}: {{ auditTotal }}</span>
          <div class="space-x-2">
            <button :disabled="auditPage === 0" @click="auditPage--; refreshAudit()">{{ t('common.pagePrev') }}</button>
            <span>{{ t('common.page') }} {{ auditPage + 1 }}</span>
            <button @click="auditPage++; refreshAudit()">{{ t('common.pageNext') }}</button>
          </div>
        </div>
      </section>

      <!-- GIFTCODES TAB -->
      <section v-else-if="tab === 'giftcodes'" class="space-y-3" data-testid="admin-giftcodes-section">
        <div class="flex gap-2 items-center text-sm flex-wrap">
          <input
            v-model="giftQuery"
            data-testid="admin-giftcode-q"
            :placeholder="t('admin.giftcodes.filter.qPlaceholder')"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @keydown.enter="refreshGiftcodes()"
          />
          <select
            v-model="giftStatusFilter"
            data-testid="admin-giftcode-status"
            class="px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded"
            @change="refreshGiftcodes()"
          >
            <option value="">{{ t('common.all') }}</option>
            <option value="ACTIVE">{{ t('admin.giftcodes.status.ACTIVE') }}</option>
            <option value="REVOKED">{{ t('admin.giftcodes.status.REVOKED') }}</option>
            <option value="EXPIRED">{{ t('admin.giftcodes.status.EXPIRED') }}</option>
            <option value="EXHAUSTED">{{ t('admin.giftcodes.status.EXHAUSTED') }}</option>
          </select>
          <MButton data-testid="admin-giftcode-search" @click="refreshGiftcodes()">{{ t('common.search') }}</MButton>
          <MButton
            v-if="isAdmin()"
            data-testid="admin-giftcode-open-create"
            @click="openGiftCreate()"
          >
            {{ t('admin.giftcodes.createBtn') }}
          </MButton>
        </div>

        <!-- Create form (admin only) -->
        <div
          v-if="giftCreateOpen"
          data-testid="admin-giftcode-create-form"
          class="bg-ink-700/30 border border-amber-300/30 rounded p-3 space-y-2 text-sm"
        >
          <h3 class="text-amber-200">{{ t('admin.giftcodes.createTitle') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.code') }}</span>
              <input
                v-model="giftCreateCode"
                data-testid="admin-giftcode-code"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1 font-mono"
                placeholder="WELCOME100"
                maxlength="32"
              />
            </label>
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.linhThach') }}</span>
              <input
                v-model="giftCreateLinhThach"
                data-testid="admin-giftcode-linh"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1"
                inputmode="numeric"
              />
            </label>
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.tienNgoc') }}</span>
              <input
                v-model.number="giftCreateTienNgoc"
                data-testid="admin-giftcode-ngoc"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1"
              />
            </label>
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.exp') }}</span>
              <input
                v-model="giftCreateExp"
                data-testid="admin-giftcode-exp"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1"
                inputmode="numeric"
              />
            </label>
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.maxRedeems') }}</span>
              <input
                v-model.number="giftCreateMaxRedeems"
                data-testid="admin-giftcode-maxredeems"
                type="number"
                min="1"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1"
                :placeholder="t('admin.giftcodes.create.maxRedeemsPlaceholder')"
              />
            </label>
            <label class="block">
              <span class="text-ink-300 text-xs">{{ t('admin.giftcodes.create.expiresDays') }}</span>
              <input
                v-model.number="giftCreateExpiresDays"
                data-testid="admin-giftcode-expdays"
                type="number"
                min="1"
                class="w-full px-2 py-1 bg-ink-700/40 border border-ink-300/30 rounded mt-1"
                :placeholder="t('admin.giftcodes.create.expiresDaysPlaceholder')"
              />
            </label>
          </div>
          <div class="flex gap-2 justify-end">
            <button class="text-xs text-ink-300 underline" @click="giftCreateOpen = false">
              {{ t('common.cancel') }}
            </button>
            <MButton
              data-testid="admin-giftcode-submit-create"
              :disabled="giftCreating || !giftCreateCode.trim()"
              @click="submitGiftCreate()"
            >
              {{ giftCreating ? t('admin.giftcodes.creating') : t('admin.giftcodes.submitCreate') }}
            </MButton>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[640px]" data-testid="admin-giftcode-table">
            <thead class="text-ink-300 text-xs">
              <tr class="text-left">
                <th class="py-1">{{ t('admin.giftcodes.col.code') }}</th>
                <th>{{ t('admin.giftcodes.col.rewards') }}</th>
                <th>{{ t('admin.giftcodes.col.redeemed') }}</th>
                <th>{{ t('admin.giftcodes.col.expiresAt') }}</th>
                <th>{{ t('admin.giftcodes.col.status') }}</th>
                <th>{{ t('admin.giftcodes.col.createdAt') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="giftcodes.length === 0">
                <td colspan="7" class="py-4 text-center text-ink-300 text-xs" data-testid="admin-giftcode-empty">
                  {{ t('admin.giftcodes.empty') }}
                </td>
              </tr>
              <tr
                v-for="g in giftcodes"
                :key="g.id"
                class="border-t border-ink-300/20"
                :data-testid="`admin-giftcode-row-${g.code}`"
              >
                <td class="py-1 font-mono text-amber-200">{{ g.code }}</td>
                <td class="text-xs">
                  <span v-if="g.rewardLinhThach !== '0'">LT {{ g.rewardLinhThach }}</span>
                  <span v-if="g.rewardTienNgoc > 0" class="ml-2">TN {{ g.rewardTienNgoc }}</span>
                  <span v-if="g.rewardExp !== '0'" class="ml-2">EXP {{ g.rewardExp }}</span>
                  <span v-if="g.rewardItems.length > 0" class="ml-2 text-ink-300">
                    +{{ g.rewardItems.length }} {{ t('admin.giftcodes.itemsLabel') }}
                  </span>
                </td>
                <td>{{ g.redeemCount }}<span v-if="g.maxRedeems !== null">/{{ g.maxRedeems }}</span></td>
                <td class="text-ink-300 text-xs">
                  {{ g.expiresAt ? new Date(g.expiresAt).toLocaleString('vi-VN') : '—' }}
                </td>
                <td>
                  <span
                    class="text-xs px-2 py-0.5 rounded"
                    :class="{
                      'bg-emerald-700/30 text-emerald-200': giftCodeStatusOf(g) === 'ACTIVE',
                      'bg-red-700/30 text-red-200': giftCodeStatusOf(g) === 'REVOKED',
                      'bg-ink-700/30 text-ink-300': giftCodeStatusOf(g) === 'EXPIRED' || giftCodeStatusOf(g) === 'EXHAUSTED',
                    }"
                  >
                    {{ t(`admin.giftcodes.status.${giftCodeStatusOf(g)}`) }}
                  </span>
                </td>
                <td class="text-ink-300 text-xs">{{ new Date(g.createdAt).toLocaleString('vi-VN') }}</td>
                <td>
                  <button
                    v-if="isAdmin() && giftCodeStatusOf(g) === 'ACTIVE'"
                    :data-testid="`admin-giftcode-revoke-${g.code}`"
                    class="text-xs text-red-200 underline"
                    @click="revokeGiftcode(g)"
                  >
                    {{ t('admin.giftcodes.revokeBtn') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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
