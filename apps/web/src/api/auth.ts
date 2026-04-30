import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  PublicUser,
} from '@xuantoi/shared';
import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Resolve fallback Error message qua i18n key `common.apiFallback.<op>`.
 * Áp dụng cho trường hợp BE trả `{ ok: false }` mà không có `data.error`
 * (defensive — BE đúng convention luôn có `error.code/message`). Trước đây
 * hard-code VN nên en locale vẫn thấy VN khi gặp envelope malformed.
 */
function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

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
  if (!data.ok || !data.data) throw data.error ?? fallbackError('register');
  return data.data.user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const { data } = await apiClient.post<AuthEnvelope<{ user: PublicUser }>>(
    '/_auth/login',
    input,
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('login');
  return data.data.user;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const { data } = await apiClient.post<AuthEnvelope<{ ok: true }>>(
    '/_auth/change-password',
    input,
  );
  if (!data.ok) throw data.error ?? fallbackError('changePassword');
}

/**
 * Forgot-password: BE luôn trả `{ ok: true }` dù email tồn tại hay không
 * (chống user enumeration). Trong dev (`NODE_ENV !== 'production'`) BE trả
 * thêm `devToken` để E2E test có thể auto-fill — production sẽ là `null`.
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<{ ok: boolean; devToken: string | null }> {
  const { data } = await apiClient.post<AuthEnvelope<{ ok: boolean; devToken?: string | null }>>(
    '/_auth/forgot-password',
    input,
  );
  if (!data.ok) throw data.error ?? fallbackError('forgotPassword');
  return { ok: !!data.data?.ok, devToken: data.data?.devToken ?? null };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const { data } = await apiClient.post<AuthEnvelope<{ ok: true }>>(
    '/_auth/reset-password',
    input,
  );
  if (!data.ok) throw data.error ?? fallbackError('resetPassword');
}

export async function logout(): Promise<void> {
  await apiClient.post('/_auth/logout');
}

export async function logoutAll(): Promise<{ revoked: number }> {
  const { data } = await apiClient.post<AuthEnvelope<{ revoked: number }>>(
    '/_auth/logout-all',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('logoutAll');
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
