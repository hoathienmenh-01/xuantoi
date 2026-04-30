import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import type {
  AdminStats,
  AdminEconomyAlerts,
  AdminGiftCodeRow,
} from '@/api/admin';

/**
 * AdminView render-level smoke tests (session 9k task C): cover onMounted role
 * guard (unauth redirect, non-admin redirect, admin success), top-level tab
 * badge rendering (stats alerts, pending topup, active giftcode), tab switch
 * fetch calls (users/topups/giftcodes), Export CSV download flow (success +
 * truncated warning + usersExporting guard), và Giftcode revoke ConfirmModal
 * wiring (open trên click, cancel đóng, confirm gọi adminRevokeGiftcode +
 * toast + refreshGiftcodes).
 *
 * Scope: 15 vitest. Mock toàn bộ @/api/admin + @/api/boss + stores + vue-router
 * + AppShell. ConfirmModal dùng Teleport → attachTo: document.body +
 * document.querySelector để kiểm tra. Cleanup: unmount + innerHTML='' ngăn
 * leak timer/DOM giữa test.
 */

const adminStatsMock = vi.fn();
const adminEconomyAlertsMock = vi.fn();
const adminEconomyReportMock = vi.fn();
const adminAuditLedgerMock = vi.fn();
const adminListUsersMock = vi.fn();
const adminListTopupsMock = vi.fn();
const adminListAuditMock = vi.fn();
const adminListGiftcodesMock = vi.fn();
const adminExportUsersCsvMock = vi.fn();
const adminRevokeGiftcodeMock = vi.fn();
const adminCreateGiftcodeMock = vi.fn();
const adminBanUserMock = vi.fn();
const adminSetRoleMock = vi.fn();
const adminGrantMock = vi.fn();
const adminRevokeInventoryMock = vi.fn();
const adminApproveTopupMock = vi.fn();
const adminRejectTopupMock = vi.fn();
const adminSpawnBossMock = vi.fn();

vi.mock('@/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@/api/admin')>('@/api/admin');
  return {
    ...actual,
    adminStats: (...a: unknown[]) => adminStatsMock(...a),
    adminEconomyAlerts: (...a: unknown[]) => adminEconomyAlertsMock(...a),
    adminEconomyReport: (...a: unknown[]) => adminEconomyReportMock(...a),
    adminAuditLedger: (...a: unknown[]) => adminAuditLedgerMock(...a),
    adminListUsers: (...a: unknown[]) => adminListUsersMock(...a),
    adminListTopups: (...a: unknown[]) => adminListTopupsMock(...a),
    adminListAudit: (...a: unknown[]) => adminListAuditMock(...a),
    adminListGiftcodes: (...a: unknown[]) => adminListGiftcodesMock(...a),
    adminExportUsersCsv: (...a: unknown[]) => adminExportUsersCsvMock(...a),
    adminRevokeGiftcode: (...a: unknown[]) => adminRevokeGiftcodeMock(...a),
    adminCreateGiftcode: (...a: unknown[]) => adminCreateGiftcodeMock(...a),
    adminBanUser: (...a: unknown[]) => adminBanUserMock(...a),
    adminSetRole: (...a: unknown[]) => adminSetRoleMock(...a),
    adminGrant: (...a: unknown[]) => adminGrantMock(...a),
    adminRevokeInventory: (...a: unknown[]) => adminRevokeInventoryMock(...a),
    adminApproveTopup: (...a: unknown[]) => adminApproveTopupMock(...a),
    adminRejectTopup: (...a: unknown[]) => adminRejectTopupMock(...a),
    adminSpawnBoss: (...a: unknown[]) => adminSpawnBossMock(...a),
  };
});

const getCurrentBossMock = vi.fn();
vi.mock('@/api/boss', () => ({
  getCurrentBoss: (...a: unknown[]) => getCurrentBossMock(...a),
}));

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

const toastPushMock = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ push: toastPushMock }),
}));

const authState = {
  isAuthenticated: true,
  hydrate: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}));

