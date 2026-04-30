import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  formatUserCsvRow,
  formatUsersCsv,
  USER_CSV_HEADER,
  type UserCsvRow,
} from './user-csv';

function makeRow(overrides: Partial<UserCsvRow> = {}): UserCsvRow {
  return {
    id: 'u1',
    email: 'a@x.com',
    role: 'PLAYER',
    banned: false,
    createdAt: '2026-04-30T00:00:00.000Z',
    lastLoginAt: '2026-04-30T01:00:00.000Z',
    character: {
      id: 'c1',
      name: 'Alice',
      realmKey: 'lien_khi',
      realmStage: 3,
      linhThach: '12345',
      tienNgoc: 100,
    },
    ...overrides,
  };
}

describe('escapeCsvField', () => {
  it('passes plain string through unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('passes numbers and booleans as string', () => {
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(true)).toBe('true');
    expect(escapeCsvField(false)).toBe('false');
  });

  it('returns empty for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes field containing comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('escapes embedded double-quote by doubling', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes field containing newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('quotes field with leading/trailing whitespace', () => {
    expect(escapeCsvField(' lead')).toBe('" lead"');
    expect(escapeCsvField('trail ')).toBe('"trail "');
  });
});

describe('formatUserCsvRow', () => {
  it('formats row with character', () => {
    const line = formatUserCsvRow(makeRow());
    expect(line).toBe(
      'u1,a@x.com,PLAYER,false,2026-04-30T00:00:00.000Z,2026-04-30T01:00:00.000Z,c1,Alice,lien_khi,3,12345,100',
    );
  });

  it('leaves character columns empty when character is null', () => {
    const line = formatUserCsvRow(
      makeRow({ character: null, lastLoginAt: null }),
    );
    expect(line).toBe('u1,a@x.com,PLAYER,false,2026-04-30T00:00:00.000Z,,,,,,,');
  });

  it('escapes character name containing comma + quote', () => {
    const line = formatUserCsvRow(
      makeRow({
        character: {
          id: 'c1',
          name: 'Tu, "Tiên" 1',
          realmKey: 'lien_khi',
          realmStage: 1,
          linhThach: '0',
          tienNgoc: 0,
        },
      }),
    );
    expect(line).toContain('"Tu, ""Tiên"" 1"');
  });

  it('escapes email containing special characters (defensive)', () => {
    const line = formatUserCsvRow(makeRow({ email: 'weird"name@x.com' }));
    expect(line).toContain('"weird""name@x.com"');
  });
});

describe('formatUsersCsv', () => {
  it('returns header-only CSV when rows empty', () => {
    expect(formatUsersCsv([])).toBe(USER_CSV_HEADER.join(',') + '\r\n');
  });

  it('joins header + rows with CRLF and trailing CRLF', () => {
    const csv = formatUsersCsv([makeRow(), makeRow({ id: 'u2', email: 'b@x.com' })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(USER_CSV_HEADER.join(','));
    expect(lines[1]).toContain('u1');
    expect(lines[2]).toContain('u2');
    // CRLF after last row → split produces empty trailing element
    expect(lines[lines.length - 1]).toBe('');
  });

  it('header contains all 12 expected columns in fixed order', () => {
    expect(USER_CSV_HEADER).toEqual([
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
    ]);
  });

  it('handles rows with both null character and special chars in email', () => {
    const csv = formatUsersCsv([
      makeRow({ id: 'u1', email: 'a,b@x.com', character: null, lastLoginAt: null }),
    ]);
    expect(csv).toContain('"a,b@x.com"');
    expect(csv).toContain('u1,"a,b@x.com",PLAYER,false');
  });
});
