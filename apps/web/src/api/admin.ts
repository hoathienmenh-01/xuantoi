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

export async function adminListUsers(q: string, page: number): Promise<Page<AdminUserRow>> {
  const { data } = await apiClient.get<Envelope<Page<AdminUserRow>>>('/admin/users', {
    params: { q, page },
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | '' ,
  page: number,
): Promise<Page<TopupOrderView & { userEmail: string }>> {
  const { data } = await apiClient.get<Envelope<Page<TopupOrderView & { userEmail: string }>>>(
    '/admin/topups',
    { params: status ? { status, page } : { page } },
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

export async function adminListAudit(page: number): Promise<Page<AdminAuditRow>> {
  const { data } = await apiClient.get<Envelope<Page<AdminAuditRow>>>('/admin/audit', {
    params: { page },
  });
  return unwrap(data);
}