const gameState: {
  character: { role: 'ADMIN' | 'MOD' | 'PLAYER' | null } | null;
  bindSocket: ReturnType<typeof vi.fn>;
  fetchState: ReturnType<typeof vi.fn>;
} = {
  character: { role: 'ADMIN' },
  bindSocket: vi.fn(),
  fetchState: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/stores/game', () => ({
  useGameStore: () => gameState,
}));

vi.mock('@/components/shell/AppShell.vue', () => ({
  default: {
    name: 'AppShellStub',
    template: '<div data-testid="app-shell"><slot /></div>',
  },
}));

import AdminView from '@/views/AdminView.vue';

function makeStats(over: Partial<AdminStats> = {}): AdminStats {
  return {
    users: { total: 10, banned: 1, admins: 2 },
    characters: { total: 8, cultivating: 3, bySect: [] },
    economy: {
      linhThachCirculating: '1000',
      tienNgocCirculating: '500',
      topupPending: 0,
      topupApproved: 0,
      topupRejected: 0,
    },
    activity: { last24hLogins: 3, last7dRegistrations: 2 },
    ...over,
  };
}

function makeAlerts(over: Partial<AdminEconomyAlerts> = {}): AdminEconomyAlerts {
  return {
    negativeCurrency: [],
    negativeInventory: [],
    stalePendingTopups: [],
    staleHours: 24,
    generatedAt: '2026-04-30T08:00:00.000Z',
    ...over,
  };
}

