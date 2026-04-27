import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  PublicUser,
} from '@xuantoi/shared';
import { apiClient } from './client';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function unwrap<T>(env: ApiEnvelope<T>, fallback: string): T {
  if (env.ok && env.data) return env.data;
  const err = env.error ?? { code: 'UNKNOWN', message: fallback };
  const e = new Error(err.message) as Error & { code?: string };
  e.code = err.code;
  throw e;
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const { data } = await apiClient.post<ApiEnvelope<{ user: PublicUser }>>(
    '/_auth/register',
    input,
  );
  return unwrap(data, 'Đăng ký thất bại').user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const { data } = await apiClient.post<ApiEnvelope<{ user: PublicUser }>>(
    '/_auth/login',
    input,
  );
  return unwrap(data, 'Đăng nhập thất bại').user;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const { data } = await apiClient.post<ApiEnvelope<{ ok: true }>>(
    '/_auth/change-password',
    input,
  );
  unwrap(data, 'Đổi mật khẩu thất bại');
}

export async function logout(): Promise<void> {
  await apiClient.post('/_auth/logout');
}

export async function refresh(): Promise<PublicUser | null> {
  try {
    const { data } = await apiClient.post<ApiEnvelope<{ user: PublicUser }>>('/_auth/refresh');
    return data.ok && data.data ? data.data.user : null;
  } catch {
    return null;
  }
}

export async function session(): Promise<PublicUser | null> {
  try {
    const { data } = await apiClient.get<ApiEnvelope<{ user: PublicUser }>>('/_auth/session');
    return data.ok && data.data ? data.data.user : null;
  } catch {
    return null;
  }
}
