import { z } from 'zod';

/* ---------------- generic envelope ---------------- */

export const ApiOk = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ ok: z.literal(true), data: schema });

export const ApiErr = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiEnvelope<T> = { ok: true; data: T } | z.infer<typeof ApiErr>;

/* ---------------- auth ---------------- */

export const Email = z.string().email();
export const Password = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải có chữ')
  .regex(/[0-9]/, 'Mật khẩu phải có số');

export const RegisterInput = z.object({
  email: Email,
  password: Password,
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1),
  rememberEmail: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ChangePasswordInput = z.object({
  oldPassword: z.string().min(1),
  newPassword: Password,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const PublicUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['PLAYER', 'MOD', 'ADMIN']),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof PublicUser>;

export const AuthErrorCode = z.enum([
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'WEAK_PASSWORD',
  'OLD_PASSWORD_WRONG',
  'RATE_LIMITED',
  'UNAUTHENTICATED',
]);
export type AuthErrorCode = z.infer<typeof AuthErrorCode>;

/** Map mã lỗi → text Việt (dùng FE). File 02 §3 + file 04 §4.1. */
export const AUTH_ERROR_VI: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Danh hiệu hoặc huyền pháp không chính xác.',
  EMAIL_TAKEN: 'Danh hiệu đạo đồ đã được khai lập hoặc dữ liệu không hợp lệ.',
  WEAK_PASSWORD: 'Huyền pháp quá yếu.',
  OLD_PASSWORD_WRONG: 'Huyền pháp cũ không đúng hoặc không tìm thấy tài khoản.',
  RATE_LIMITED: 'Đã thử quá nhiều lần. Đạo hữu vui lòng thử lại sau.',
  UNAUTHENTICATED: 'Phiên đã hết. Mời đạo hữu nhập định lại.',
};