function makeGiftcode(over: Partial<AdminGiftCodeRow> = {}): AdminGiftCodeRow {
  return {
    id: 'gc1',
    code: 'BETA2026',
    rewardLinhThach: '100',
    rewardTienNgoc: 10,
    rewardExp: '0',
    rewardItems: [],
    maxRedeems: 100,
    redeemCount: 5,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-04-30T00:00:00.000Z',
    ...over,
  };
}

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      common: {
        confirm: 'Đồng ý',
        cancel: 'Huỷ',
        loading: 'Đang tải…',
        refresh: 'Làm mới',
        search: 'Tìm',
        pagePrev: 'Trước',
        pageNext: 'Sau',
      },
      admin: {
        title: 'Quản Trị',
        roleLabel: 'Vai trò: {role}',
        tab: {
          stats: 'Tổng quan',
          users: 'Người dùng',
          topups: 'Đơn nạp',
          audit: 'Nhật ký',
          giftcodes: 'Giftcode',
          boss: 'Boss',
        },
        noPermission: 'Bạn không có quyền vào khu này.',
        stats: {
          users: 'Người dùng',
          characters: 'Nhân vật',
          economy: 'Kinh tế',
          activity: 'Hoạt động',
          total: 'Tổng',
          admins: 'Admin',
          banned: 'Bị khoá',
          cultivating: 'Đang tu luyện',
          bySect: 'Theo Tông Môn',
          linhThach: 'Linh Thạch',
          tienNgoc: 'Tiên Ngọc',
          topupPending: 'Topup chờ',
          topupApproved: 'Topup đã duyệt',
          topupRejected: 'Topup bị từ chối',
          last24hLogins: 'Login 24h',
          last7dRegistrations: 'Đăng ký 7d',
        },
        alerts: {
          title: 'Cảnh báo Kinh Tế',
          subtitle: 'Bất thường {hours}h',
          allClear: 'Tất cả ổn.',
          negativeCurrency: 'Currency âm',
          negativeInventory: 'Inventory âm',
          stalePendingTopups: 'Topup chờ quá hạn',
          badgeTooltip: '{count} cảnh báo',
        },
        ledgerAudit: {
          title: 'Audit',
          subtitle: 'sub',
          run: 'Chạy',
          running: 'Đang chạy…',
          scanned: 'Đã quét {chars}/{pairs}',
          clean: 'Sạch',
          fail: '{count} lỗi',
          currencyHeading: 'Currency',
          inventoryHeading: 'Inventory',
        },
        economyReport: {
          title: 'Báo cáo',
          subtitle: 'sub',
          run: 'Tạo',
          running: 'Đang tải…',
          linhThachTotal: 'LT',
          tienNgocTotal: 'TN',
          tienNgocKhoaTotal: 'TN khoá',
          characterCount: 'Nhân vật',
          cultivatingCount: 'Tu luyện',
          topLinhThach: 'Top LT',
          topTienNgoc: 'Top TN',
          empty: 'Chưa có',
          generatedAt: 'Tạo lúc',
        },
        recentActivity: {
          title: 'Hoạt động',
          subtitle: 'sub',
          loading: 'Đang tải…',
          empty: 'Chưa có',
          col: { time: 'Giờ', actor: 'Người', action: 'Hành động' },
        },
        users: {
          searchPlaceholder: 'Tìm…',
          exportCsvBtn: 'Xuất CSV',
          exportingLabel: 'Đang xuất…',
          exportedToast: 'Đã xuất {rows} dòng CSV.',
          exportTruncatedToast: 'Đã xuất {exported}/{total} dòng.',
          filter: {
            allRoles: 'Tất cả vai trò',
            allStatus: 'Tất cả trạng thái',
            active: 'Hoạt động',
            banned: 'Bị khoá',
            advanced: 'Bộ lọc nâng cao',
            linhThachMin: 'LT ≥',
            linhThachMax: 'LT ≤',
            tienNgocMin: 'TN ≥',
            tienNgocMax: 'TN ≤',
            realmKey: 'Cảnh giới',
          },
          col: {
            email: 'Email',
            name: 'Đạo Hiệu',
            realm: 'Cảnh giới',
            linhThach: 'LT',
            tienNgoc: 'TN',
            role: 'Vai trò',
            status: 'Trạng thái',
          },
          banned: 'BỊ KHOÁ',
          ok: 'OK',
          grantBtn: 'Cộng/Trừ',
          unlock: 'Mở',
          lock: 'Khoá',
          actionLock: 'Khoá',
          actionUnlock: 'Mở khoá',
          banConfirm: '{action} tài khoản {email}?',
          updatedToast: 'Đã cập nhật.',
          roleChangedToast: 'Đã đổi vai trò.',
          roleChangeConfirm: 'Đổi vai trò {email} → {role}?',
          grantedToast: 'Đã cộng/trừ tài sản.',
          grantTitle: 'Cộng/Trừ',
          grantLinh: 'LT',
          grantNgoc: 'TN',
          grantReason: 'Lý do',
          revokeBtn: 'Thu hồi item',
          revokeTitle: 'Thu hồi item',
          revokeHint: 'hint',
          revokeItemKey: 'Mã item',
          revokeQty: 'Số lượng',
          revokeReason: 'Lý do',
          revokeReasonPlaceholder: 'VD: grant nhầm',
          revokedToast: 'Đã thu hồi item.',
          revokeMissingItemKey: 'Vui lòng nhập mã item.',
          revokeInvalidQty: 'Số lượng phải 1..999.',
          selfBadge: 'Bạn',
          selfDemoteBlocked: 'Không thể tự thao tác.',
        },
        topups: {
          pendingBadgeTooltip: '{count} đơn nạp chờ',
          notePlaceholder: 'Ghi chú…',
          col: {
            code: 'Mã',
            user: 'Người',
            package: 'Gói',
            price: 'Tiền',
            tienNgoc: 'TN',
            status: 'Trạng thái',
            createdAt: 'Tạo lúc',
            note: 'Ghi chú',
          },
          approve: 'Duyệt',
          reject: 'Từ chối',
          filter: {
            PENDING: 'Chờ duyệt',
            APPROVED: 'Đã duyệt',
            REJECTED: 'Bị từ chối',
            from: 'Từ',
            to: 'Đến',
            emailPlaceholder: 'Email',
          },
        },
        audit: {
          filter: {
            actionPlaceholder: 'Hành động',
            emailPlaceholder: 'Email',
          },
          col: {
            time: 'Giờ',
            actor: 'Người',
            action: 'Hành động',
            target: 'Target',
            meta: 'Meta',
          },
        },
        giftcodes: {
          activeBadgeTooltip: '{count} giftcode đang hoạt động',
          filter: { qPlaceholder: 'Tìm mã…' },
          status: {
            ACTIVE: 'Hoạt động',
            REVOKED: 'Đã thu hồi',
            EXPIRED: 'Hết hạn',
            EXHAUSTED: 'Hết lượt',
          },
          col: {
            code: 'Mã',
            rewards: 'Phần thưởng',
            redeemed: 'Đã nhận',
            expiresAt: 'Hết hạn',
            status: 'Trạng thái',
            createdAt: 'Tạo lúc',
          },
          empty: 'Chưa có giftcode.',
          createBtn: '+ Tạo Giftcode',
          createTitle: 'Tạo Giftcode mới',
          create: {
            code: 'Mã',
            linhThach: 'LT',
            tienNgoc: 'TN',
            exp: 'EXP',
            maxRedeems: 'Số lượt',
            maxRedeemsPlaceholder: 'Bỏ trống',
            expiresDays: 'Hết hạn (ngày)',
            expiresDaysPlaceholder: 'Bỏ trống',
          },
          submitCreate: 'Tạo',
          creating: 'Đang tạo…',
          createdToast: 'Đã tạo.',
          revokeBtn: 'Thu hồi',
          revokeConfirm: 'Thu hồi {code}?',
          revokeModalTitle: 'Thu hồi mã {code}?',
          revokeModalUsage: 'Đã sử dụng: {usage}',
          revokeModalExpired: 'Mã đã hết hạn.',
          revokeModalExpiresSoon: 'Mã sắp hết hạn.',
          revokeModalWarning: 'Hành động không thể hoàn tác.',
          revokedToast: 'Đã thu hồi giftcode.',
          itemsLabel: 'vật phẩm',
        },
        boss: {
          title: 'Boss',
          hint: 'hint',
          bossKey: 'Boss key',
          level: 'Level',
          force: 'Force',
          currentlyActive: '{name} L{level}',
          spawned: '{name} L{level}',
          spawn: 'Spawn',
          spawning: 'Đang spawn…',
        },
        errors: {
          UNKNOWN: 'Có lỗi xảy ra.',
          UNAUTHENTICATED: 'Hết phiên.',
          FORBIDDEN: 'Không có quyền.',
          NOT_FOUND: 'Không tìm thấy.',
          CODE_NOT_FOUND: 'Không tìm thấy mã.',
          CODE_REVOKED: 'Mã đã thu hồi.',
        },
      },
    },
  },
});

