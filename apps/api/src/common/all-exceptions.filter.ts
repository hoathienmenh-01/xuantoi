import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ApiErrorEnvelope {
  ok: false;
  error: { code: string; message: string };
}

function isApiErrorEnvelope(v: unknown): v is ApiErrorEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (obj.ok !== false) return false;
  const err = obj.error as Record<string, unknown> | undefined;
  return !!err && typeof err.code === 'string' && typeof err.message === 'string';
}

/**
 * Bắt mọi exception, chuẩn hoá về envelope `{ ok:false, error:{ code, message } }`.
 *   - ApiException (đã có envelope) → pass-through.
 *   - HttpException khác → wrap theo status.
 *   - Mọi thứ còn lại → 500 INTERNAL.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (isApiErrorEnvelope(body)) {
        res.status(status).json(body);
        return;
      }
      const code = mapStatusToCode(status);
      const message =
        typeof body === 'string'
          ? body
          : (body as { message?: string })?.message ?? code;
      res.status(status).json({
        ok: false,
        error: { code, message: typeof message === 'string' ? message : code },
      } satisfies ApiErrorEnvelope);
      return;
    }

    this.logger.error('Unhandled exception', exception as Error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: { code: 'INTERNAL', message: 'Lỗi máy chủ.' },
    } satisfies ApiErrorEnvelope);
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    default:
      return 'INTERNAL';
  }
}
