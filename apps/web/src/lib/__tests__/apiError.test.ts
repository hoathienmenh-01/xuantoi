import { describe, it, expect } from 'vitest';
import { extractApiErrorCode, extractApiErrorCodeOrDefault } from '@/lib/apiError';

describe('extractApiErrorCode', () => {
  it('object có field `code` string non-empty ⇒ trả về code', () => {
    expect(extractApiErrorCode({ code: 'NOT_FOUND' })).toBe('NOT_FOUND');
  });

  it('Error instance với code attached ⇒ trả về code', () => {
    const err = Object.assign(new Error('boom'), { code: 'INVALID_INPUT' });
    expect(extractApiErrorCode(err)).toBe('INVALID_INPUT');
  });

  it('axios-style error: error.response.data.code ⇒ trả về code', () => {
    const axiosErr = {
      message: 'Request failed with status code 400',
      response: { status: 400, data: { code: 'BAD_PAYLOAD' } },
    };
    expect(extractApiErrorCode(axiosErr)).toBe('BAD_PAYLOAD');
  });

  it('axios-style: ưu tiên direct.code nếu có cả 2 (trường hợp store đã unwrap)', () => {
    const err = {
      code: 'TOP_LEVEL',
      response: { data: { code: 'NESTED' } },
    };
    expect(extractApiErrorCode(err)).toBe('TOP_LEVEL');
  });

  it('error có `cause` chain (ES2022) ⇒ extract từ cause', () => {
    const err = {
      message: 'wrapper',
      cause: { code: 'DEEP_CAUSE' },
    };
    expect(extractApiErrorCode(err)).toBe('DEEP_CAUSE');
  });

  it('error với `original` field ⇒ extract từ original (legacy interceptor pattern)', () => {
    const err = { original: { code: 'LEGACY_CAUSE' } };
    expect(extractApiErrorCode(err)).toBe('LEGACY_CAUSE');
  });

  it('null / undefined ⇒ undefined', () => {
    expect(extractApiErrorCode(null)).toBeUndefined();
    expect(extractApiErrorCode(undefined)).toBeUndefined();
  });

  it('primitive (string / number / boolean) ⇒ undefined', () => {
    expect(extractApiErrorCode('NOT_FOUND')).toBeUndefined();
    expect(extractApiErrorCode(404)).toBeUndefined();
    expect(extractApiErrorCode(true)).toBeUndefined();
  });

  it('object không có field code ⇒ undefined', () => {
    expect(extractApiErrorCode({ message: 'no code here' })).toBeUndefined();
    expect(extractApiErrorCode({})).toBeUndefined();
  });

  it('field code không phải string (số / object) ⇒ undefined', () => {
    expect(extractApiErrorCode({ code: 42 })).toBeUndefined();
    expect(extractApiErrorCode({ code: { nested: true } })).toBeUndefined();
    expect(extractApiErrorCode({ code: null })).toBeUndefined();
  });

  it('field code là string rỗng ⇒ undefined (không bao giờ map ""→ "")', () => {
    expect(extractApiErrorCode({ code: '' })).toBeUndefined();
  });

  it('axios error nhưng response.data thiếu code ⇒ undefined', () => {
    expect(
      extractApiErrorCode({
        response: { data: { message: 'no code' } },
      }),
    ).toBeUndefined();
  });

  it('axios error với data null (network failure) ⇒ undefined', () => {
    expect(
      extractApiErrorCode({
        response: { data: null },
      }),
    ).toBeUndefined();
  });

  it('axios error không có response (network/CORS error) ⇒ undefined', () => {
    expect(
      extractApiErrorCode({
        message: 'Network Error',
        request: {},
      }),
    ).toBeUndefined();
  });
});

describe('extractApiErrorCodeOrDefault', () => {
  it('có code ⇒ trả về code', () => {
    expect(extractApiErrorCodeOrDefault({ code: 'NOT_FOUND' }, 'UNKNOWN')).toBe('NOT_FOUND');
  });

  it('không có code ⇒ trả về fallback', () => {
    expect(extractApiErrorCodeOrDefault(undefined, 'UNKNOWN')).toBe('UNKNOWN');
    expect(extractApiErrorCodeOrDefault({}, 'INVALID_CREDENTIALS')).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(extractApiErrorCodeOrDefault('plain string', 'EMAIL_TAKEN')).toBe(
      'EMAIL_TAKEN',
    );
  });

  it('code rỗng ⇒ fallback (không trả về "")', () => {
    expect(extractApiErrorCodeOrDefault({ code: '' }, 'UNKNOWN')).toBe('UNKNOWN');
  });
});
