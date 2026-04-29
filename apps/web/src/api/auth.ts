import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
  if (!data.ok) throw data.error ?? new Error('Gửi yêu cầu thất bại');
  return { ok: !!data.data?.ok, devToken: data.data?.devToken ?? null };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const { data } = await apiClient.post<AuthEnvelope<{ ok: true }>>(
    '/_auth/reset-password',
    input,
  );
  if (!data.ok) throw data.error ?? new Error('Đặt lại mật khẩu thất bại');
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