let wrapper: ReturnType<typeof mount> | null = null;

function mountView() {
  wrapper = mount(AdminView, {
    attachTo: document.body,
    global: { plugins: [i18n] },
  });
  return wrapper;
}

describe('AdminView — onMounted routing + role guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate.mockReset();
    authState.hydrate.mockResolvedValue(undefined);
    gameState.character = { role: 'ADMIN' };
    gameState.fetchState.mockReset();
    gameState.fetchState.mockResolvedValue(undefined);
    gameState.bindSocket.mockReset();
    // Default happy-path resolutions — prevent unhandled rejection noise.
    adminStatsMock.mockResolvedValue(makeStats());
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 0 });
    adminListGiftcodesMock.mockResolvedValue([]);
    adminListAuditMock.mockResolvedValue({ rows: [], total: 0 });
    adminListUsersMock.mockResolvedValue({ rows: [], total: 0 });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('chưa auth → router.replace(/auth) + không gọi admin API', async () => {
    authState.isAuthenticated = false;
    mountView();
    await flushPromises();
    expect(routerReplaceMock).toHaveBeenCalledWith('/auth');
    expect(adminStatsMock).not.toHaveBeenCalled();
    expect(adminEconomyAlertsMock).not.toHaveBeenCalled();
  });

  it('PLAYER (không phải ADMIN/MOD) → toast error noPermission + router.replace(/home)', async () => {
    gameState.character = { role: 'PLAYER' };
    mountView();
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Bạn không có quyền vào khu này.',
    });
    expect(routerReplaceMock).toHaveBeenCalledWith('/home');
    expect(adminStatsMock).not.toHaveBeenCalled();
  });

  it('ADMIN onMounted → adminStats + adminEconomyAlerts + adminListTopups(PENDING,0) đều gọi', async () => {
    mountView();
    await flushPromises();
    expect(adminStatsMock).toHaveBeenCalledTimes(1);
    expect(adminEconomyAlertsMock).toHaveBeenCalledTimes(1);
    expect(adminListTopupsMock).toHaveBeenCalledWith('PENDING', 0);
  });

  it('MOD onMounted → cũng pass guard, adminStats được gọi', async () => {
    gameState.character = { role: 'MOD' };
    mountView();
    await flushPromises();
    expect(routerReplaceMock).not.toHaveBeenCalled();
    expect(adminStatsMock).toHaveBeenCalledTimes(1);
  });
});

