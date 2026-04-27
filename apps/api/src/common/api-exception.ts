import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorBody {
  ok: false;
  error: { code: string; message: string };
}

/**
 * Lỗi domain-level. Nest filter sẽ phát ra envelope `{ ok:false, error:{ code, message } }`.
 * Dùng thay cho HttpException trần.
 */
export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    message?: string,
  ) {
    const body: ApiErrorBody = {
      ok: false,
      error: { code, message: message ?? code },
    };
    super(body, status);
  }
}
