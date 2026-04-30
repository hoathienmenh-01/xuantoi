/**
 * Unit test AllExceptionsFilter — 86 dòng critical security filter (đảm bảo
 * không raw exception nào leak ra client raw, MỌI lỗi đều về envelope
 * `{ ok:false, error:{code, message} }`). Trước đây 0 test.
 *
 * Cover các nhánh:
 *   - HttpException với body đã là envelope ApiErrorBody → pass-through.
 *   - HttpException với body string → wrap envelope, code theo HTTP status.
 *   - HttpException với body object có `message` → dùng message, code theo status.
 *   - HttpException với body object không `message` → message fallback = code.
 *   - Status → code mapping (400/401/403/404/409/429/5xx/other).
 *   - Unknown Error (non-HttpException) → log error + 500 INTERNAL_ERROR.
 *   - Non-Error throw value (vd string, number) → vẫn 500 INTERNAL_ERROR.
 *
 * Dùng fake ArgumentsHost + fake Response — không cần NestJS app runtime.
 */
import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

let filter: AllExceptionsFilter;

beforeEach(() => {
  filter = new AllExceptionsFilter();
});

describe('AllExceptionsFilter — HttpException pass-through envelope', () => {
  it('pass-through khi body đã là ApiErrorBody { ok:false, error:{code,message} }', () => {
    const { host, status, json } = makeHost();
    const exc = new HttpException(
      { ok: false, error: { code: 'NO_CHARACTER', message: 'Chưa có nhân vật' } },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NO_CHARACTER', message: 'Chưa có nhân vật' },
    });
  });

  it('ApiErrorBody với custom status 409 — pass-through, status giữ nguyên', () => {
    const { host, status, json } = makeHost();
    const exc = new HttpException(
      { ok: false, error: { code: 'CONFLICT', message: 'Item tồn tại' } },
      HttpStatus.CONFLICT,
    );
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'CONFLICT', message: 'Item tồn tại' },
    });
  });
});

describe('AllExceptionsFilter — HttpException string body wrap envelope', () => {
  it('body string → wrap { ok:false, error:{code,message} }, code theo status', () => {
    const { host, status, json } = makeHost();
    const exc = new HttpException('Thiếu token', HttpStatus.UNAUTHORIZED);
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Thiếu token' },
    });
  });

  it('body object với `message` string → dùng message, code theo status', () => {
    const { host, status, json } = makeHost();
    // NestJS built-in BadRequestException có body { message, error, statusCode }.
    const exc = new BadRequestException('Validation failed');
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Validation failed' },
    });
  });

  it('body object không có `message` → message fallback = code', () => {
    const { host, status, json } = makeHost();
    const exc = new HttpException({ foo: 'bar' }, HttpStatus.FORBIDDEN);
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'FORBIDDEN' },
    });
  });

  it('NotFoundException (builtin) → code=NOT_FOUND, message từ exception', () => {
    const { host, status, json } = makeHost();
    const exc = new NotFoundException('User không tồn tại');
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User không tồn tại' },
    });
  });
});

describe('AllExceptionsFilter — status → code mapping', () => {
  const cases: Array<[number, string]> = [
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [503, 'INTERNAL_ERROR'],
    // Bất kỳ 4xx ngoài whitelist → BAD_REQUEST fallback.
    [418, 'BAD_REQUEST'],
    [422, 'BAD_REQUEST'],
  ];

  for (const [httpStatus, expectedCode] of cases) {
    it(`status ${httpStatus} → code=${expectedCode}`, () => {
      const { host, status, json } = makeHost();
      const exc = new HttpException('msg', httpStatus);
      filter.catch(exc, host);
      expect(status).toHaveBeenCalledWith(httpStatus);
      expect(json).toHaveBeenCalledWith({
        ok: false,
        error: { code: expectedCode, message: 'msg' },
      });
    });
  }
});

describe('AllExceptionsFilter — Unknown exception → 500 INTERNAL_ERROR (không leak stack)', () => {
  it('Error instance thường (non-HttpException) → 500 INTERNAL_ERROR, không leak message', () => {
    const { host, status, json } = makeHost();
    // Silence logger để khỏi in stack trace ra test output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exc = new Error('DB connection refused at 10.0.0.1:5432');
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0] as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    // Message không được chứa stack/IP/port → chỉ 'INTERNAL_ERROR' literal.
    expect(body.error.message).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('10.0.0.1');
    expect(body.error.message).not.toContain('refused');
    spy.mockRestore();
  });

  it('throw non-Error (string, number, object) → vẫn 500 INTERNAL_ERROR, không crash', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const thrown of ['raw string', 42, { weird: 'object' }, null, undefined]) {
      const { host, status, json } = makeHost();
      filter.catch(thrown, host);
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR' },
      });
    }
    spy.mockRestore();
  });

  it('TypeError với sensitive info trong message → client chỉ thấy INTERNAL_ERROR', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, status, json } = makeHost();
    const exc = new TypeError("Cannot read property 'password' of undefined at /app/src/auth.ts:42");
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0] as { error: { message: string } };
    expect(body.error.message).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('password');
    expect(body.error.message).not.toContain('/app');
    spy.mockRestore();
  });
});

describe('AllExceptionsFilter — envelope shape đầy đủ', () => {
  it('mọi response phải có shape { ok:false, error:{code:string, message:string} } — không thêm field lạ', () => {
    const { host, json } = makeHost();
    const exc = new HttpException('test', 400);
    filter.catch(exc, host);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['error', 'ok']);
    const error = body.error as Record<string, unknown>;
    expect(Object.keys(error).sort()).toEqual(['code', 'message']);
    expect(typeof error.code).toBe('string');
    expect(typeof error.message).toBe('string');
  });
});
