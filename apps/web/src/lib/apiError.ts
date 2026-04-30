/**
 * Pure helpers cho việc trích xuất error code từ exception trả ra bởi
 * `apiClient` (axios + Envelope wrapper) hoặc bởi store/composable code.
 *
 * Lý do tồn tại: codebase web hiện có 18+ chỗ lặp lại pattern
 * `(e as { code?: string }).code ?? 'FALLBACK'`. Helper này tập trung pattern
 * + xử lý các shape khác nhau (Envelope `{ code }`, axios error
 * `error.response.data.code`, plain `Error`, network error không có response,
 * non-object thrown values như string/number).
 *
 * Tách helper sang `lib/` để test thuần không phụ thuộc Vue/Pinia/i18n và để
 * có thể tái sử dụng từ các view khác.
 */

/**
 * Đọc trường `code: string` từ một giá trị unknown một cách an toàn.
 *
 * Trả về `undefined` nếu:
 * - input null/undefined/primitive (string/number/bool)
 * - input là object nhưng không có field `code`
 * - field `code` tồn tại nhưng không phải string
 * - field `code` là string rỗng
 *
 * Trả về `code` nếu là string non-empty.
 */
export function extractApiErrorCode(err: unknown): string | undefined {
  if (err === null || err === undefined) return undefined;
  if (typeof err !== 'object') return undefined;

  // Layer 1: trực tiếp trên err (đa số các store ném `Object.assign(new Error(msg), { code })`).
  const direct = readStringField(err, 'code');
  if (direct !== undefined) return direct;

  // Layer 2: axios error với response.data.code.
  const response = readObjectField(err, 'response');
  if (response) {
    const data = readObjectField(response, 'data');
    if (data) {
      const fromData = readStringField(data, 'code');
      if (fromData !== undefined) return fromData;
    }
  }

  // Layer 3: nested `cause` (ES2022 Error.cause) hoặc `original`.
  const cause = readObjectField(err, 'cause') ?? readObjectField(err, 'original');
  if (cause) {
    const fromCause = readStringField(cause, 'code');
    if (fromCause !== undefined) return fromCause;
  }

  return undefined;
}

/**
 * Lấy code với fallback default — pattern thường dùng nhất:
 *
 * ```ts
 * showError(extractApiErrorCodeOrDefault(e, 'INVALID_CREDENTIALS'));
 * ```
 */
export function extractApiErrorCodeOrDefault(
  err: unknown,
  fallback: string,
): string {
  return extractApiErrorCode(err) ?? fallback;
}

function readStringField(obj: object, key: string): string | undefined {
  const record = obj as Record<string, unknown>;
  const v = record[key];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function readObjectField(obj: object, key: string): object | undefined {
  const record = obj as Record<string, unknown>;
  const v = record[key];
  if (v !== null && typeof v === 'object') return v as object;
  return undefined;
}