describe('AdminView — tab badge rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate.mockReset();
    authState.hydrate.mockResolvedValue(undefined);
    gameState.character = { role: 'ADMIN' };
    gameState.fetchState.mockReset();
    gameState.fetchState.mockResolvedValue(undefined);
    gameState.bindSocket.mockReset();
    adminStatsMock.mockResolvedValue(makeStats());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 0 });
    adminListGiftcodesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('alertsCount > 0 → badge stats render số cảnh báo (tổng 3 loại)', async () => {
    adminEconomyAlertsMock.mockResolvedValue(
      makeAlerts({
        negativeCurrency: [
          {
            characterId: 'c1',
            name: 'Test',
            userEmail: 't@t.vn',
            linhThach: '-10',
            tienNgoc: 0,
            tienNgocKhoa: 0,
          },
        ],
        negativeInventory: [],
        stalePendingTopups: [],
      }),
    );
    const w = mountView();
    await flushPromises();
    const badge = w.find('[data-testid="admin-tab-stats-alerts-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('1');
  });

  it('alertsCount = 0 → KHÔNG render badge stats', async () => {
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="admin-tab-stats-alerts-badge"]').exists()).toBe(false);
  });

  it('pendingTopupCount > 0 → badge topups render số đơn chờ', async () => {
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 7 });
    const w = mountView();
    await flushPromises();
    const badge = w.find('[data-testid="admin-tab-topups-pending-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('7');
  });

  it('activeGiftcodeCount > 0 → badge giftcodes render số mã ACTIVE', async () => {
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListGiftcodesMock.mockResolvedValue([
      makeGiftcode({ code: 'A', redeemCount: 0, maxRedeems: 10 }),
      makeGiftcode({ code: 'B', redeemCount: 1, maxRedeems: 10 }),
      makeGiftcode({ code: 'C', revokedAt: '2026-04-30T00:00:00.000Z' }),
    ]);
    const w = mountView();
    await flushPromises();
    const badge = w.find('[data-testid="admin-tab-giftcodes-active-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('2');
  });
});

describe('AdminView — tab switch fetch calls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate.mockReset();
    authState.hydrate.mockResolvedValue(undefined);
    gameState.character = { role: 'ADMIN' };
    gameState.fetchState.mockReset();
    gameState.fetchState.mockResolvedValue(undefined);
    gameState.bindSocket.mockReset();
    adminStatsMock.mockResolvedValue(makeStats());
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 0 });
    adminListGiftcodesMock.mockResolvedValue([]);
    adminListUsersMock.mockResolvedValue({ rows: [], total: 0 });
    adminListAuditMock.mockResolvedValue({ rows: [], total: 0 });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('click tab Users → adminListUsers được gọi', async () => {
    const w = mountView();
    await flushPromises();
    const usersBtn = w.findAll('nav button').find((b) => b.text().startsWith('Người dùng'));
    expect(usersBtn).toBeTruthy();
    await usersBtn!.trigger('click');
    await flushPromises();
    expect(adminListUsersMock).toHaveBeenCalled();
  });

  it('click tab Audit → adminListAudit được gọi', async () => {
    const w = mountView();
    await flushPromises();
    const auditBtn = w.findAll('nav button').find((b) => b.text().startsWith('Nhật ký'));
    expect(auditBtn).toBeTruthy();
    await auditBtn!.trigger('click');
    await flushPromises();
    expect(adminListAuditMock).toHaveBeenCalled();
  });
});

