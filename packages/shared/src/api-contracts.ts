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

/** Map mã lỗi → text Việt (dùng FE). */
export const AUTH_ERROR_VI: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Danh hiệu hoặc huyền pháp không chính xác.',
  EMAIL_TAKEN: 'Danh hiệu đạo đồ đã được khai lập hoặc dữ liệu không hợp lệ.',
  WEAK_PASSWORD: 'Huyền pháp quá yếu.',
  OLD_PASSWORD_WRONG: 'Huyền pháp cũ không đúng hoặc không tìm thấy tài khoản.',
  RATE_LIMITED: 'Đã thử quá nhiều lần. Đạo hữu vui lòng thử lại sau.',
  UNAUTHENTICATED: 'Phiên đã hết. Mời đạo hữu nhập định lại.',
};

/* ---------------- character ---------------- */

export const CharacterName = z
  .string()
  .trim()
  .min(3, 'Tên đạo đồ tối thiểu 3 ký tự')
  .max(20, 'Tên đạo đồ tối đa 20 ký tự');

export const CreateCharacterInput = z.object({
  name: CharacterName,
});
export type CreateCharacterInput = z.infer<typeof CreateCharacterInput>;

export const PublicCharacter = z.object({
  id: z.string(),
  name: z.string(),
  realmKey: z.string(),
  realmStage: z.number().int(),
  realmName: z.string(),
  stageName: z.string(),
  exp: z.string(), // BigInt as string
  expToBreakthrough: z.string(), // 0 = đã đỉnh
  cultivating: z.boolean(),
  cultivationStartedAt: z.string().nullable(),
  expPerSec: z.number(),

  hp: z.number().int(),
  hpMax: z.number().int(),
  mp: z.number().int(),
  mpMax: z.number().int(),
  stamina: z.number().int(),
  staminaMax: z.number().int(),
  power: z.number().int(),
  spirit: z.number().int(),
  speed: z.number().int(),
  luck: z.number().int(),

  linhThach: z.string(),
  tienNgoc: z.number().int(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PublicCharacter = z.infer<typeof PublicCharacter>;

export const CharacterErrorCode = z.enum([
  'CHAR_ALREADY_EXISTS',
  'CHAR_NAME_TAKEN',
  'CHAR_NOT_FOUND',
  'NOT_ENOUGH_EXP',
  'ALREADY_AT_PEAK',
  'NOT_CULTIVATING',
  'ALREADY_CULTIVATING',
]);
export type CharacterErrorCode = z.infer<typeof CharacterErrorCode>;

export const CHARACTER_ERROR_VI: Record<CharacterErrorCode, string> = {
  CHAR_ALREADY_EXISTS: 'Đạo hữu đã có nhân vật, không thể tạo thêm.',
  CHAR_NAME_TAKEN: 'Tên đạo đồ đã có người dùng, mời chọn tên khác.',
  CHAR_NOT_FOUND: 'Chưa có nhân vật. Mời khai mở đạo đồ trước.',
  NOT_ENOUGH_EXP: 'Tu vi chưa đủ để đột phá.',
  ALREADY_AT_PEAK: 'Đã tới đỉnh phong, không thể đột phá tiếp.',
  NOT_CULTIVATING: 'Đạo hữu không ở trong trạng thái tu luyện.',
  ALREADY_CULTIVATING: 'Đạo hữu đã đang tu luyện.',
};

/* ---------------- game log ---------------- */

export const GameLogType = z.enum(['info', 'success', 'warning', 'error', 'system']);
export type GameLogType = z.infer<typeof GameLogType>;

export const PublicGameLog = z.object({
  id: z.string(),
  type: GameLogType,
  text: z.string(),
  createdAt: z.string(),
});
export type PublicGameLog = z.infer<typeof PublicGameLog>;
