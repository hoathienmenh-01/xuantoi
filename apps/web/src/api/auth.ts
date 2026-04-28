import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  PublicUser,
} from '@xuantoi/shared';
import { apiClient } from './client';

interface AuthEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const { data } = await apiClient.post<AuthEnvelope<{ user: PublicUser }>>(
    '/_auth/register',
    input,
  );
  if (!data.ok || !data.data) throw data.error ?? new Error('Đăng ký thất bại');
  return data.data.user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const { data } = await apiClient.post<AuthEnvelope<{ user: PublicUser }>>(
    '/_auth/login',
    input,
  );
  if (!data.ok || !data.data) throw data.error ?? new Error('Đăng nhập thất bại');
  return data.data.user;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const { data } = await apiClient.post<AuthEnvelope<{ ok: true }>>(
    '/_auth/change-password',
    input,
  );
  if (!data.ok) throw data.error ?? new Error('Đổi mật khẩu thất bại');
}

export async function logout(): Promise<void> {
  await apiClient.post('/_auth/logout');
}

export async function logoutAll(): Promise<{ revoked: number }> {
  const { data } = await apiClient.post<AuthEnvelope<{ revoked: number }>>(
    '/_auth/logout-all',
  );
  if (!data.ok || !data.data) throw data.error ?? new Error('Logout all thất bại');
  return data.data;
}

export async function refresh(): Promise<PublicUser | null> {
  try {
    const { data } = await apiClient.post<AuthEnvelope<{ user: PublicUser }>>(
      '/_auth/refresh',
    );
    return data.ok && data.data ? data.data.user : null;
  } catch {
    return null;
  }
}

export async function session(): Promise<PublicUser | null> {
  try {
    const { data } = await apiClient.get<AuthEnvelope<{ user: PublicUser }>>('/_auth/session');
    return data.ok && data.data ? data.data.user : null;
  } catch {
    return null;
  }
}