describe('AdminView — Export CSV flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate.mockReset();
    authState.hydrate.mockResolvedValue(undefined);
    gameState.character = { role: 'ADMIN' };
    gameState.fetchState.mockReset();
    gameState.fetchState.mockResolvedValue(undefined);
    gameState.bindSocket.mockReset();
    adminStatsMock.mockResolvedValue(makeStats());
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 0 });
    adminListGiftcodesMock.mockResolvedValue([]);
    adminListUsersMock.mockResolvedValue({ rows: [], total: 0 });
    // jsdom không có URL.createObjectURL / revokeObjectURL → stub.
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('click Export CSV (tab Users) → adminExportUsersCsv + toast success khi không truncated', async () => {
    adminExportUsersCsvMock.mockResolvedValue({
      csv: 'email,name\nt@t.vn,Test\n',
      total: 1,
      rows: 1,
      truncated: false,
    });
    const w = mountView();
    await flushPromises();
    const usersBtn = w.findAll('nav button').find((b) => b.text().startsWith('Người dùng'));
    await usersBtn!.trigger('click');
    await flushPromises();
    const btn = w.find('[data-testid="admin-users-export-csv-btn"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    await flushPromises();
    expect(adminExportUsersCsvMock).toHaveBeenCalledTimes(1);
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã xuất 1 dòng CSV.',
    });
  });

  it('click Export CSV khi truncated=true → toast warning với exported/total', async () => {
    adminExportUsersCsvMock.mockResolvedValue({
      csv: 'email,name\n',
      total: 8000,
      rows: 5000,
      truncated: true,
    });
    const w = mountView();
    await flushPromises();
    const usersBtn = w.findAll('nav button').find((b) => b.text().startsWith('Người dùng'));
    await usersBtn!.trigger('click');
    await flushPromises();
    await w.find('[data-testid="admin-users-export-csv-btn"]').trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'warning',
      text: 'Đã xuất 5000/8000 dòng.',
    });
  });

  it('Export CSV error code UNAUTHENTICATED → toast error i18n admin.errors.UNAUTHENTICATED', async () => {
    adminExportUsersCsvMock.mockRejectedValue({ code: 'UNAUTHENTICATED' });
    const w = mountView();
    await flushPromises();
    const usersBtn = w.findAll('nav button').find((b) => b.text().startsWith('Người dùng'));
    await usersBtn!.trigger('click');
    await flushPromises();
    await w.find('[data-testid="admin-users-export-csv-btn"]').trigger('click');
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({ type: 'error', text: 'Hết phiên.' });
  });
});

