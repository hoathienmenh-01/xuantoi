/**
 * Smart admin user export CSV (session 9i task E).
 *
 * Pure helper format — không phụ thuộc Prisma/Nest, dễ test. CSV format theo
 * RFC 4180:
 * - Field bao quanh `"` nếu chứa `,`, `"`, hoặc `\n`.
 * - `"` trong field được escape bằng `""`.
 * - Mỗi row kết thúc bằng `\r\n`.
 * - Không thêm BOM (caller có thể prepend `\ufeff` nếu cần Excel UTF-8).
 *
 * Columns (cố định, ưu tiên field admin cần khi audit/triage):
 *   id, email, role, banned, createdAt, lastLoginAt, characterId,
 *   characterName, realmKey, realmStage, linhThach, tienNgoc
 */

export interface UserCsvRow {
  id: string;
  email: string;
  role: string;
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

export const USER_CSV_HEADER = [
  'id',
  'email',
  'role',
  'banned',
  'createdAt',
  'lastLoginAt',
  'characterId',
  'characterName',
  'realmKey',
  'realmStage',
  'linhThach',
  'tienNgoc',
] as const;

/**
 * Escape 1 field theo RFC 4180. Trả về raw string nếu không cần quote, hoặc
 * `"...""..."` nếu chứa special char.
 */
export function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Nếu chứa `,`, `"`, `\n`, `\r`, hoặc bắt đầu/kết thúc bằng space → quote.
  if (/[",\r\n]/.test(s) || s !== s.trim()) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Format 1 row thành CSV line (không kèm trailing CRLF).
 */
export function formatUserCsvRow(row: UserCsvRow): string {
  const c = row.character;
  const fields: (string | number | boolean | null)[] = [
    row.id,
    row.email,
    row.role,
    row.banned,
    row.createdAt,
    row.lastLoginAt ?? '',
    c ? c.id : '',
    c ? c.name : '',
    c ? c.realmKey : '',
    c ? c.realmStage : '',
    c ? c.linhThach : '',
    c ? c.tienNgoc : '',
  ];
  return fields.map(escapeCsvField).join(',');
}

/**
 * Format toàn bộ CSV: header + rows + CRLF separators.
 */
export function formatUsersCsv(rows: UserCsvRow[]): string {
  const header = USER_CSV_HEADER.join(',');
  const body = rows.map(formatUserCsvRow);
  return [header, ...body].join('\r\n') + '\r\n';
}
