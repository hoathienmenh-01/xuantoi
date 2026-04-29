import { apiClient } from './client';
import type { TopupOrderView } from './topup';

export type Role = 'PLAYER' | 'MOD' | 'ADMIN';

export interface AdminUserRow {
  id: string;
  email: string;
  role: Role;
  banned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  character: {
    id: string;
    name: string;
    realmKey: string;
    realmStage: number;
    linhThach: string;
    tienNgoc: number;
  } | null;
}

export interface AdminAuditRow {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  meta: unknown;
  createdAt: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function unwrap<T>(env: Envelope<T>): T {
  if (!env.ok || !env.data) {
    const err = env.error ?? { code: 'UNKNOWN', message: 'UNKNOWN' };
    throw Object.assign(new Error(err.message), { code: err.code });
  }
  return env.data;
}

interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function adminListUsers(
  q: string,
  page: number,
  filters: { role?: Role; banned?: boolean } = {},
): Promise<Page<AdminUserRow>> {
  const params: Record<string, string | number> = { q, page };
  if (filters.role) params.role = filters.role;
  if (filters.banned !== undefined) params.banned = filters.banned ? 'true' : 'false';
  const { data } = await apiClient.get<Envelope<Page<AdminUserRow>>>('/admin/users', {
    params,
  });
  return unwrap(data);
}

export async function adminBanUser(id: string, banned: boolean): Promise<void> {
  const { data } = await apiClient.post<Envelope<{ ok: true }>>(
    `/admin/users/${encodeURIComponent(id)}/ban`,
    { banned },
  );
  unwrap(data);
}

export async function adminSetRole(id: string, role: Role): Promise<void> {
  const { data } = await apiClient.post<Envelope<{ ok: true }>>(
    `/admin/users/${encodeURIComponent(id)}/role`,
    { role },
  );
  unwrap(data);
}

export async function adminGrant(
  id: string,
  linhThach: string,
  tienNgoc: number,
  reason: string,
): Promise<void> {
  const { data } = await apiClient.post<Envelope<{ ok: true }>>(
    `/admin/users/${encodeURIComponent(id)}/grant`,
    { linhThach, tienNgoc, reason },
  );
  unwrap(data);
}

export async function adminListTopups(
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | '',
  page: number,
  filters: { from?: string; to?: string; email?: string } = {},
): Promise<Page<TopupOrderView & { userEmail: string }>> {
  const params: Record<string, string | number> = { page };
  if (status) params.status = status;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.email) params.email = filters.email;
  const { data } = await apiClient.get<Envelope<Page<TopupOrderView & { userEmail: string }>>>(
    '/admin/topups',
    { params },
  );
  return unwrap(data);
}

export async function adminApproveTopup(id: string, note: string): Promise<void> {
  const { data } = await apiClient.post<Envelope<{ ok: true }>>(
    `/admin/topups/${encodeURIComponent(id)}/approve`,
    { note },
  );
  unwrap(data);
}

export async function adminRejectTopup(id: string, note: string): Promise<void> {
  const { data } = await apiClient.post<Envelope<{ ok: true }>>(
    `/admin/topups/${encodeURIComponent(id)}/reject`,
    { note },
  );
  unwrap(data);
}

export async function adminListAudit(
  page: number,
  filters: { action?: string; email?: string } = {},
): Promise<Page<AdminAuditRow>> {
  const params: Record<string, string | number> = { page };
  if (filters.action) params.action = filters.action;
  if (filters.email) params.email = filters.email;
  const { data } = await apiClient.get<Envelope<Page<AdminAuditRow>>>('/admin/audit', {
    params,
  });
  return unwrap(data);
}

export interface AdminStats {
  users: { total: number; banned: number; admins: number };
  characters: {
    total: number;
    cultivating: number;
    bySect: { sectId: string | null; name: string; count: number }[];
  };
  economy: {
    linhThachCirculating: string;
    tienNgocCirculating: string;
    topupPending: number;
    topupApproved: number;
    topupRejected: number;
  };
  activity: {
    last24hLogins: number;
    last7dRegistrations: number;
  };
}