describe('AdminView — Giftcode revoke ConfirmModal flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.hydrate.mockReset();
    authState.hydrate.mockResolvedValue(undefined);
    gameState.character = { role: 'ADMIN' };
    gameState.fetchState.mockReset();
    gameState.fetchState.mockResolvedValue(undefined);
    gameState.bindSocket.mockReset();
    adminStatsMock.mockResolvedValue(makeStats());
    adminEconomyAlertsMock.mockResolvedValue(makeAlerts());
    adminListTopupsMock.mockResolvedValue({ rows: [], total: 0 });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('click nút revoke trên row ACTIVE → ConfirmModal mở với title chứa code', async () => {
    adminListGiftcodesMock.mockResolvedValue([makeGiftcode({ code: 'BETA2026' })]);
    const w = mountView();
    await flushPromises();
    const giftBtn = w.findAll('nav button').find((b) => b.text().startsWith('Giftcode'));
    await giftBtn!.trigger('click');
    await flushPromises();
    const revokeBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="admin-giftcode-revoke-BETA2026"]',
    );
    expect(revokeBtn).not.toBeNull();
    revokeBtn!.click();
    await flushPromises();
    const modal = document.querySelector('[data-testid="admin-giftcode-revoke-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('BETA2026');
  });

  it('confirm revoke → adminRevokeGiftcode gọi + toast success + modal đóng + reload giftcodes', async () => {
    // 2 cuộc gọi đầu (refreshActiveGiftcodeCount onMounted + refreshGiftcodes khi click tab)
    // trả row ACTIVE; sau revoke thì refreshGiftcodes + refreshActiveGiftcodeCount lại gọi → [].
    adminListGiftcodesMock
      .mockResolvedValueOnce([makeGiftcode({ code: 'BETA2026' })])
      .mockResolvedValueOnce([makeGiftcode({ code: 'BETA2026' })])
      .mockResolvedValue([]);
    adminRevokeGiftcodeMock.mockResolvedValue(
      makeGiftcode({ code: 'BETA2026', revokedAt: '2026-04-30T10:00:00.000Z' }),
    );
    const w = mountView();
    await flushPromises();
    const giftBtn = w.findAll('nav button').find((b) => b.text().startsWith('Giftcode'));
    await giftBtn!.trigger('click');
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-BETA2026"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-modal-confirm"]')!
      .click();
    await flushPromises();
    expect(adminRevokeGiftcodeMock).toHaveBeenCalledWith('BETA2026');
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'success',
      text: 'Đã thu hồi giftcode.',
    });
    expect(document.querySelector('[data-testid="admin-giftcode-revoke-modal"]')).toBeNull();
    // Lần 1 gọi khi click tab Giftcode, lần 2 khi refreshGiftcodes() sau confirm.
    expect(adminListGiftcodesMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('cancel revoke → modal đóng, adminRevokeGiftcode KHÔNG gọi', async () => {
    adminListGiftcodesMock.mockResolvedValue([makeGiftcode({ code: 'BETA2026' })]);
    const w = mountView();
    await flushPromises();
    const giftBtn = w.findAll('nav button').find((b) => b.text().startsWith('Giftcode'));
    await giftBtn!.trigger('click');
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-BETA2026"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-modal-cancel"]')!
      .click();
    await flushPromises();
    expect(document.querySelector('[data-testid="admin-giftcode-revoke-modal"]')).toBeNull();
    expect(adminRevokeGiftcodeMock).not.toHaveBeenCalled();
  });

  it('confirm revoke lỗi CODE_REVOKED → toast error i18n admin.errors.CODE_REVOKED (không dùng handleErr UNKNOWN)', async () => {
    adminListGiftcodesMock.mockResolvedValue([makeGiftcode({ code: 'BETA2026' })]);
    adminRevokeGiftcodeMock.mockRejectedValue({ code: 'CODE_REVOKED' });
    const w = mountView();
    await flushPromises();
    const giftBtn = w.findAll('nav button').find((b) => b.text().startsWith('Giftcode'));
    await giftBtn!.trigger('click');
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-BETA2026"]')!
      .click();
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="admin-giftcode-revoke-modal-confirm"]')!
      .click();
    await flushPromises();
    expect(toastPushMock).toHaveBeenCalledWith({
      type: 'error',
      text: 'Mã đã thu hồi.',
    });
  });

  it('revoke mã EXPIRED hoặc đã REVOKED → không hiện nút revoke (dùng giftCodeStatusOf)', async () => {
    adminListGiftcodesMock.mockResolvedValue([
      makeGiftcode({ code: 'OLD1', revokedAt: '2026-04-30T00:00:00.000Z' }),
      makeGiftcode({ code: 'OLD2', expiresAt: '2020-01-01T00:00:00.000Z' }),
    ]);
    const w = mountView();
    await flushPromises();
    const giftBtn = w.findAll('nav button').find((b) => b.text().startsWith('Giftcode'));
    await giftBtn!.trigger('click');
    await flushPromises();
    expect(document.querySelector('[data-testid="admin-giftcode-revoke-OLD1"]')).toBeNull();
    expect(document.querySelector('[data-testid="admin-giftcode-revoke-OLD2"]')).toBeNull();
  });
});