export async function adminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<Envelope<AdminStats>>('/admin/stats');
  return unwrap(data);
}

export interface AdminEconomyAlerts {
  negativeCurrency: {
    characterId: string;
    name: string;
    userEmail: string;
    linhThach: string;
    tienNgoc: number;
    tienNgocKhoa: number;
  }[];
  negativeInventory: {
    inventoryItemId: string;
    characterId: string;
    characterName: string;
    itemKey: string;
    qty: number;
  }[];
  stalePendingTopups: {
    id: string;
    userEmail: string;
    packageKey: string;
    tienNgocAmount: number;
    createdAt: string;
    ageHours: number;
  }[];
  staleHours: number;
  generatedAt: string;
}

export async function adminEconomyAlerts(staleHours = 24): Promise<AdminEconomyAlerts> {
  const { data } = await apiClient.get<Envelope<AdminEconomyAlerts>>('/admin/economy/alerts', {
    params: { staleHours },
  });
  return unwrap(data);
}

export interface AdminBossSpawnInput {
  bossKey?: string;
  level?: number;
  force?: boolean;
}

export interface AdminBossSpawnResult {
  id: string;
  bossKey: string;
  level: number;
  maxHp: string;
}

export async function adminSpawnBoss(
  input: AdminBossSpawnInput,
): Promise<AdminBossSpawnResult> {
  const { data } = await apiClient.post<Envelope<AdminBossSpawnResult>>(
    '/boss/admin/spawn',
    input,
  );
  return unwrap(data);
}

export type GiftCodeStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED';

export interface AdminGiftCodeRewardItem {
  itemKey: string;
  qty: number;
}

export interface AdminGiftCodeRow {
  id: string;
  code: string;
  rewardLinhThach: string;
  rewardTienNgoc: number;
  rewardExp: string;
  rewardItems: AdminGiftCodeRewardItem[];
  maxRedeems: number | null;
  redeemCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminGiftCreateInput {
  code: string;
  rewardLinhThach?: string;
  rewardTienNgoc?: number;
  rewardExp?: string;
  rewardItems?: AdminGiftCodeRewardItem[];
  maxRedeems?: number;
  expiresAt?: string;
}

export async function adminListGiftcodes(
  filters: { q?: string; status?: GiftCodeStatus | '' } = {},
  limit = 100,
): Promise<AdminGiftCodeRow[]> {
  const params: Record<string, string | number> = { limit };
  if (filters.q) params.q = filters.q;
  if (filters.status) params.status = filters.status;
  const { data } = await apiClient.get<Envelope<{ codes: AdminGiftCodeRow[] }>>(
    '/admin/giftcodes',
    { params },
  );
  return unwrap(data).codes;
}

export async function adminCreateGiftcode(
  input: AdminGiftCreateInput,
): Promise<AdminGiftCodeRow> {
  const { data } = await apiClient.post<Envelope<{ code: AdminGiftCodeRow }>>(
    '/admin/giftcodes',
    input,
  );
  return unwrap(data).code;
}

export async function adminRevokeGiftcode(code: string): Promise<AdminGiftCodeRow> {
  const { data } = await apiClient.post<Envelope<{ code: AdminGiftCodeRow }>>(
    `/admin/giftcodes/${encodeURIComponent(code)}/revoke`,
    {},
  );
  return unwrap(data).code;
}

/**
 * Compute display status từ row fields. Mirror BE logic — `revokedAt` thắng,
 * sau đó `expiresAt < now` → EXPIRED, sau đó `redeemCount >= maxRedeems` → EXHAUSTED,
 * còn lại ACTIVE.
 */
export function giftCodeStatusOf(row: AdminGiftCodeRow, now = new Date()): GiftCodeStatus {
  if (row.revokedAt) return 'REVOKED';
  if (row.expiresAt && new Date(row.expiresAt).getTime() < now.getTime()) return 'EXPIRED';
  if (row.maxRedeems !== null && row.redeemCount >= row.maxRedeems) return 'EXHAUSTED';
  return 'ACTIVE';
}
